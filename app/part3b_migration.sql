-- =====================================================================
-- SEGUNDA MIGRACIÓN DE LA PARTE 3 (Formulario de ingreso del cliente)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
-- No borra ni modifica ningún dato que ya tengas: agrega columnas nuevas
-- (opcionales) a la tabla client_profiles, que ya existe.
--
-- Qué agrega:
--   - Objetivo principal y objetivos secundarios.
--   - Las 7 preguntas estándar del cuestionario PAR-Q+ (señales de alerta
--     de salud antes de empezar a entrenar), guardadas juntas.
--   - Hábitos (sueño, nivel de actividad) y preferencias de entrenamiento,
--     también agrupadas.
--   - Peso actual.
--   - Si aceptó el consentimiento, y cuándo completó el formulario —
--     esto último es lo que usa la app para saber si ya puede entrar al
--     resto de las pantallas o si todavía le falta completarlo.
-- =====================================================================

alter table public.client_profiles
  add column if not exists main_goal        text,
  add column if not exists secondary_goals  text[] not null default '{}',
  add column if not exists weight_kg        numeric check (weight_kg > 0),
  add column if not exists par_q            jsonb,
  add column if not exists habits           jsonb,
  add column if not exists preferences      jsonb,
  add column if not exists consent_accepted boolean not null default false,
  add column if not exists submitted_at     timestamptz;
