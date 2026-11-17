-- =====================================================================
-- DECIMOSEXTA MIGRACIÓN DE LA PARTE 4 (Menores: ficha bloqueada y control)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
-- Requiere part4k_migration.sql y part4l_migration.sql.
--
--  1. Ficha bloqueada: mientras un alumno menor de 18 años no tenga la
--     autorización firmada de su tutor, nadie puede cargarle entrenamientos,
--     evaluaciones, medidas, bienestar ni archivos (ni el entrenador, ni sus
--     asistentes, ni el alumno). Sí se puede armarle el plan, agendarlo,
--     registrar pagos, escribirle y tomar notas. Apenas se sube la
--     autorización, se habilita solo.
--  2. clients.age_confirmed_at / _by: el entrenador confirma, al cargar un
--     alumno, que es mayor de edad o que va a pedir la autorización del tutor.
--  3. admin_minors_overview(): para el panel "Menores de edad" del Super
--     Admin (menores con y sin autorización, y alumnos sin fecha de nacimiento).
--  4. El Super Admin puede abrir las autorizaciones subidas (solo esos
--     archivos, ningún otro del alumno), para verificarlas.
-- =====================================================================

-- 1. Ficha bloqueada ------------------------------------------------------
create or replace function public.client_data_locked(p_client uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select cp.birth_date > (current_date - interval '18 years')::date
    from public.client_profiles cp where cp.client_id = p_client
  ), false)
  and coalesce((
    select c.guardian_consent_at is null from public.clients c where c.id = p_client
  ), false)
$$;

grant execute on function public.client_data_locked(uuid) to authenticated;

create or replace function public.minor_data_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_super_admin() or current_setting('app.internal', true) = '1' then
    return new;
  end if;
  if new.client_id is not null and public.client_data_locked(new.client_id) then
    raise exception 'Este alumno es menor de edad y falta la autorización firmada de su madre, padre o tutor. Súbela en su ficha (Clientes → el alumno) para poder registrarle entrenamientos, evaluaciones o medidas.'
      using errcode = '42501';
  end if;
  return new;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'workout_logs', 'workout_set_logs', 'workout_exercise_logs',
    'assessments', 'body_measurements', 'circumferences', 'skinfolds',
    'strength_tests', 'power_tests', 'endurance_tests', 'flexibility_tests', 'mobility_tests',
    'performance_tests', 'custom_test_results', 'progress_metrics',
    'wellness_logs', 'client_files'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists b_minor_lock on public.%I', t);
      execute format('create trigger b_minor_lock before insert on public.%I for each row execute function public.minor_data_guard()', t);
      raise notice 'Ficha de menores protegida en %', t;
    end if;
  end loop;
end $$;

-- 2. Confirmación de edad al cargar un alumno ----------------------------
alter table public.clients add column if not exists age_confirmed_at timestamptz;
alter table public.clients add column if not exists age_confirmed_by uuid;

-- 3. Panel del Super Admin -------------------------------------------------
create or replace function public.admin_minors_overview()
returns table (
  client_id uuid,
  client_name text,
  client_status text,
  client_created_at timestamptz,
  has_account boolean,
  form_submitted_at timestamptz,
  birth_date date,
  is_minor boolean,
  consent_at timestamptz,
  consent_path text,
  photos_ok boolean,
  age_confirmed_at timestamptz,
  organization_id uuid,
  organization_name text,
  trainer_id uuid,
  trainer_name text,
  trainer_phone text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(public.is_super_admin(), false) then
    raise exception 'Solo el Super Admin puede ver este panel.' using errcode = '42501';
  end if;
  return query
  select c.id, c.full_name, c.status, c.created_at,
         c.profile_id is not null, cp.submitted_at, cp.birth_date,
         coalesce(cp.birth_date > (current_date - interval '18 years')::date, false),
         c.guardian_consent_at, c.guardian_consent_path, coalesce(c.guardian_photos_ok, false),
         c.age_confirmed_at,
         c.organization_id, o.name, c.trainer_id, p.full_name, p.phone
  from public.clients c
  join public.organizations o on o.id = c.organization_id
  left join public.profiles p on p.id = c.trainer_id
  left join public.client_profiles cp on cp.client_id = c.id
  where c.status <> 'archived'
    and (cp.birth_date is null
         or cp.birth_date > (current_date - interval '18 years')::date
         or c.guardian_consent_at is not null)
  order by o.name, c.full_name;
end $$;

grant execute on function public.admin_minors_overview() to authenticated;

-- 4. El Super Admin abre las autorizaciones (y solo esas) -----------------
drop policy if exists client_files_consent_admin on storage.objects;
create policy client_files_consent_admin on storage.objects for select to authenticated
  using (bucket_id = 'client-files'
         and public.is_super_admin()
         and exists (select 1 from public.clients c where c.guardian_consent_path = storage.objects.name));
