-- =====================================================================
-- PRIMERA MIGRACIÓN DE LA PARTE 4 (Cupos de alumnos pagados por adelantado)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
-- Requiere haber corrido antes part3y_migration.sql y part3z_migration.sql.
--
-- Para los planes que cobran POR ALUMNO:
--  * Cada organización tiene CUPOS pagados para el período (los alumnos que
--    pagó al empezarlo). Un alumno nuevo por encima de esos cupos queda
--    "pendiente de pago": puede registrarse y llenar su formulario de
--    ingreso, pero no ve su rutina, y su entrenador no puede entrenar con
--    él, hasta que se pague su cupo.
--  * En el momento se genera un cobro de CUPOS, proporcional a los días que
--    faltan del período (los que se suman el mismo día van en un solo
--    cobro), con 2 días para pagarlo. No bloquea la cuenta: solo deja en
--    espera a esos alumnos. Al marcarlo pagado, se activan solos.
--  * Los cupos NO se reutilizan: si se da de baja un alumno a mitad del
--    período, otro alumno nuevo igual paga su cupo. Dar de baja sirve para
--    no pagarlo desde el período siguiente.
--  * Al pagar el cobro del período siguiente, entran todos los que
--    esperaban (ya están incluidos en el monto) y los cupos se reinician.
--  * Prueba gratis: hasta 3 alumnos (configurable por organización en
--    "Plan y prueba"). Los que se sumen por encima quedan pendientes hasta
--    que se pague el primer período.
--  * Para cobrar, ahora cuentan los alumnos que ocupan un cupo: activos e
--    invitados (los que esperan su pago incluidos). Los en pausa o dados de
--    baja no se cobran.
--  * Las organizaciones "Sin cobro" (la demo) y los planes sin precio por
--    alumno no tienen cupos: funcionan como antes.
-- =====================================================================

alter table public.organizations add column if not exists paid_seats int;  -- vacío = todavía sin contar
alter table public.organizations add column if not exists seats_used int not null default 0;
alter table public.organizations add column if not exists trial_free_clients int not null default 3 check (trial_free_clients >= 0);
alter table public.organization_subscriptions add column if not exists kind text not null default 'period' check (kind in ('period', 'seats'));
alter table public.organization_subscriptions add column if not exists seats_count int;
alter table public.clients add column if not exists seat_pending boolean not null default false;
alter table public.clients add column if not exists seat_charge_id uuid references public.organization_subscriptions(id) on delete set null;

alter table public.platform_events drop constraint if exists platform_events_kind_check;
alter table public.platform_events add constraint platform_events_kind_check
  check (kind in ('client_added', 'trainer_added', 'limit_exceeded', 'org_blocked', 'trial_ending',
                  'payment_due_soon', 'payment_due_today', 'seats_requested'));

-- Qué control de cupos tiene una organización: 'none' (ninguno), 'trial' (prueba con N gratis) o 'paid'.
create or replace function public.org_seat_mode(p_org uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when o.billing_exempt then 'none'
    when o.trial_ends_at is not null and o.trial_ends_at > now()
         and not exists (select 1 from public.organization_subscriptions s
                          where s.organization_id = o.id and s.kind = 'period' and s.status = 'paid') then 'trial'
    when coalesce(p.price_per_client, 0) > 0 then 'paid'
    else 'none' end
  from public.organizations o
  left join public.platform_plans p on p.id = o.plan_id
  where o.id = p_org
$$;

-- Nadie (salvo el Super Admin y la propia base de datos) puede cambiar a mano si un alumno espera su pago.
create or replace function public.clients_protect_seat() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('app.internal', true), '') = '1' or public.is_super_admin() then
    return new;
  end if;
  new.seat_pending := old.seat_pending;
  new.seat_charge_id := old.seat_charge_id;
  return new;
end $$;
drop trigger if exists a_protect_seat on public.clients;
create trigger a_protect_seat before update on public.clients
  for each row execute function public.clients_protect_seat();

-- Al sumar un alumno (o reactivar uno dado de baja): ¿tiene cupo, o queda esperando su pago?
create or replace function public.clients_seat_gate() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_mode text;
  v_org public.organizations%rowtype;
  v_plan public.platform_plans%rowtype;
  v_cap int;
  v_start date;
  v_end date;
  v_unit numeric;
  v_charge public.organization_subscriptions%rowtype;
