-- Formulario v2 (especificación «Landings · Formularios → CRM»). SOLO AÑADE: columnas, tablas, bucket y una función nueva.
-- Copia de seguridad previa: esquema privado `respaldo` (crm_items_20261125, crm_meta_20261125, senales_20261125).

-- 1. Más datos en el registro de envíos
alter table public.leads_formulario
  add column if not exists perfil text,
  add column if not exists campana text,
  add column if not exists utm jsonb,
  add column if not exists datos_perfil jsonb,
  add column if not exists archivo_path text,
  add column if not exists acepta_comunicaciones boolean,
  add column if not exists contacto_id text,
  add column if not exists duplicado boolean;

-- 2. Campañas
create table if not exists public.campanas (
  codigo        text primary key,
  nombre        text not null,
  perfil        text,
  canal         text check (canal in ('email','linkedin','llamada','evento','landing')),
  fecha_inicio  date,
  fecha_fin     date,
  responsable   text,
  mensaje_url   text,
  metrica       text,
  objetivo      text,
  creado_en     timestamptz not null default now()
);
alter table public.campanas enable row level security;
create policy "campanas_dueno" on public.campanas for all to authenticated
  using ((select valor from public.app_config where clave = 'owner_crm')::uuid = (select auth.uid()))
  with check ((select valor from public.app_config where clave = 'owner_crm')::uuid = (select auth.uid()));
insert into public.campanas(codigo, nombre, perfil, responsable) values
  ('C1-colegios-andalucia', 'Colegios de Andalucía', 'colegio', 'Rafa'),
  ('C2-plataformas', 'Plataformas educativas', 'plataforma', 'Rafa'),
  ('C3-editoriales', 'Editoriales', 'editorial', 'Rafa'),
  ('C4-grupos-espanoles', 'Grupos educativos españoles', 'red_grupo', 'Rafa'),
  ('C5-grupos-internacionales', 'Grupos internacionales', 'red_grupo', 'Rafa'),
  ('C6-universidades', 'Universidades', 'universidad', 'Rafa'),
  ('C7-fp', 'Formación Profesional', 'formacion_fp', 'Rafa')
on conflict (codigo) do nothing;

-- 3. Archivos adjuntos: bucket privado (solo la Edge Function sube; solo el dueño lee)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lead-uploads', 'lead-uploads', false, 15728640, array[
  'application/pdf', 'image/jpeg', 'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do nothing;
create policy "lead_uploads_dueno_lee" on storage.objects for select to authenticated
  using (bucket_id = 'lead-uploads'
         and (select valor from public.app_config where clave = 'owner_crm')::uuid = (select auth.uid()));

-- 4. Siguiente día laborable (24 h laborables)
create or replace function public.dia_laborable_siguiente(d date)
returns date language sql immutable as $$
  select case extract(isodow from d)
           when 5 then d + 3   -- viernes -> lunes
           when 6 then d + 2   -- sábado -> lunes
           else d + 1 end      -- domingo -> lunes; resto -> mañana
$$;

