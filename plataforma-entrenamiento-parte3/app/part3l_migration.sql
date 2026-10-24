-- =====================================================================
-- UNDÉCIMA MIGRACIÓN DE LA PARTE 3 (Citas repetidas en la Agenda)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- Agrega una sola columna a trainer_appointments (no toca nada más). Las
-- citas repetidas se guardan como filas individuales de verdad, todas
-- con el mismo recurrence_id — así cada una se puede editar o borrar
-- suelta sin afectar a las demás, y "desactivar la repetición" significa
-- simplemente borrar las que todavía no pasaron.
-- =====================================================================

alter table public.trainer_appointments
  add column recurrence_id uuid;

create index idx_trainer_appointments_recurrence
  on public.trainer_appointments (recurrence_id)
  where recurrence_id is not null;
