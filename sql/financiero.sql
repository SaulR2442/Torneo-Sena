-- ============================================================
-- MÓDULO FINANCIERO: RECAUDO Y CARTERA + CORRECCIÓN DE POSICIONES
-- Ejecuta este script una sola vez en: SQL Editor → New query → Run
-- (Es idempotente: puede re-ejecutarse sin errores).
-- ============================================================

-- ------------------------------------------------------------
-- 1) COLUMNAS DE PAGO EN public.partidos
--    Pago de cuota por equipo + arbitraje del encuentro.
--    El estado del pago queda guardado AQUÍ (ya no depende de
--    arbitraje_partidos, que puede no existir en algunas bases).
-- ------------------------------------------------------------
alter table public.partidos
  add column if not exists pago_local boolean default false,
  add column if not exists pago_visitante boolean default false,
  add column if not exists arbitraje_pagado boolean default false;

-- ------------------------------------------------------------
-- 2) PARÁMETROS DE TESORERÍA (config)
--    cuota_partido   -> cuota por equipo por partido (COP)
--    cuota_jugador   -> cuota por jugador (referencia del etiquetado)
--    bolsa_premio_pct-> porcentaje del recaudado destinado al premio
-- ------------------------------------------------------------
insert into public.config (clave, valor) values
  ('cuota_partido', '8000'),
  ('cuota_jugador', '2000'),
  ('bolsa_premio_pct', '100')
on conflict (clave) do nothing;

-- ------------------------------------------------------------
-- 3) CORRECCIÓN TABLA DE POSICIONES (puntos/goles en 0)
--    Solo procesa partidos FINALIZADOS (jugado = true O estado =
--    'FINALIZADO'). Antes dependía únicamente de jugado, y los
--    partidos con resultado guardados vía "estado" (o con jugado
--    NULL en filas antiguas) quedaban fuera -> PTS/GF/GC en 0.
--    Puntos: victoria +3, empate +1, derrota +0.
-- ------------------------------------------------------------
drop view if exists public.tabla_posiciones;

create or replace view public.tabla_posiciones
as
with resumen as (
  select
    e.id as equipo_id,
    e.nombre,
    e.escudo_url,
    e.grupo,
    count(m.id) filter (where m.jugado or m.estado = 'FINALIZADO') as pj,
    count(m.id) filter (where (m.jugado or m.estado = 'FINALIZADO') and m.goles_local > m.goles_visitante) as pg,
    count(m.id) filter (where (m.jugado or m.estado = 'FINALIZADO') and m.goles_local = m.goles_visitante) as pe,
    count(m.id) filter (where (m.jugado or m.estado = 'FINALIZADO') and m.goles_local < m.goles_visitante) as pp,
    coalesce(sum(m.goles_local)  filter (where m.jugado or m.estado = 'FINALIZADO'), 0) as gf,
    coalesce(sum(m.goles_visitante) filter (where m.jugado or m.estado = 'FINALIZADO'), 0) as gc
  from public.equipos e
  left join public.partidos m
    on (m.jugado or m.estado = 'FINALIZADO')
       and m.fase = 'grupos'
       and (m.equipo_local_id = e.id or m.equipo_visitante_id = e.id)
  group by e.id
)
select
  equipo_id, nombre, escudo_url, grupo,
  pj, pg, pe, pp,
  (pg * 3 + pe) as puntos,
  gf, gc,
  (gf - gc) as dg
from resumen;

-- El ranking de jugadores usa el mismo criterio para no inflarse
-- con estadísticas de partidos sin finalizar.
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
  coalesce(sum(s.asistencias), 0) as asistencias
from public.jugadores j
join public.equipos e on e.id = j.equipo_id
left join public.estadisticas s
  on s.jugador_id = j.id
  and exists (
    select 1 from public.partidos m
    where m.id = s.partido_id and (m.jugado or m.estado = 'FINALIZADO')
  )
group by j.id, j.nombre, j.numero, e.nombre, e.id;

grant select on public.tabla_posiciones, public.ranking_jugadores to anon, authenticated;
