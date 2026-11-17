-- =====================================================================
-- DECIMONOVENA MIGRACIÓN DE LA PARTE 4 (Plan nuevo: en espera o reemplazo)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- Hasta ahora, al crear un plan nuevo para un alumno, su app pasaba al plan
-- nuevo al instante, aunque le quedaran rutinas del anterior (o estuviera
-- haciendo una). Ahora, al crearlo, el entrenador elige:
--   * "Que primero termine el anterior": el plan nuevo queda EN ESPERA
--     (programs.queued = true) y el alumno lo empieza solo cuando hizo (o el
--     entrenador saltó) todas las rutinas del anterior. Se puede adelantar
--     con "Empezar ya".
--   * "Reemplazarlo ya": el anterior se cierra (status = 'completed').
-- En los dos casos, la rutina que el alumno esté haciendo en ese momento la
-- puede terminar. Solo agrega una columna; no toca datos.
-- =====================================================================

alter table public.programs add column if not exists queued boolean not null default false;