-- 5. Alta v2: deduplica por email, guarda perfil, campaña, UTM y datos del perfil
create or replace function public.crear_lead_v2(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := (select valor from app_config where clave = 'owner_crm')::uuid;
  v_ip text := left(coalesce(p->>'_ip', ''), 60);
  v_nombre text := left(trim(coalesce(p->>'nombre', '')), 120);
  v_email text := lower(left(trim(coalesce(p->>'email', '')), 160));
  v_tel text := left(trim(coalesce(p->>'telefono', '')), 40);
  v_cargo text := left(trim(coalesce(p->>'cargo', '')), 120);
  v_org text := left(trim(coalesce(p->>'organizacion', '')), 160);
  v_localidad text := left(trim(coalesce(p->>'localidad', '')), 80);
  v_pais text := left(trim(coalesce(p->>'pais', '')), 60);
  v_msg text := left(trim(coalesce(p->>'mensaje', '')), 2000);
  v_perfil text := coalesce(nullif(p->>'perfil', ''), 'colegio');
  v_campana text := left(coalesce(nullif(p->>'campana', ''), nullif(p->'utm'->>'utm_campaign', ''), ''), 80);
  v_landing text := left(coalesce(p->>'landing', ''), 300);
  v_datos jsonb := coalesce(p->'datos_perfil', '{}'::jsonb);
  v_utm jsonb := coalesce(p->'utm', '{}'::jsonb);
  v_archivo text := nullif(p->>'archivo_url', '');
  v_acepta boolean := coalesce((p->>'acepta_comunicaciones')::boolean, false);
  v_tipo text;
  v_ahora text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
  v_vence text := to_char(dia_laborable_siguiente((now() at time zone 'Europe/Madrid')::date), 'YYYY-MM-DD');
  v_sufijo text := (extract(epoch from clock_timestamp()) * 1000)::bigint::text || '-' || substr(md5(random()::text), 1, 5);
  v_centro text; v_contacto text; v_op text; v_nota text; v_act jsonb;
  v_duplicado boolean := false;
begin
  if v_owner is null then raise exception 'CRM no configurado'; end if;
  if coalesce(p->>'web_trampa', '') <> '' then return jsonb_build_object('ok', true, 'ignorado', true); end if;
  if coalesce((p->>'consentimiento')::boolean, false) is not true then raise exception 'Falta el consentimiento'; end if;
  if length(v_nombre) < 2 or v_org = '' then raise exception 'Faltan datos obligatorios'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Email no válido'; end if;
  if v_perfil not in ('docente','colegio','red_grupo','editorial','plataforma','universidad','formacion_fp','formacion_empresa') then
    v_perfil := 'colegio';
  end if;
  if (select count(*) from leads_formulario where creado_en > now() - interval '1 hour' and ip = v_ip) >= 5
     or (select count(*) from leads_formulario where creado_en > now() - interval '1 hour') >= 60 then
    raise exception 'Demasiados envíos, inténtalo más tarde';
  end if;

  v_tipo := case v_perfil
    when 'universidad' then 'Universidad'
    when 'editorial' then 'Editorial'
    when 'plataforma' then 'Editorial'
    when 'formacion_fp' then 'FP'
    when 'formacion_empresa' then 'Institucional'
    else case lower(coalesce(v_datos->>'titularidad', ''))
           when 'pública' then 'Publico' when 'publica' then 'Publico'
           when 'privada' then 'Privado' else 'Concertado' end
  end;

  v_nota := 'Perfil: ' || v_perfil
    || case when v_campana <> '' then ' · Campaña: ' || v_campana else '' end
    || case when v_landing <> '' then ' · Landing: ' || v_landing else '' end || '. '
    || case when v_msg <> '' then 'Mensaje: ' || v_msg || '. ' else '' end
    || case when v_datos <> '{}'::jsonb then 'Datos: ' || (select string_agg(key || '=' || value, ', ') from jsonb_each_text(v_datos)) || '. ' else '' end
    || 'Email: ' || v_email || case when v_tel <> '' then ' · Tel: ' || v_tel else '' end
    || case when v_archivo is not null then '. Archivo: ' || v_archivo else '' end
    || '. Consentimiento RGPD: ' || v_ahora
    || case when v_acepta then ' · Acepta comunicaciones' else ' · No acepta comunicaciones' end || '.';

  -- ¿Email ya conocido?
  select id, data->>'centroId' into v_contacto, v_centro from crm_items
   where owner = v_owner and tipo = 'contacto' and lower(data->>'email') = v_email
   order by actualizado desc limit 1;

  if v_contacto is not null then
    v_duplicado := true;
    -- rellena solo lo vacío
    update crm_items set data = data
        || case when coalesce(data->>'telefono', '') = '' and v_tel <> '' then jsonb_build_object('telefono', v_tel) else '{}'::jsonb end
        || case when coalesce(data->>'cargo', '') in ('', 'Sin indicar') and v_cargo <> '' then jsonb_build_object('cargo', v_cargo) else '{}'::jsonb end,
        actualizado = now()
     where owner = v_owner and tipo = 'contacto' and id = v_contacto;
    select id into v_op from crm_items
     where owner = v_owner and tipo = 'oportunidad' and data->>'centroId' = v_centro
       and data->>'etapa' not in ('Ganado', 'Perdido')
     order by actualizado desc limit 1;
  else
    select id into v_centro from crm_items
     where owner = v_owner and tipo = 'centro' and lower(data->>'nombre') = lower(v_org) limit 1;
    if v_centro is null then
      v_centro := 'c-form-' || v_sufijo;
      insert into crm_items(owner, tipo, id, data) values (v_owner, 'centro', v_centro, jsonb_build_object(
        'id', v_centro, 'nombre', v_org, 'tipo', v_tipo,
        'provincia', coalesce(nullif(v_localidad, ''), nullif(v_pais, ''), 'No especificada'),
        'municipio', nullif(v_localidad, ''), 'alumnos', 0, 'web', '', 'origen', 'formulario',
        'verificado', false, 'creadoEn', v_ahora));
    end if;
    v_contacto := 'ct-form-' || v_sufijo;
    insert into crm_items(owner, tipo, id, data) values (v_owner, 'contacto', v_contacto, jsonb_build_object(
      'id', v_contacto, 'centroId', v_centro, 'nombre', v_nombre, 'cargo', coalesce(nullif(v_cargo, ''), 'Sin indicar'),
      'email', v_email, 'telefono', v_tel, 'rol', 'Decisor'));
  end if;

  v_act := jsonb_build_object('id', 'act-form-' || v_sufijo, 'tipo', 'otro', 'fecha', v_ahora, 'autor', 'Formulario web',
    'titulo', case when v_duplicado then 'Nuevo formulario desde ' || coalesce(nullif(v_landing, ''), 'la web') else 'Nuevo · landing' end,
    'nota', v_nota, 'resultado', 'pendiente');

  if v_op is not null then
    -- contacto conocido con oportunidad abierta: añade la actividad, no cambia la etapa
    update crm_items set data = jsonb_set(data, '{actividades}', jsonb_build_array(v_act) || coalesce(data->'actividades', '[]'::jsonb)),
        actualizado = now()
     where owner = v_owner and tipo = 'oportunidad' and id = v_op;
  else
    v_op := 'op-form-' || v_sufijo;
    insert into crm_items(owner, tipo, id, data) values (v_owner, 'oportunidad', v_op, jsonb_build_object(
      'id', v_op, 'centroId', v_centro, 'contactoIds', jsonb_build_array(v_contacto), 'etapa', 'Detectado',
      'valor', 0, 'dolor', 'Otro', 'productoSugerido', '', 'productoElegido', '',
      'criterios', '[null,null,null,null,null]'::jsonb, 'empatia', '["","","","","",""]'::jsonb,
      'proximoPaso', jsonb_build_object('accion', 'Responder en 24 h laborables (Nuevo · landing)', 'fecha', v_vence),
      'historialEtapas', jsonb_build_array(jsonb_build_object('etapa', 'Detectado', 'fecha', v_ahora)),
      'actividades', jsonb_build_array(v_act),
      'perfil', v_perfil, 'campana', nullif(v_campana, ''), 'estadoLanding', 'Nuevo · landing',
      'origenLead', jsonb_build_object('landing', v_landing, 'utm', v_utm, 'referrer', p->>'referrer', 'idioma', p->>'idioma'),
      'creadoEn', v_ahora));
  end if;

  insert into leads_formulario(ip, payload, centro_id, oportunidad_id, perfil, campana, utm, datos_perfil, archivo_path,
                               acepta_comunicaciones, contacto_id, duplicado)
  values (v_ip, p - 'web_trampa' - '_ip', v_centro, v_op, v_perfil, nullif(v_campana, ''), v_utm, v_datos,
          nullif(p->>'archivo_path', ''), v_acepta, v_contacto, v_duplicado);

  return jsonb_build_object('ok', true, 'duplicado', v_duplicado, 'perfil', v_perfil, 'oportunidad_id', v_op);
end $$;

-- Solo la Edge Function lead-intake (service_role) puede llamarla
revoke all on function public.crear_lead_v2(jsonb) from public, anon, authenticated;
grant execute on function public.crear_lead_v2(jsonb) to service_role;
