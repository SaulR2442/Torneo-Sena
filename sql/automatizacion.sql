-- ============================================================
-- AUTOMATIZACIÓN TOTAL (anti-duplicados + tiempo real)
-- Ejecuta este script una sola vez en: SQL Editor → New query → Run
-- (Es idempotente: puede re-ejecutarse sin errores).
--
-- 1) ÍNDICE ÚNICO ANTI-DUPLICADOS
--    Impide que un mismo partido de la fase "Todos contra Todos"
--    (mismos equipos + misma jornada) se guarde dos veces, lo que
--    acumularía doble puntuación y dobles goles en la tabla de
--    posiciones y en el ranking de jugadores.
--
--    NOTA: si ya existen partidos duplicados en la base, el CREATE
--    UNIQUE INDEX fallará. En ese caso borra los duplicados primero:
--
--    with dup as (
--      select min(id) as conservar, equipo_local_id, equipo_visitante_id, jornada
--      from public.partidos
--      where fase = 'grupos' and jornada is not null
--      group by equipo_local_id, equipo_visitante_id, jornada
--      having count(*) > 1
--    )
--    delete from public.partidos p
--    using dup d
--    where p.equipo_local_id = d.equipo_local_id
--      and p.equipo_visitante_id = d.equipo_visitante_id
--      and p.jornada = d.jornada
--      and p.id <> d.conservar;
--
--    y luego vuelve a ejecutar este script.
-- ============================================================
create unique index if not exists uq_partidos_liga
  on public.partidos (fase, jornada, equipo_local_id, equipo_visitante_id)
  where fase = 'grupos'
    and jornada is not null
    and equipo_local_id is not null
    and equipo_visitante_id is not null;

-- ============================================================
-- 2) TIEMPO REAL (Supabase Realtime)
--    Publica los cambios de partidos y estadísticas para que la
--    vista pública (index.html) se actualice AL INSTANTE cuando
--    el panel admin guarda un partido, sin refrescar la página.
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'partidos'
  ) then
    alter publication supabase_realtime add table public.partidos;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'estadisticas'
  ) then
    alter publication supabase_realtime add table public.estadisticas;
  end if;
end $$;

-- Replica identity completa: entrega en el payload el valor viejo y el
-- nuevo de todas las columnas (necesario para eventos de UPDATE).
alter table public.partidos replica identity full;
alter table public.estadisticas replica identity full;

-- ============================================================
-- 3) TABLA DE POSICIONES
--    NOTA: ya es una VISTA (public.tabla_posiciones) que se recalcula
--    en cada consulta leyendo los partidos FINALIZADOS de la fase de
--    grupos. Al marcar un partido como FINALIZADO, los puntos (victoria
--    +3, empate +1), PJ, PG, PE, PP, GF, GC y DG se actualizan solos:
--    no requiere mantenimiento manual ni nada que ejecutar aquí.
-- ============================================================
