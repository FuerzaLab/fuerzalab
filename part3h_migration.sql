-- =====================================================================
-- OCTAVA MIGRACIÓN DE LA PARTE 3 (Revisar semanas sin reclamar)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- Agrega una sola columna a una tabla que ya existe (weeks). No borra ni
-- modifica nada de lo que ya tenés cargado.
-- =====================================================================

alter table public.weeks
  add column if not exists reviewed boolean not null default false;
