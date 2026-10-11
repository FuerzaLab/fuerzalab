-- =====================================================================
-- MIGRACIÓN PARA LA PARTE 3 (Constructor de rutinas y Planificación)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
-- No borra ni modifica ningún dato que ya tengas: solo agrega columnas
-- nuevas (opcionales) a tablas que ya existen.
--
-- Qué agrega y por qué:
--   1. Permite marcar un bloque de sesión como "Cardio" (antes solo
--      existían Calentamiento, Principal, Movilidad, etc.).
--   2. Agrega a cada ejercicio prescrito los campos que necesita el
--      cardio: duración, distancia, pasos diarios y zona de frecuencia
--      cardíaca — en el diseño original solo había series/repeticiones/
--      carga, pensado para fuerza.
--   3. Agrega a cada sesión el "tipo de fuerza a trabajar" (fuerza
--      resistencia / hipertrofia / máxima / potencia), que es lo que
--      usa el botón de sugerencia automática de series y descanso.
-- =====================================================================

alter table public.session_blocks
  drop constraint if exists session_blocks_kind_check,
  add constraint session_blocks_kind_check
    check (kind in ('warmup','main','superset','circuit','mobility','flexibility','cooldown','cardio'));

alter table public.workout_exercises
  add column if not exists duration_min  numeric,
  add column if not exists distance_km   numeric,
  add column if not exists steps_target  int,
  add column if not exists hr_zone       text;

alter table public.sessions
  add column if not exists strength_type text
    check (strength_type in ('resistencia','hipertrofia','maxima','potencia'));
