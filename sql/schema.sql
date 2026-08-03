-- ============================================================
-- TORNEO SENA - ESQUEMA COMPLETO PARA SUPABASE (PostgreSQL)
-- Ejecutar completo en: Supabase Dashboard > SQL Editor > New query
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- ADMINISTRADORES
-- ============================================================
create table if not exists public.administradores (
  email text primary key,
  nombre text,
  creado_en timestamptz default now()
);

-- Inserta aquí los correos de los administradores (tú y tu co-admin)
-- insert into public.administradores (email, nombre) values
--   ('tu_correo@gmail.com', 'Administrador'),
--   ('coadmin@gmail.com', 'Co-Administrador');

-- ============================================================
-- EQUIPOS
-- Nota: "grupo" y "pago_arbitraje" quedan en desuso (el torneo es
-- "Todos contra Todos" y el arbitraje se controla por jugador en
-- arbitraje_partidos). Se conservan solo por compatibilidad.
-- ============================================================
create table if not exists public.equipos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  grupo text,
  escudo_url text,
  color text default '#10b981',
  pago_arbitraje boolean default false,
  creado_en timestamptz default now()
);

-- ============================================================
-- JUGADORES
-- ============================================================
create table if not exists public.jugadores (
  id uuid primary key default gen_random_uuid(),
  equipo_id uuid not null references public.equipos(id) on delete cascade,
  nombre text not null,
  posicion text,
  numero integer,
  foto_url text,
  creado_en timestamptz default now()
);

-- ============================================================
-- PARTIDOS
-- fase: grupos (Todos contra Todos) | dieciseisavos | octavos |
--       cuartos | semifinal | final | tercer_lugar
-- fecha: solo se usa la fecha (día), sin hora
-- ============================================================
create table if not exists public.partidos (
  id uuid primary key default gen_random_uuid(),
  fase text not null default 'grupos',
  grupo text,
  posicion_bracket integer,
  equipo_local_id uuid references public.equipos(id) on delete set null,
  equipo_visitante_id uuid references public.equipos(id) on delete set null,
  goles_local integer default 0,
  goles_visitante integer default 0,
  jugado boolean default false,
  ganador_id uuid references public.equipos(id) on delete set null,
  fecha timestamptz,
  sede text,
  creado_en timestamptz default now()
);

create index if not exists idx_partidos_fase on public.partidos (fase, posicion_bracket);
create index if not exists idx_partidos_grupo on public.partidos (grupo);

-- ============================================================
-- ESTADISTICAS (contadores por jugador por partido)
-- ============================================================
create table if not exists public.estadisticas (
  id uuid primary key default gen_random_uuid(),
  partido_id uuid not null references public.partidos(id) on delete cascade,
  jugador_id uuid not null references public.jugadores(id) on delete cascade,
  equipo_id uuid not null references public.equipos(id) on delete cascade,
  goles integer default 0,
  asistencias integer default 0,
  unique (partido_id, jugador_id)
);

create index if not exists idx_est_jugador on public.estadisticas (jugador_id);

-- ============================================================
-- ARBITRAJE POR PARTIDO (pago individual por jugador)
-- ============================================================
create table if not exists public.arbitraje_partidos (
  id uuid primary key default gen_random_uuid(),
  partido_id uuid not null references public.partidos(id) on delete cascade,
  jugador_id uuid not null references public.jugadores(id) on delete cascade,
  pagado boolean default false,
  unique (partido_id, jugador_id)
);

create index if not exists idx_arb_partido on public.arbitraje_partidos (partido_id);

-- ============================================================
-- GALERIA
-- ============================================================
create table if not exists public.galeria (
  id uuid primary key default gen_random_uuid(),
  titulo text,
  descripcion text,
  archivo_url text not null,
  tipo text not null default 'foto',
  partido_id uuid references public.partidos(id) on delete set null,
  creado_en timestamptz default now()
);

-- ============================================================
-- REGLAS
-- ============================================================
create table if not exists public.reglas (
  id uuid primary key default gen_random_uuid(),
  contenido text not null default '',
  actualizado_en timestamptz default now()
);

-- ============================================================
-- CONFIG (parámetros del torneo)
-- ============================================================
create table if not exists public.config (
  clave text primary key,
  valor text
);

insert into public.config (clave, valor) values
  ('torneo_nombre', 'Torneo SENA'),
  ('num_grupos', '1'),
  ('num_clasificados', '8'),
  ('nota_clasificacion', 'Clasifican los mejores equipos de la tabla general a la fase eliminatoria')
on conflict (clave) do nothing;

-- ============================================================
-- FUNCION es_admin (controla quién puede escribir)
-- ============================================================
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.administradores
    where lower(email) = lower((auth.jwt() ->> 'email'))
  );
$$;

grant execute on function public.es_admin() to authenticated;

-- ============================================================
-- SEGURIDAD: NIVEL DE FILA (RLS)
-- Lectura pública total / Escritura solo administradores
-- Nota: cada política se elimina antes de crearse para que el
-- script pueda re-ejecutarse sin errores ("policy already exists").
-- ============================================================
alter table public.administradores enable row level security;
alter table public.equipos enable row level security;
alter table public.jugadores enable row level security;
alter table public.partidos enable row level security;
alter table public.estadisticas enable row level security;
alter table public.arbitraje_partidos enable row level security;
alter table public.galeria enable row level security;
alter table public.reglas enable row level security;
alter table public.config enable row level security;

