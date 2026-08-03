-- ============================================================
-- VERIFICACIÓN DE ESCUDOS/LOGOS (Supabase SQL Editor)
-- Ejecuta todo y revisa los resultados. Corrige solo lo que falla.
-- ============================================================

-- 1) ¿El bucket "media" es PÚBLICO (public = true)?
--    Si sale false: ejecuta el UPDATE de la sección A.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'media';

-- 2) ¿Existen políticas de LECTURA para anon/authenticated en storage.objects?
--    Deben aparecer filas para el bucket 'media' (columna qual/roles contienen anon).
select policyname, schemaname, tablename, cmd, roles, qual
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;

-- 3) ¿Los equipos tienen la URL del escudo guardada en la columna escudo_url?
--    Si escudo_url es NULL para algún equipo, el escudo NO se guardó al crearlo.
select nombre, escudo_url, creado_en
from public.equipos
order by nombre;

-- 4) ¿La vista pública expone escudo_url? (debe aparecer la columna)
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'tabla_posiciones'
order by ordinal_position;

-- ============================================================
-- SECCIÓN A: arreglar bucket no público
-- ============================================================
-- update storage.buckets set public = true where id = 'media';

-- ============================================================
-- SECCIÓN B: arreglar políticas de lectura (si faltan)
-- ============================================================
-- drop policy if exists "media lectura publica" on storage.objects;
-- create policy "media lectura publica" on storage.objects
--   for select to anon, authenticated
--   using (bucket_id = 'media');

-- ============================================================
-- SECCIÓN C: re-generar vistas con escudo_url (si ya corriste el
-- esquema anterior sin la corrección). Ejecutar una sola vez.
-- ============================================================
-- create or replace view public.tabla_posiciones
-- as
-- with resumen as (
--   select
--     e.id as equipo_id,
--     e.nombre,
--     e.escudo_url,
--     e.grupo,
--     count(m.id) filter (where m.jugado) as pj,
--     count(m.id) filter (where m.jugado and m.goles_local > m.goles_visitante) as pg,
--     count(m.id) filter (where m.jugado and m.goles_local = m.goles_visitante) as pe,
--     count(m.id) filter (where m.jugado and m.goles_local < m.goles_visitante) as pp,
--     coalesce(sum(m.goles_local)  filter (where m.jugado), 0) as gf,
--     coalesce(sum(m.goles_visitante) filter (where m.jugado), 0) as gc
--   from public.equipos e
--   left join public.partidos m
--     on m.jugado and m.fase = 'grupos' and (m.equipo_local_id = e.id or m.equipo_visitante_id = e.id)
--   group by e.id
-- )
-- select
--   equipo_id, nombre, escudo_url, grupo,
--   pj, pg, pe, pp,
--   (pg * 3 + pe) as puntos,
--   gf, gc,
--   (gf - gc) as dg
-- from resumen;

-- ============================================================
-- SECCIÓN D: para equipos ya creados SIN escudo, puedes pegar la
-- URL pública del archivo subido manualmente:
-- ============================================================
-- update public.equipos
-- set escudo_url = 'https://TU-PROYECTO.supabase.co/storage/v1/object/public/media/escudos/MI-ARCHIVO.png'
-- where nombre = 'Nombre del equipo';
