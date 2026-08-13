-- ============================================================
-- CORRECCIONES DE REACTIVIDAD (autogoles)
-- Ejecuta este script una sola vez en: SQL Editor → New query → Run
-- (Es idempotente: puede re-ejecutarse sin errores).
--
-- Agrega la columna "autogoles" a estadisticas para que los goles en
-- propia puerta:
--   1) no sumen al ranking de goleadores del jugador, y
--   2) se restauren correctamente al volver a editar un partido.
-- ============================================================
alter table public.estadisticas
  add column if not exists autogoles integer default 0;

-- Recrea el ranking para que exija explícitamente que los goles
-- normales siempre estén presentes (los autogoles viven en su propia
-- columna y nunca se suman aquí).
drop view if exists public.ranking_jugadores;

create or replace view public.ranking_jugadores
as
select
  j.id as jugador_id,
  j.nombre as jugador,
  j.numero,
  e.nombre as equipo,
  e.id as equipo_id,
  coalesce(sum(s.goles), 0) as goles,
  coalesce(sum(s.asistencias), 0) as asistencias,
  coalesce(sum(s.autogoles), 0) as autogoles
from public.jugadores j
join public.equipos e on e.id = j.equipo_id
left join public.estadisticas s
  on s.jugador_id = j.id
  and exists (select 1 from public.partidos m where m.id = s.partido_id and (m.jugado or m.estado = 'FINALIZADO'))
group by j.id, j.nombre, j.numero, e.nombre, e.id;

grant select on public.ranking_jugadores to anon, authenticated;