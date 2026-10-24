-- =====================================================================
-- CORRECCIÓN: permite que el cliente complete los campos del formulario
-- de ingreso. Pega esto en una NUEVA query y presiona Run, una sola vez.
--
-- Por qué hace falta: la base de datos protege client_profiles para que
-- un cliente solo pueda modificar una lista concreta de columnas. Esa
-- lista se armó antes de agregar los campos del formulario de ingreso
-- (objetivo, PAR-Q+, hábitos, preferencias, etc.), así que al enviar el
-- formulario, la base de datos rechazaba el guardado completo con el
-- error "Solo puedes modificar los campos permitidos". Esto actualiza
-- esa lista para incluir los campos nuevos.
-- =====================================================================

-- Fecha en que el ENTRENADOR revisó y aprobó el formulario de ingreso.
-- Se deja aparte, fuera de lo que el cliente puede tocar: solo el
-- entrenador la puede fijar.
alter table public.client_profiles
  add column if not exists reviewed_at timestamptz;

drop trigger if exists b_guard_client_update on public.client_profiles;
create trigger b_guard_client_update
  before update on public.client_profiles
  for each row execute function public.guard_client_update(
    'birth_date', 'sex', 'height_cm', 'weight_kg', 'sports_history', 'injuries', 'medical_notes',
    'emergency_contact', 'main_goal', 'secondary_goals', 'par_q', 'habits', 'preferences',
    'consent_accepted', 'submitted_at', 'updated_at'
  );
