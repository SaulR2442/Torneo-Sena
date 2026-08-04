-- ============================================================
-- TORNEO SENA - MÓDULO FIXTURE "TODOS CONTRA TODOS" (admin)
-- Agrega las columnas "jornada" y "estado" a la tabla partidos
-- para el generador Round-Robin del panel admin.
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- Jornada / fecha de la fase de liga (p. ej. "Fecha 1")
alter table public.partidos
  add column if not exists jornada text;

-- Estado del partido generado (p. ej. "PENDIENTE")
alter table public.partidos
  add column if not exists estado text default 'PENDIENTE';