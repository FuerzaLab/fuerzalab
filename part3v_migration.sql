-- =====================================================================
-- VIGESIMOPRIMERA MIGRACIÓN DE LA PARTE 3 (Cargas en kg o en libras)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- Hay gimnasios con todo en kg, otros con todo en libras y otros mixtos
-- (máquinas y poleas en libras; discos y mancuernas en kg). Esto permite
-- cargar cada serie en la unidad del equipo que se usó.
--
-- Por dentro TODO sigue guardándose en kg (load_kg, load_value), así los
-- récords, el 1RM y los gráficos comparan bien aunque se mezclen unidades.
-- Lo nuevo es recordar en qué unidad se cargó cada cosa, para mostrarla
-- igual que se cargó ("100 lb" sigue siendo "100 lb").
--
--  * clients.gym_units: dónde entrena el alumno — 'kg' (todo en kg),
--    'lb' (todo en libras) o 'mixed' (máquinas/poleas en lb, el resto en
--    kg). Vacío = el valor por defecto del entrenador.
--  * El valor por defecto va en organizations.settings → default_gym_units,
--    y se cambia con la función set_default_gym_units (solo entrenadores).
--  * workout_exercises.load_unit: unidad elegida a mano para un ejercicio
--    de la rutina (vacío = la que corresponda según el gimnasio).
--  * workout_set_logs.load_unit: en qué unidad se cargó cada serie
--    (vacío = kg, como todo lo registrado hasta ahora).
--  * El alumno puede guardar load_unit en sus series (se suma a las
--    columnas que tiene permitido modificar).
--  * La vista de récords devuelve también la unidad de la serie.
-- =====================================================================

alter table public.clients
  add column if not exists gym_units text check (gym_units in ('kg', 'lb', 'mixed'));

alter table public.workout_exercises
  add column if not exists load_unit text check (load_unit in ('kg', 'lb'));

alter table public.workout_set_logs
  add column if not exists load_unit text check (load_unit in ('kg', 'lb'));

-- El alumno puede modificar estas columnas de sus series (antes, sin load_unit).
drop trigger if exists b_guard_client_update on public.workout_set_logs;
create trigger b_guard_client_update before update on public.workout_set_logs
  for each row execute function public.guard_client_update(
    'set_number', 'reps', 'load_kg', 'load_unit', 'rir', 'rpe', 'completed', 'comment', 'performed_at', 'updated_at');

create or replace function public.set_default_gym_units(p_units text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.auth_org();
begin
  if public.auth_role() is distinct from 'trainer' or v_org is null then
    raise exception 'Solo un entrenador puede cambiar la unidad por defecto.';
  end if;
  if p_units not in ('kg', 'lb', 'mixed') then
    raise exception 'Unidad no válida.';
  end if;
  update public.organizations
     set settings = settings || jsonb_build_object('default_gym_units', p_units),
         updated_at = now()
   where id = v_org;
end $$;
grant execute on function public.set_default_gym_units(text) to authenticated;

-- Vista de récords (part3r): igual que antes, con la unidad de la serie al final.
create or replace view public.personal_records
with (security_invoker = true) as
with sets as (
  select
    s.id, s.client_id, s.exercise_id, s.workout_log_id, s.reps, s.load_kg, s.performed_at, s.load_unit,
    (coalesce(s.load_kg, 0) > 0) as with_load,
    case
      when coalesce(s.load_kg, 0) > 0 and s.reps = 1 then s.load_kg
      when coalesce(s.load_kg, 0) > 0 then round((s.load_kg * (1 + s.reps / 30.0)) * 2) / 2
      else s.reps
    end as metric
  from public.workout_set_logs s
  where s.completed and s.reps > 0
),
ranked as (
  select sets.*,
    max(metric) over (
      partition by client_id, exercise_id, with_load
      order by performed_at, id
      rows between unbounded preceding and 1 preceding
    ) as previous_best
  from sets
),
records as (
  select *,
    row_number() over (partition by client_id, exercise_id, with_load, performed_at::date order by metric desc, id) as rn
  from ranked
  where previous_best is not null and metric > previous_best
    and performed_at >= now() - interval '45 days'
)
select r.id, r.client_id, r.exercise_id, e.name as exercise_name, r.workout_log_id, r.reps, r.load_kg,
       r.performed_at, r.with_load, r.metric, r.previous_best, r.load_unit
from records r
join public.exercises e on e.id = r.exercise_id
where r.rn = 1;

grant select on public.personal_records to authenticated;
