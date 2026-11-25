-- Formulario web → CRM y radar → Señales, sin exponer la service_role key.
-- Las funciones son SECURITY DEFINER: el público solo puede llamarlas, no leer ni escribir tablas.

-- 1. Configuración privada (sin políticas RLS = nadie la lee desde la API)
create table if not exists public.app_config (
  clave text primary key,
  valor text not null
);
alter table public.app_config enable row level security;

-- 2. Registro de envíos del formulario (auditoría + límite antispam)
create table if not exists public.leads_formulario (
  id          bigint generated always as identity primary key,
  creado_en   timestamptz not null default now(),
  ip          text,
  payload     jsonb not null,
  centro_id   text,
  oportunidad_id text
);
alter table public.leads_formulario enable row level security;
create policy "leads_formulario_select" on public.leads_formulario for select to authenticated
  using ((select valor from public.app_config where clave = 'owner_crm')::uuid = (select auth.uid()));

-- 3. Formulario público → centro + contacto + oportunidad en Detectado
create or replace function public.crear_lead_formulario(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := (select valor from app_config where clave = 'owner_crm')::uuid;
  v_ip text := split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1);
  v_nombre text := left(trim(coalesce(p->>'nombre', '')), 120);
  v_email text := lower(left(trim(coalesce(p->>'email', '')), 160));
  v_tel text := left(trim(coalesce(p->>'telefono', '')), 40);
  v_cargo text := left(trim(coalesce(p->>'cargo', '')), 120);
  v_org text := left(trim(coalesce(p->>'organizacion', '')), 160);
  v_tipo text := coalesce(p->>'tipo', 'Privado');
  v_prov text := left(trim(coalesce(p->>'provincia', '')), 60);
  v_msg text := left(trim(coalesce(p->>'mensaje', '')), 2000);
  v_origen text := left(trim(coalesce(p->>'origen', 'web')), 60);
  v_ahora text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_hoy text := to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM-DD');
  v_sufijo text := (extract(epoch from clock_timestamp()) * 1000)::bigint::text || '-' || substr(md5(random()::text), 1, 5);
  v_centro text;
  v_contacto text := 'ct-form-' || v_sufijo;
  v_op text := 'op-form-' || v_sufijo;
  v_nota text;
begin
  if v_owner is null then raise exception 'CRM no configurado'; end if;
  -- antispam: campo trampa y límites
  if coalesce(p->>'web_trampa', '') <> '' then return jsonb_build_object('ok', true); end if;
  if coalesce((p->>'consentimiento')::boolean, false) is not true then raise exception 'Falta el consentimiento'; end if;
  if length(v_nombre) < 2 or v_org = '' then raise exception 'Faltan datos obligatorios'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Email no válido'; end if;
  if (select count(*) from leads_formulario where creado_en > now() - interval '1 hour' and ip = v_ip) >= 5
     or (select count(*) from leads_formulario where creado_en > now() - interval '1 hour') >= 60 then
    raise exception 'Demasiados envíos, inténtalo más tarde';
  end if;
  if v_tipo not in ('FP','Privado','Concertado','Publico','Universidad','Editorial','Institucional') then v_tipo := 'Privado'; end if;

  -- reutiliza el centro si ya existe con el mismo nombre
  select id into v_centro from crm_items
   where owner = v_owner and tipo = 'centro' and lower(data->>'nombre') = lower(v_org) limit 1;
  if v_centro is null then
    v_centro := 'c-form-' || v_sufijo;
    insert into crm_items(owner, tipo, id, data) values (v_owner, 'centro', v_centro, jsonb_build_object(
      'id', v_centro, 'nombre', v_org, 'tipo', v_tipo, 'provincia', coalesce(nullif(v_prov, ''), 'No especificada'),
      'alumnos', 0, 'web', '', 'origen', 'formulario', 'verificado', false, 'creadoEn', v_ahora));
  end if;

  insert into crm_items(owner, tipo, id, data) values (v_owner, 'contacto', v_contacto, jsonb_build_object(
    'id', v_contacto, 'centroId', v_centro, 'nombre', v_nombre, 'cargo', coalesce(nullif(v_cargo, ''), 'Sin indicar'),
    'email', v_email, 'telefono', v_tel, 'rol', 'Decisor'));

  v_nota := 'Formulario web (' || v_origen || '). ' ||
            case when v_msg <> '' then 'Mensaje: ' || v_msg || '. ' else '' end ||
            'Email: ' || v_email || case when v_tel <> '' then ' · Tel: ' || v_tel else '' end ||
            '. Consentimiento RGPD aceptado el ' || v_hoy || '.';

  insert into crm_items(owner, tipo, id, data) values (v_owner, 'oportunidad', v_op, jsonb_build_object(
    'id', v_op, 'centroId', v_centro, 'contactoIds', jsonb_build_array(v_contacto), 'etapa', 'Detectado',
    'valor', 0, 'dolor', 'Otro', 'productoSugerido', '', 'productoElegido', '',
    'criterios', '[null,null,null,null,null]'::jsonb, 'empatia', '["","","","","",""]'::jsonb,
    'proximoPaso', jsonb_build_object('accion', 'Responder al interesado del formulario (en menos de 24 h)', 'fecha', v_hoy),
    'historialEtapas', jsonb_build_array(jsonb_build_object('etapa', 'Detectado', 'fecha', v_ahora)),
    'actividades', jsonb_build_array(jsonb_build_object('id', 'act-form-' || v_sufijo, 'tipo', 'otro', 'fecha', v_ahora,
       'autor', 'Formulario web', 'titulo', 'Nuevo interesado desde el formulario', 'nota', v_nota, 'resultado', 'pendiente')),
    'creadoEn', v_ahora));

  insert into leads_formulario(ip, payload, centro_id, oportunidad_id) values (v_ip, p - 'web_trampa', v_centro, v_op);
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.crear_lead_formulario(jsonb) from public;
grant execute on function public.crear_lead_formulario(jsonb) to anon, authenticated;

-- 4. Radar: escribe señales con un token propio (no con la service_role key)
create or replace function public.registrar_senales(token text, filas jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := (select valor from app_config where clave = 'owner_crm')::uuid;
  n integer;
begin
  if token is null or token <> (select valor from app_config where clave = 'radar_token') then
    raise exception 'Token no válido';
  end if;
  insert into senales(owner, fecha_senal, codigo_centro, centro, titulo, enlace, palabras, relevante, tema, resumen, primera_frase, evidencia)
  select v_owner, nullif(f->>'fecha_senal', '')::date, f->>'codigo_centro', f->>'centro', f->>'titulo', f->>'enlace',
         f->>'palabras', f->>'relevante', f->>'tema', f->>'resumen', f->>'primera_frase', f->>'evidencia'
    from jsonb_array_elements(filas) f
   where coalesce(f->>'enlace', '') <> ''
  on conflict (owner, enlace) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.enlaces_vistos(token text)
returns setof text
language plpgsql
security definer
set search_path = public
as $$
begin
  if token is null or token <> (select valor from app_config where clave = 'radar_token') then
    raise exception 'Token no válido';
  end if;
  return query select s.enlace from senales s
    where s.owner = (select valor from app_config where clave = 'owner_crm')::uuid;
end $$;

revoke all on function public.registrar_senales(text, jsonb) from public;
revoke all on function public.enlaces_vistos(text) from public;
grant execute on function public.registrar_senales(text, jsonb) to anon;
grant execute on function public.enlaces_vistos(text) to anon;