begin
  if new.status not in ('active', 'prospect') then return new; end if;
  if tg_op = 'UPDATE' and old.status in ('active', 'prospect') then return new; end if;
  if coalesce(current_setting('app.internal', true), '') = '1' then return new; end if;

  v_mode := public.org_seat_mode(new.organization_id);
  if v_mode is null or v_mode = 'none' then
    new.seat_pending := false;
    return new;
  end if;

  select * into v_org from public.organizations where id = new.organization_id for update;
  -- Primera vez: los alumnos que ya tiene cuentan como cupos pagados (nadie pierde nada).
  if v_org.paid_seats is null then
    v_org.paid_seats := public.org_counted_clients(new.organization_id);
    v_org.seats_used := v_org.paid_seats;
    update public.organizations set paid_seats = v_org.paid_seats, seats_used = v_org.seats_used where id = v_org.id;
  end if;

  v_cap := case v_mode when 'trial' then v_org.trial_free_clients else v_org.paid_seats end;
  if v_org.seats_used < v_cap then
    update public.organizations set seats_used = seats_used + 1 where id = v_org.id;
    new.seat_pending := false;
    return new;
  end if;

  -- Sin cupo: queda esperando su pago.
  new.seat_pending := true;
  if v_mode = 'trial' then
    return new;  -- en la prueba, entran al pagar el primer período
  end if;

  -- Cobro de cupos, proporcional a lo que falta del período.
  select * into v_plan from public.platform_plans where id = v_org.plan_id;
  select max(s.due_date) into v_start from public.organization_subscriptions s
   where s.organization_id = v_org.id and s.kind = 'period' and s.due_date <= current_date and s.status <> 'cancelled';
  if v_start is not null then
    v_end := case v_plan.billing_period
               when 'biweekly' then v_start + 14
               when 'quarterly' then (v_start + interval '3 months')::date
               when 'annual' then (v_start + interval '1 year')::date
               else (v_start + interval '1 month')::date end;
  end if;
  v_unit := v_plan.price_per_client
            * case when v_start is null or v_end <= v_start then 1
                   else greatest(0, least(1, (v_end - current_date)::numeric / (v_end - v_start))) end;

  select * into v_charge from public.organization_subscriptions s
   where s.organization_id = v_org.id and s.kind = 'seats' and s.status = 'pending' and s.created_at::date = current_date
   order by s.created_at desc limit 1;
  if found then
    update public.organization_subscriptions
       set seats_count = coalesce(seats_count, 0) + 1, amount = round(amount + v_unit, 2)
     where id = v_charge.id;
    update public.platform_events
       set payload = payload || jsonb_build_object('count', coalesce(v_charge.seats_count, 0) + 1, 'amount', round(v_charge.amount + v_unit, 2)),
           seen_at = null
     where kind = 'seats_requested' and payload->>'subscription_id' = v_charge.id::text;
  else
    insert into public.organization_subscriptions (organization_id, platform_plan_id, kind, seats_count, status, amount, currency, due_date, notes)
    values (v_org.id, v_org.plan_id, 'seats', 1, 'pending', round(v_unit, 2), coalesce(v_plan.currency, 'Bs'), current_date + 2,
            'Cupos para alumnos nuevos' || case when v_end is not null then ' (proporcional hasta el ' || to_char(v_end, 'DD/MM') || ')' else '' end)
    returning * into v_charge;
    insert into public.platform_events (kind, organization_id, trainer_id, payload)
    values ('seats_requested', v_org.id, new.trainer_id, jsonb_build_object(
      'organization', v_org.name, 'subscription_id', v_charge.id, 'count', 1, 'amount', v_charge.amount,
      'currency', v_charge.currency, 'due_date', v_charge.due_date));
  end if;
  new.seat_charge_id := v_charge.id;
  return new;
end $$;
drop trigger if exists c_seat_gate on public.clients;
create trigger c_seat_gate before insert or update of status on public.clients
  for each row execute function public.clients_seat_gate();

create or replace function public.org_period_amount(p_org uuid, p_plan uuid default null) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare
  v_plan public.platform_plans%rowtype;
  -- Cuentan los alumnos que ocupan un cupo: activos e invitados, incluidos los que esperan el pago de su cupo.
  v_active int := public.org_counted_clients(p_org);
