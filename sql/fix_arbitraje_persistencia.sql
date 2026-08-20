-- ============================================================
-- PERSISTENCIA DEL DETALLE DE ARBITRAJE POR JUGADOR
-- Ejecuta este script una sola vez en: SQL Editor → New query → Run
-- (Es idempotente: puede re-ejecutarse sin errores).
--
-- El guardado del partido usa upsert con ON CONFLICT
-- (partido_id, jugador_id). Si la tabla arbitraje_partidos se creó
-- sin esa restricción única (por ejemplo con un esquema anterior),
-- el upsert falla EN SILENCIO y el estado de pago de los jugadores
-- desmarcados nunca se actualiza: la BD sigue reteniendo pagos que
-- ya no existen en el formulario. Este script garantiza que la
-- restricción exista y elimina posibles duplicados previos.
-- ============================================================

-- 1) Elimina duplicados (conserva la fila más antigua de cada par).
--    Es necesario hacerlo antes de crear la restricción única.
delete from public.arbitraje_partidos a
using public.arbitraje_partidos b
where a.id > b.id
  and a.partido_id = b.partido_id
  and a.jugador_id = b.jugador_id;

-- 2) Crea la restricción única si aún no existe
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    where c.conname = 'arbitraje_partidos_partido_jugador_key'
      and c.conrelid = 'public.arbitraje_partidos'::regclass
  ) then
    alter table public.arbitraje_partidos
      add constraint arbitraje_partidos_partido_jugador_key
      unique (partido_id, jugador_id);
  end if;
end $$;