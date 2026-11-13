-- =====================================================================
-- DECIMOQUINTA MIGRACIÓN DE LA PARTE 4 (Rutinas en orden)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- programs.strict_order: el alumno hace las rutinas en el orden que armó el
-- entrenador, sin saltarse ninguna (las saltadas por el entrenador cuentan
-- como hechas). En Rutinas fijas sigue la rotación (después del C, el A).
-- Activado por defecto; el entrenador lo puede desactivar en cada programa.
-- =====================================================================

alter table public.programs add column if not exists strict_order boolean not null default true;