begin
  -- Solo el Super Admin, o alguien de esa misma organización (o un trigger interno).
  if auth.uid() is not null and not public.is_super_admin()
     and p_org is distinct from (select organization_id from public.profiles where id = auth.uid()) then
    return null;
  end if;
  select * into v_plan from public.platform_plans
   where id = coalesce(p_plan, (select plan_id from public.organizations where id = p_org));
  if not found then return null; end if;
  return v_plan.price
       + case when v_plan.included_clients is null then 0
              else greatest(0, v_active - v_plan.included_clients) * v_plan.price_per_client end;
end $$;

create or replace function public.compute_org_billing(p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_org public.organizations%rowtype;
  v_since date;
  v_sub public.organization_subscriptions%rowtype;
  v_amount numeric;
  v_kind text;
begin
  select * into v_org from public.organizations where id = p_org;
  if not found then return; end if;

  if not v_org.billing_exempt then
    -- Cobro por adelantado: el día que empieza el período (vencimiento) se
    -- recalcula el monto con los alumnos activos de ese día, una sola vez y
    -- solo si nadie lo editó a mano. Si da 0 (sin alumnos), se marca pagado.
    for v_sub in
      select * from public.organization_subscriptions s
       where s.organization_id = p_org and s.kind = 'period' and s.status in ('pending', 'overdue')
         and s.due_date <= current_date and s.auto_amount and s.amount_recalculated_at is null
    loop
      v_amount := coalesce(public.org_period_amount(p_org, v_sub.platform_plan_id), v_sub.amount);
      if v_amount <= 0 then
        update public.organization_subscriptions
           set amount = 0, amount_recalculated_at = now(), status = 'paid', paid_at = now(),
               notes = trim(coalesce(notes, '') || ' Sin alumnos activos al empezar el período: Bs 0, marcado como pagado solo.')
         where id = v_sub.id;
      else
        update public.organization_subscriptions set amount = v_amount, amount_recalculated_at = now() where id = v_sub.id;
      end if;
    end loop;

    -- Avisos al Super Admin: cobro que vence en 3 días o menos, y cobro que vence hoy (una vez por cobro).
    for v_sub in
      select * from public.organization_subscriptions s
       where s.organization_id = p_org and s.kind = 'period' and s.status in ('pending', 'overdue')
         and s.due_date between current_date and current_date + 3
    loop
      v_kind := case when v_sub.due_date = current_date then 'payment_due_today' else 'payment_due_soon' end;
      if not exists (select 1 from public.platform_events e where e.kind = v_kind and e.payload->>'subscription_id' = v_sub.id::text) then
        insert into public.platform_events (kind, organization_id, payload)
        values (v_kind, p_org, jsonb_build_object(
          'organization', v_org.name, 'subscription_id', v_sub.id, 'amount', v_sub.amount,
          'currency', v_sub.currency, 'due_date', v_sub.due_date));
      end if;
    end loop;
  end if;

  if not v_org.billing_exempt then
    -- Cobro vencido sin pagar: bloqueado desde el día siguiente al vencimiento.
    select min(s.due_date) + 1 into v_since
      from public.organization_subscriptions s
     where s.organization_id = p_org and s.kind = 'period' and s.status in ('pending', 'overdue') and s.due_date < current_date;

    -- Prueba terminada sin ningún cobro pagado ni pendiente a futuro.
    if v_since is null and v_org.trial_ends_at is not null and v_org.trial_ends_at::date < current_date
       and not exists (
         select 1 from public.organization_subscriptions s
          where s.organization_id = p_org and s.kind = 'period'
            and (s.status = 'paid' or (s.status in ('pending', 'overdue') and s.due_date >= current_date))
       ) then
      v_since := v_org.trial_ends_at::date + 1;
    end if;
  end if;

  -- Aviso al Super Admin: la prueba termina en 3 días o menos (una sola vez por organización).
  if not v_org.billing_exempt and v_org.trial_ends_at is not null
     and v_org.trial_ends_at > now() and v_org.trial_ends_at < now() + interval '3 days'
     and not exists (select 1 from public.platform_events e where e.organization_id = p_org and e.kind = 'trial_ending') then
    insert into public.platform_events (kind, organization_id, payload)
    values ('trial_ending', p_org, jsonb_build_object('organization', v_org.name, 'trial_ends_at', v_org.trial_ends_at));
  end if;

  if v_since is distinct from v_org.billing_blocked_since then
    update public.organizations set billing_blocked_since = v_since where id = p_org;
    if v_since is not null and v_org.billing_blocked_since is null then
      insert into public.platform_events (kind, organization_id, payload)
      values ('org_blocked', p_org, jsonb_build_object('since', v_since, 'organization', v_org.name));
    end if;
  end if;
end $$;

create or replace function public.org_subscription_changed() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_period text;
  v_next date;
  v_n int;
begin
  -- Se pagó un cobro de CUPOS: se activan los alumnos que esperaban ese pago.
  if tg_op <> 'DELETE' and new.kind = 'seats' and new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    perform set_config('app.internal', '1', true);
    update public.clients set seat_pending = false
     where seat_charge_id = new.id and seat_pending;
    get diagnostics v_n = row_count;
    update public.organizations set paid_seats = coalesce(paid_seats, 0) + v_n, seats_used = seats_used + v_n where id = new.organization_id;
    perform set_config('app.internal', '', true);
  end if;

  -- Se pagó un cobro de PERÍODO: entran todos los alumnos que esperaban (ya
  -- están incluidos en el monto del período) y los cupos se reinician con
  -- los alumnos que tiene hoy.
  if tg_op <> 'DELETE' and new.kind = 'period' and new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    perform set_config('app.internal', '1', true);
    update public.clients set seat_pending = false, seat_charge_id = null
     where organization_id = new.organization_id and seat_pending;
    update public.organization_subscriptions set status = 'cancelled',
           notes = trim(coalesce(notes, '') || ' Incluido en el cobro del período.')
     where organization_id = new.organization_id and kind = 'seats' and status in ('pending', 'overdue');
    update public.organizations
       set paid_seats = public.org_counted_clients(new.organization_id),
           seats_used = public.org_counted_clients(new.organization_id)
     where id = new.organization_id;
    perform set_config('app.internal', '', true);
  end if;

  if tg_op <> 'DELETE' and new.kind = 'period' and new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    select p.billing_period into v_period from public.platform_plans p where p.id = new.platform_plan_id;
    if v_period is not null and not exists (
      select 1 from public.organization_subscriptions s
       where s.organization_id = new.organization_id and s.kind = 'period' and s.status in ('pending', 'overdue') and s.id <> new.id
    ) then
      v_next := case v_period
                  when 'biweekly' then new.due_date + 14
                  when 'monthly' then (new.due_date + interval '1 month')::date
                  when 'quarterly' then (new.due_date + interval '3 months')::date
                  when 'annual' then (new.due_date + interval '1 year')::date
                end;
      insert into public.organization_subscriptions (organization_id, platform_plan_id, status, amount, currency, due_date, notes)
      values (new.organization_id, new.platform_plan_id, 'pending',
              coalesce(public.org_period_amount(new.organization_id, new.platform_plan_id), new.amount),
              new.currency, v_next, 'Creado automáticamente al pagar el período anterior');
    end if;
  end if;
  perform public.compute_org_billing(coalesce(new.organization_id, old.organization_id));
  return null;
end $$;

create or replace function public.my_org_billing() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_p public.profiles%rowtype;
  v_o public.organizations%rowtype;
  v_plan public.platform_plans%rowtype;
  v_next public.organization_subscriptions%rowtype;
  v_owner_view boolean;
begin
  select * into v_p from public.profiles where id = auth.uid();
  if not found or v_p.organization_id is null then return null; end if;
  select * into v_o from public.organizations where id = v_p.organization_id;
  if v_p.role = 'client' then
    return jsonb_build_object(
      'role', 'client',
      'suspended', v_o.status = 'suspended',
      'client_blocked', v_o.status = 'suspended' or (v_o.billing_blocked_since is not null and current_date >= v_o.billing_blocked_since + 7),
      -- Alumno nuevo cuyo cupo todavía no se pagó: puede llenar su formulario, no ve su rutina.
      'seat_pending', coalesce((select c.seat_pending from public.clients c where c.profile_id = v_p.id limit 1), false));
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
grant execute on function public.org_seat_mode(uuid) to authenticated;

-- Las organizaciones que cobran por alumno arrancan con sus alumnos de hoy como cupos pagados.
update public.organizations o
   set paid_seats = public.org_counted_clients(o.id), seats_used = public.org_counted_clients(o.id)
 where o.paid_seats is null and public.org_seat_mode(o.id) = 'paid';
