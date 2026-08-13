-- ============================================================
-- CORRECCIÓN CRÍTICA DE ESQUEMA: TABLA "estadisticas"
-- Ejecuta este script UNA sola vez en: Supabase Dashboard > SQL Editor
-- > New query > Run
-- (Es idempotente: puede re-ejecutarse sin errores).
--
-- ¿Por qué fallaba el guardado de partidos?
-- La aplicación envía al guardar un partido las columnas
-- "autogoles" y "asistencias" (y el flag "es_autogol"); si esas
-- columnas no existen en la tabla estadisticas, Supabase responde
-- con el error de columna y el partido no se guarda.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Agregar columna para autogoles si no existe
--    (booleano por registro: TRUE si el gol fue en propia puerta)
-- ------------------------------------------------------------
ALTER TABLE estadisticas
ADD COLUMN IF NOT EXISTS es_autogol BOOLEAN DEFAULT FALSE;

-- ------------------------------------------------------------
-- 2. Asegurar que exista la columna de asistencias
-- ------------------------------------------------------------
ALTER TABLE estadisticas
ADD COLUMN IF NOT EXISTS asistencias INT DEFAULT 0;

-- ------------------------------------------------------------
-- 3. Refrescar el caché del esquema en PostgREST
--    (sin esto, los cambios no se reflejan en la API hasta un
--     reintento manual o un reinicio del servicio)
-- ------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 4. Compatibilidad con la app actual
--    El panel admin acumula los goles en propia puerta como
--    CONTADOR (columna "autogoles" entero, un registro por
--    jugador y partido) y la vista pública los excluye del
--    ranking con esa columna. Asegura que exista.
-- ------------------------------------------------------------
ALTER TABLE estadisticas
ADD COLUMN IF NOT EXISTS autogoles INT DEFAULT 0;

-- Refresca de nuevo el caché tras el último cambio
NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 5. VERIFICACIÓN (opcional): debe devolver una fila por cada
--    columna esperada: goles, autogoles, asistencias, es_autogol
-- ------------------------------------------------------------
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'estadisticas'
order by ordinal_position;
