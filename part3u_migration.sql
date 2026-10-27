-- =====================================================================
-- VIGÉSIMA MIGRACIÓN DE LA PARTE 3 (Vista del dueño del estudio)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- En un estudio con varios entrenadores, cada entrenador ve solo a sus
-- alumnos. Esto agrega la figura del DUEÑO del estudio: un entrenador de
-- la organización (lo elige el Super Admin) que además ve una pantalla
-- "Tu estudio" con el resumen de todo el equipo.
--
--  * organizations.owner_id: quién es el dueño (columna nueva, vacía).
--  * studio_trainer_stats(mes): números por entrenador del mes elegido
--    (alumnos, entrenamientos, adherencia, evaluaciones, bienestar, cobros).
--  * studio_inactive_clients(días): alumnos activos que no completan un
--    entrenamiento hace N días o más.
--
-- Las dos funciones devuelven datos ya resumidos y solo responden si quien
-- pregunta es el dueño de SU organización: el dueño no gana acceso general
-- a las fichas, rutinas ni salud de los alumnos de los demás entrenadores.
-- No modifica ninguna regla existente.
-- =====================================================================

alter table public.organizations
  add column if not exists owner_id uuid references public.profiles(id) on delete set null;

create or replace function public.is_studio_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    public.auth_role() = 'trainer'
    and exists (select 1 from public.organizations o where o.id = public.auth_org() and o.owner_id = auth.uid()),
    false)
$$;
grant execute on function public.is_studio_owner() to authenticated;

create or replace function public.studio_trainer_stats(p_month_start date)
returns table (
  trainer_id uuid, full_name text, email text, is_active boolean, last_sign_in_at timestamptz,
  clients_active int, clients_paused int, clients_prospect int,
  sessions_scheduled int, workouts_completed int, workouts_skipped int,
  assessments int, wellness_logs int, wellness_red_7d int,
  paid_amount numeric, pending_amount numeric, overdue_amount numeric, currency text
)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_org uuid := public.auth_org();
  v_from date := date_trunc('month', p_month_start)::date;
  v_to date := least((date_trunc('month', p_month_start) + interval '1 month - 1 day')::date, current_date);
  v_month_end date := (date_trunc('month', p_month_start) + interval '1 month - 1 day')::date;
begin
  if not public.is_studio_owner() then
    raise exception 'Solo el dueño del estudio puede ver este resumen.';
  end if;

  return query
  with trainers as (
    select p.id, p.full_name, p.email, p.is_active, p.last_sign_in_at
    from public.profiles p
    where p.organization_id = v_org and p.role = 'trainer'
  ),
  cl as (
    select c.trainer_id,
           count(*) filter (where c.status = 'active')   as active,
           count(*) filter (where c.status = 'paused')   as paused,
           count(*) filter (where c.status = 'prospect') as prospect
    from public.clients c where c.organization_id = v_org group by c.trainer_id
  ),
  w1 as (
    select w.program_id, w.start_date from public.weeks w
    where w.week_number = 1 and w.start_date is not null and w.organization_id = v_org
  ),
  sched as (
    select pr.trainer_id, count(*) as n
    from public.sessions s
    join public.weeks w on w.id = s.week_id
    join public.programs pr on pr.id = s.program_id
    join w1 on w1.program_id = s.program_id
    where pr.organization_id = v_org and pr.status = 'active' and not pr.is_template and s.day_of_week is not null
      and (w1.start_date + (w.week_number - 1) * 7 + (s.day_of_week - 1)) between v_from and v_to
    group by pr.trainer_id
  ),
  wl as (
    select l.trainer_id,
           count(*) filter (where l.status = 'completed' and l.completed_at::date between v_from and v_month_end) as done,
           count(*) filter (where l.status = 'skipped' and l.updated_at::date between v_from and v_month_end) as skipped
    from public.workout_logs l where l.organization_id = v_org group by l.trainer_id
  ),
  ev as (
    select a.trainer_id, count(*) as n from public.assessments a
    where a.organization_id = v_org and a.assessed_at between v_from and v_month_end group by a.trainer_id
  ),
  wb as (
    select x.trainer_id,
           count(*) filter (where x.log_date between v_from and v_month_end) as logs,
           count(*) filter (where x.log_date >= current_date - 6
                              and (x.sleep_quality + x.fatigue + x.energy + x.stress + x.soreness) < 15) as red
    from public.wellness_logs x where x.organization_id = v_org group by x.trainer_id
  ),
  pay as (
    select y.trainer_id,
           coalesce(sum(y.amount) filter (where y.status = 'paid' and y.paid_at::date between v_from and v_month_end), 0) as paid,
           coalesce(sum(y.amount) filter (where y.status = 'pending' and y.due_date >= current_date), 0) as pending,
           coalesce(sum(y.amount) filter (where y.status = 'pending' and y.due_date < current_date), 0) as overdue,
           mode() within group (order by y.currency) as cur
    from public.payments y where y.organization_id = v_org group by y.trainer_id
  )
  select t.id, t.full_name, t.email, t.is_active, t.last_sign_in_at,
         coalesce(cl.active, 0)::int, coalesce(cl.paused, 0)::int, coalesce(cl.prospect, 0)::int,
         coalesce(sched.n, 0)::int, coalesce(wl.done, 0)::int, coalesce(wl.skipped, 0)::int,
         coalesce(ev.n, 0)::int, coalesce(wb.logs, 0)::int, coalesce(wb.red, 0)::int,
         coalesce(pay.paid, 0), coalesce(pay.pending, 0), coalesce(pay.overdue, 0), pay.cur
  from trainers t
  left join cl on cl.trainer_id = t.id
  left join sched on sched.trainer_id = t.id
  left join wl on wl.trainer_id = t.id
  left join ev on ev.trainer_id = t.id
  left join wb on wb.trainer_id = t.id
  left join pay on pay.trainer_id = t.id
  order by t.full_name;
end $$;
grant execute on function public.studio_trainer_stats(date) to authenticated;

create or replace function public.studio_inactive_clients(p_days int default 10)
returns table (client_id uuid, client_name text, trainer_name text, last_workout_at timestamptz, days_inactive int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_org uuid := public.auth_org();
begin
  if not public.is_studio_owner() then
    raise exception 'Solo el dueño del estudio puede ver este resumen.';
  end if;

  return query
  select c.id, c.full_name, t.full_name, lw.last_at,
         (current_date - coalesce(lw.last_at::date, c.created_at::date))::int
  from public.clients c
  join public.profiles t on t.id = c.trainer_id
  left join lateral (
    select max(l.completed_at) as last_at from public.workout_logs l
    where l.client_id = c.id and l.status = 'completed'
  ) lw on true
  where c.organization_id = v_org and c.status = 'active'
    and coalesce(lw.last_at::date, c.created_at::date) <= current_date - p_days
  order by 5 desc
  limit 100;
end $$;
grant execute on function public.studio_inactive_clients(int) to authenticated;
