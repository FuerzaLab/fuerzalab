-- =====================================================================
-- VIGÉSIMA MIGRACIÓN DE LA PARTE 4 (Cobro a alumnos: pausado / activo)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
-- Requiere part4q_migration.sql.
--
-- Interruptor general del cobro a alumnos (platform_settings.student_billing_enabled).
-- Arranca APAGADO (etapa de prueba): ningún alumno recibe avisos de pago ni
-- se le pausa la app, aunque su fecha venza. Las fechas se siguen guardando.
-- Al prenderlo con admin_start_student_billing(días), cada alumno que no
-- sea "sin cobro" recibe al menos esos días desde hoy para pagar (por
-- ejemplo 15, el aviso previo que piden los Términos).
-- =====================================================================

alter table public.platform_settings add column if not exists student_billing_enabled boolean not null default false;

create or replace function public.admin_start_student_billing(p_days int default 15)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  if not coalesce(public.is_super_admin(), false) then
    raise exception 'Solo el Super Admin.' using errcode = '42501';
  end if;
  perform set_config('app.internal', '1', true);
  update public.clients
     set access_until = greatest(coalesce(access_until, current_date), current_date + greatest(coalesce(p_days, 15), 0))
   where profile_id is not null and status <> 'archived' and not student_billing_exempt;
  get diagnostics v_count = row_count;
  update public.platform_settings set student_billing_enabled = true, updated_at = now() where id = 1;
  return v_count;
end $$;
grant execute on function public.admin_start_student_billing(int) to authenticated;

create or replace function public.my_org_billing() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_p public.profiles%rowtype;
  v_o public.organizations%rowtype;
  v_plan public.platform_plans%rowtype;
  v_next public.organization_subscriptions%rowtype;
  v_owner_view boolean;
  v_c public.clients%rowtype;
  v_s public.platform_settings%rowtype;
begin
  select * into v_p from public.profiles where id = auth.uid();
  if not found or v_p.organization_id is null then return null; end if;
  select * into v_o from public.organizations where id = v_p.organization_id;
  if v_p.role = 'client' then
    select * into v_c from public.clients c where c.profile_id = v_p.id order by (c.status <> 'archived') desc limit 1;
    select * into v_s from public.platform_settings where id = 1;
    return jsonb_build_object(
      'role', 'client',
      'suspended', v_o.status = 'suspended',
      'client_blocked', v_o.status = 'suspended' or (v_o.billing_blocked_since is not null and current_date >= v_o.billing_blocked_since + 7),
      -- Alumno nuevo cuyo cupo todavía no se pagó: puede llenar su formulario, no ve su rutina.
      'seat_pending', coalesce(v_c.seat_pending, false),
      -- Plan del alumno con FuerzaLab (part4q).
      'access_until', v_c.access_until,
      'student_exempt', coalesce(v_c.student_billing_exempt, false),
      'grace_days', coalesce(v_s.grace_days, 7),
      'reminder_days', coalesce(v_s.reminder_days, 5),
      'student_pending_payment', exists (select 1 from public.student_payments sp where sp.client_id = v_c.id and sp.status = 'pending'),
      'student_billing_enabled', coalesce(v_s.student_billing_enabled, false),
      'student_blocked', coalesce(v_s.student_billing_enabled, false)
                         and not coalesce(v_c.student_billing_exempt, false) and v_c.access_until is not null
                         and current_date > v_c.access_until + coalesce(v_s.grace_days, 7));
  end if;
  select * into v_plan from public.platform_plans where id = v_o.plan_id;
  select * into v_next from public.organization_subscriptions
   where organization_id = v_o.id and kind = 'period' and status in ('pending', 'overdue') order by due_date limit 1;
  v_owner_view := v_p.role in ('trainer', 'staff');
  return jsonb_build_object(
    'role', v_p.role,
    'organization', v_o.name,
    'suspended', v_o.status = 'suspended',
    'exempt', v_o.billing_exempt,
    'blocked_since', v_o.billing_blocked_since,
    'trial_ends_at', v_o.trial_ends_at,
    'limit_exceeded_since', v_o.limit_exceeded_since,
    'active_clients', public.org_active_clients(v_o.id),
    'counted_clients', public.org_counted_clients(v_o.id),
    'plan', case when v_plan.id is null then null else jsonb_build_object(
      'name', v_plan.name, 'price', v_plan.price, 'currency', v_plan.currency, 'period', v_plan.billing_period,
      'included_clients', v_plan.included_clients, 'price_per_client', v_plan.price_per_client,
      'client_limit', v_plan.client_limit, 'trainer_limit', v_plan.trainer_limit) end,
    'estimated_amount', public.org_period_amount(v_o.id),
    'next_due', case when v_next.id is null then null else jsonb_build_object(
      'due_date', v_next.due_date, 'amount', v_next.amount, 'currency', v_next.currency) end,
    'seat_mode', public.org_seat_mode(v_o.id),
    'seats_capacity', case public.org_seat_mode(v_o.id) when 'trial' then v_o.trial_free_clients when 'paid' then v_o.paid_seats else null end,
    'seats_used', v_o.seats_used,
    'trial_free_clients', v_o.trial_free_clients,
    'pending_clients', (select count(*) from public.clients c where c.organization_id = v_o.id and c.seat_pending and c.status in ('active', 'prospect')),
    'pending_seats', (select jsonb_build_object('amount', s.amount, 'currency', s.currency, 'due_date', s.due_date, 'count', s.seats_count)
                        from public.organization_subscriptions s
                       where s.organization_id = v_o.id and s.kind = 'seats' and s.status in ('pending', 'overdue')
                       order by s.created_at desc limit 1)
  );
end $$;
grant execute on function public.my_org_billing() to authenticated;
