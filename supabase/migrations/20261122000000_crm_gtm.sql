-- CRM Eonesia · persistencia en la nube (Supabase) + bandeja de señales del radar
-- Cada usuario solo ve y modifica sus propias filas (RLS: owner = auth.uid()).

-- 1. Entidades del CRM (centros, contactos, oportunidades) como JSON por fila
create table if not exists public.crm_items (
  owner       uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  tipo        text        not null check (tipo in ('centro', 'contacto', 'oportunidad')),
  id          text        not null,
  data        jsonb       not null,
  actualizado timestamptz not null default now(),
  primary key (owner, tipo, id)
);

-- 2. Estado de usuario: gamificación y configuración
create table if not exists public.crm_meta (
  owner            uuid        primary key default auth.uid() references auth.users (id) on delete cascade,
  juego            jsonb,
  config           jsonb,
  es_datos_ejemplo boolean     not null default false,
  actualizado      timestamptz not null default now()
);

-- 3. Señales detectadas por el radar (GitHub Actions escribe con la service key)
create table if not exists public.senales (
  id            bigint generated always as identity primary key,
  owner         uuid        not null references auth.users (id) on delete cascade,
  fecha_senal   date,
  codigo_centro text,
  centro        text,
  titulo        text,
  enlace        text        not null,
  palabras      text,
  relevante     text,
  tema          text,
  resumen       text,
  primera_frase text,
  evidencia     text,
  estado        text        not null default 'nueva' check (estado in ('nueva', 'aprobada', 'descartada')),
  creado_en     timestamptz not null default now(),
  unique (owner, enlace)
);
create index if not exists senales_owner_estado on public.senales (owner, estado);

-- 4. Seguridad a nivel de fila
alter table public.crm_items enable row level security;
alter table public.crm_meta  enable row level security;
alter table public.senales   enable row level security;

create policy "crm_items_select" on public.crm_items for select to authenticated using (owner = (select auth.uid()));
create policy "crm_items_insert" on public.crm_items for insert to authenticated with check (owner = (select auth.uid()));
create policy "crm_items_update" on public.crm_items for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "crm_items_delete" on public.crm_items for delete to authenticated using (owner = (select auth.uid()));

create policy "crm_meta_select" on public.crm_meta for select to authenticated using (owner = (select auth.uid()));
create policy "crm_meta_insert" on public.crm_meta for insert to authenticated with check (owner = (select auth.uid()));
create policy "crm_meta_update" on public.crm_meta for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));

-- Las señales las inserta el radar (service role, que salta RLS); el usuario las lee y cambia su estado.
create policy "senales_select" on public.senales for select to authenticated using (owner = (select auth.uid()));
create policy "senales_update" on public.senales for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