drop policy if exists "lectura publica administradores" on public.administradores;
drop policy if exists "admin administradores" on public.administradores;
create policy "lectura publica administradores" on public.administradores for select to anon, authenticated using (true);
create policy "admin administradores" on public.administradores for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists "lectura publica equipos" on public.equipos;
drop policy if exists "admin equipos" on public.equipos;
create policy "lectura publica equipos" on public.equipos for select to anon, authenticated using (true);
create policy "admin equipos" on public.equipos for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists "lectura publica jugadores" on public.jugadores;
drop policy if exists "admin jugadores" on public.jugadores;
create policy "lectura publica jugadores" on public.jugadores for select to anon, authenticated using (true);
create policy "admin jugadores" on public.jugadores for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists "lectura publica partidos" on public.partidos;
drop policy if exists "admin partidos" on public.partidos;
create policy "lectura publica partidos" on public.partidos for select to anon, authenticated using (true);
create policy "admin partidos" on public.partidos for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists "lectura publica estadisticas" on public.estadisticas;
drop policy if exists "admin estadisticas" on public.estadisticas;
create policy "lectura publica estadisticas" on public.estadisticas for select to anon, authenticated using (true);
create policy "admin estadisticas" on public.estadisticas for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists "lectura publica arbitraje" on public.arbitraje_partidos;
drop policy if exists "admin arbitraje" on public.arbitraje_partidos;
create policy "lectura publica arbitraje" on public.arbitraje_partidos for select to anon, authenticated using (true);
create policy "admin arbitraje" on public.arbitraje_partidos for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists "lectura publica galeria" on public.galeria;
drop policy if exists "admin galeria" on public.galeria;
create policy "lectura publica galeria" on public.galeria for select to anon, authenticated using (true);
create policy "admin galeria" on public.galeria for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists "lectura publica reglas" on public.reglas;
drop policy if exists "admin reglas" on public.reglas;
create policy "lectura publica reglas" on public.reglas for select to anon, authenticated using (true);
create policy "admin reglas" on public.reglas for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists "lectura publica config" on public.config;
drop policy if exists "admin config" on public.config;
create policy "lectura publica config" on public.config for select to anon, authenticated using (true);
create policy "admin config" on public.config for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- ============================================================
-- VISTAS PÚBLICAS (cálculo automático de estadísticas)
-- ============================================================
-- Tabla de posiciones: solo cuenta partidos JUGADOS de la fase
-- "grupos" (la eliminatoria no suma puntos en la tabla general).
-- Incluye escudo_url para que la vista pública muestre los escudos.
create or replace view public.tabla_posiciones
as
with resumen as (
  select
    e.id as equipo_id,
    e.nombre,
    e.escudo_url,
    e.grupo,
    count(m.id) filter (where m.jugado) as pj,
    count(m.id) filter (where m.jugado and m.goles_local > m.goles_visitante) as pg,
    count(m.id) filter (where m.jugado and m.goles_local = m.goles_visitante) as pe,
    count(m.id) filter (where m.jugado and m.goles_local < m.goles_visitante) as pp,
    coalesce(sum(m.goles_local)  filter (where m.jugado), 0) as gf,
    coalesce(sum(m.goles_visitante) filter (where m.jugado), 0) as gc
  from public.equipos e
  left join public.partidos m
    on m.jugado and m.fase = 'grupos' and (m.equipo_local_id = e.id or m.equipo_visitante_id = e.id)
  group by e.id
)
select
  equipo_id, nombre, escudo_url, grupo,
  pj, pg, pe, pp,
  (pg * 3 + pe) as puntos,
  gf, gc,
  (gf - gc) as dg
from resumen;

-- Ranking de jugadores: solo suma estadísticas de partidos JUGADOS
-- (evita que resultados guardados en partidos sin jugar inflen el ranking).
create or replace view public.ranking_jugadores
as
select
  j.id as jugador_id,
  j.nombre as jugador,
  j.numero,
  e.nombre as equipo,
  e.id as equipo_id,
  coalesce(sum(s.goles), 0) as goles,
  coalesce(sum(s.asistencias), 0) as asistencias
from public.jugadores j
join public.equipos e on e.id = j.equipo_id
left join public.estadisticas s
  on s.jugador_id = j.id
  and exists (select 1 from public.partidos m where m.id = s.partido_id and m.jugado)
group by j.id, j.nombre, j.numero, e.nombre, e.id;

grant select on public.tabla_posiciones, public.ranking_jugadores to anon, authenticated;

-- ============================================================
-- STORAGE: bucket "media" (escudos, fotos de jugadores, galería)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "media lectura publica" on storage.objects;
drop policy if exists "media admin insertar" on storage.objects;
drop policy if exists "media admin actualizar" on storage.objects;
drop policy if exists "media admin eliminar" on storage.objects;

create policy "media lectura publica" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'media');

create policy "media admin insertar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and public.es_admin());

create policy "media admin actualizar" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and public.es_admin());

create policy "media admin eliminar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and public.es_admin());
