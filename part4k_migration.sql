-- =====================================================================
-- UNDÉCIMA MIGRACIÓN DE LA PARTE 4 (Alumnos menores de edad)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
--  * Formulario de ingreso: si el alumno tiene menos de 18 años, carga los
--    datos de su madre, padre o tutor (client_profiles.guardian: nombre, CI,
--    parentesco y celular). El alumno puede guardarlos: se suma a la lista
--    de campos que el alumno puede modificar de su formulario.
--  * Autorización firmada: el entrenador la recibe en persona, sube una foto
--    y la marca como recibida (clients.guardian_consent_at / _path / _by).
--    El alumno NO puede marcarla: de su ficha solo puede cambiar su nombre y
--    su celular (regla que ya existía).
-- =====================================================================

alter table public.client_profiles add column if not exists guardian jsonb;

alter table public.clients add column if not exists guardian_consent_at timestamptz;
alter table public.clients add column if not exists guardian_consent_path text;
alter table public.clients add column if not exists guardian_consent_by uuid;

-- Lo que el alumno puede modificar de su formulario de ingreso, ahora con los datos de su tutor.
drop trigger if exists b_guard_client_update on public.client_profiles;
create trigger b_guard_client_update
  before update on public.client_profiles
  for each row execute function public.guard_client_update(
    'birth_date', 'sex', 'height_cm', 'weight_kg', 'sports_history', 'injuries', 'medical_notes',
    'emergency_contact', 'main_goal', 'secondary_goals', 'par_q', 'habits', 'preferences',
    'consent_accepted', 'submitted_at', 'updated_at', 'guardian'
  );
