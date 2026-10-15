-- =====================================================================
-- SEXTA MIGRACIÓN DE LA PARTE 3 (Un entrenamiento por día, salvo que el
-- entrenador lo habilite)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- Agrega una sola columna a una tabla que ya existe (programs). No borra
-- ni modifica nada de lo que ya tenés cargado; todos los programas
-- existentes quedan con el comportamiento de siempre (un entrenamiento
-- por día) hasta que lo habilites a mano para alguno en particular.
-- =====================================================================

alter table public.programs
  add column if not exists allow_multiple_sessions_per_day boolean not null default false;
