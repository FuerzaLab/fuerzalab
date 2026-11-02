-- =====================================================================
-- VIGESIMOCUARTA MIGRACIÓN DE LA PARTE 3 (Cobro a organizaciones)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- ⚠ ANTES DE CORRER: hasta ahora "Suspender" una organización no bloqueaba
-- nada. Desde esta migración SÍ bloquea (a sus entrenadores, asistentes y
-- alumnos). Revisa en Super Admin → Organizaciones que no haya suspendida
-- ninguna que deba seguir funcionando — en particular, la de tu propia
-- cuenta de entrenador. (El Super Admin nunca se bloquea.)
--
-- Qué agrega:
--  1. Planes con cobro por alumno: precio base + alumnos incluidos +
--     precio por alumno extra (o solo por alumno: base 0, incluidos 0).
--     client_limit sigue siendo el TOPE de alumnos (vacío = sin tope).
--  2. Cada organización con su plan, su prueba gratis (14 días, las nuevas)
--     y la opción "exenta de cobro" (para la demo).
--  3. Suspensión automática: un día después de un cobro vencido sin pagar
--     (o del fin de la prueba sin ningún cobro registrado) se bloquea a los
--     entrenadores y asistentes; los alumnos siguen entrenando 7 días más.
--     Se reactiva sola al marcar el cobro como pagado.
--  4. Tope de alumnos con 7 días de margen: al superarlo se avisa; pasados
--     7 días, no se pueden sumar alumnos nuevos hasta cambiar de plan.
--  5. Al marcar un cobro como pagado, se crea solo el del período siguiente.
--  6. Novedades de la plataforma para el Super Admin: alumnos y entrenadores
--     nuevos, topes superados y organizaciones suspendidas.
-- =====================================================================

-- 1. Planes ------------------------------------------------------------
alter table public.platform_plans add column if not exists included_clients int check (included_clients is null or included_clients >= 0);
alter table public.platform_plans add column if not exists price_per_client numeric not null default 0 check (price_per_client >= 0);

-- 2. Organizaciones ------------------------------------------------------
alter table public.organizations add column if not exists plan_id uuid references public.platform_plans(id) on delete set null;
alter table public.organizations add column if not exists trial_ends_at timestamptz;
alter table public.organizations add column if not exists billing_exempt boolean not null default false;
alter table public.organizations add column if not exists billing_blocked_since date;
alter table public.organizations add column if not exists limit_exceeded_since timestamptz;

-- Las organizaciones NUEVAS arrancan con 14 días de prueba.
create or replace function public.org_set_trial() returns trigger language plpgsql as $$
begin
  if new.trial_ends_at is null and not new.billing_exempt then
    new.trial_ends_at := now() + interval '14 days';
  end if;
  return new;
end $$;
drop trigger if exists a_set_trial on public.organizations;
create trigger a_set_trial before insert on public.organizations
  for each row execute function public.org_set_trial();

-- 6. Novedades de la plataforma -----------------------------------------
create table if not exists public.platform_events (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  kind            text not null check (kind in ('client_added', 'trainer_added', 'limit_exceeded', 'org_blocked', 'trial_ending')),
  organization_id uuid references public.organizations(id) on delete cascade,
  trainer_id      uuid references public.profiles(id) on delete set null,
  payload         jsonb not null default '{}'::jsonb,
  seen_at         timestamptz
);
create index if not exists idx_platform_events_created on public.platform_events (created_at desc);
alter table public.platform_events enable row level security;
drop policy if exists p_select on public.platform_events;
drop policy if exists p_update on public.platform_events;
create policy p_select on public.platform_events for select to authenticated using (public.is_super_admin());
create policy p_update on public.platform_events for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- Alumnos que cuentan para el plan.
create or replace function public.org_active_clients(p_org uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.clients where organization_id = p_org and status = 'active'
$$;
-- Para el tope se cuentan también los invitados que todavía no aceptaron.
create or replace function public.org_counted_clients(p_org uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.clients where organization_id = p_org and status in ('active', 'prospect')
$$;

-- Monto de un período: base + alumnos activos por encima de los incluidos × precio por alumno.
create or replace function public.org_period_amount(p_org uuid, p_plan uuid default null) returns numeric
language plpgsql stable security definer set search_path = public as $$
declare
  v_plan public.platform_plans%rowtype;
  v_active int := public.org_active_clients(p_org);
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

-- 3. Estado de cobro de una organización --------------------------------
create or replace function public.compute_org_billing(p_org uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_org public.organizations%rowtype;
  v_since date;
begin
  select * into v_org from public.organizations where id = p_org;
  if not found then return; end if;

  if not v_org.billing_exempt then
    -- Cobro vencido sin pagar: bloqueado desde el día siguiente al vencimiento.
    select min(s.due_date) + 1 into v_since
      from public.organization_subscriptions s
     where s.organization_id = p_org and s.status in ('pending', 'overdue') and s.due_date < current_date;

    -- Prueba terminada sin ningún cobro pagado ni pendiente a futuro.
    if v_since is null and v_org.trial_ends_at is not null and v_org.trial_ends_at::date < current_date
       and not exists (
         select 1 from public.organization_subscriptions s
          where s.organization_id = p_org
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

-- Lo llama la app al iniciar sesión (para la organización propia)…
create or replace function public.refresh_my_org_billing() returns void
language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.profiles where id = auth.uid();
  if v_org is not null then perform public.compute_org_billing(v_org); end if;
end $$;
grant execute on function public.refresh_my_org_billing() to authenticated;

-- …y el Super Admin, al abrir su panel (para todas).
create or replace function public.refresh_all_org_billing() returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not public.is_super_admin() then return; end if;
  for r in select id from public.organizations loop perform public.compute_org_billing(r.id); end loop;
end $$;
grant execute on function public.refresh_all_org_billing() to authenticated;

-- Al registrar, editar o pagar un cobro: se recalcula el estado, y si quedó
-- pagado, se crea solo el cobro del período siguiente.
create or replace function public.org_subscription_changed() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_period text;
  v_next date;
begin
  if tg_op <> 'DELETE' and new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
    select p.billing_period into v_period from public.platform_plans p where p.id = new.platform_plan_id;
    if v_period is not null and not exists (
      select 1 from public.organization_subscriptions s
       where s.organization_id = new.organization_id and s.status in ('pending', 'overdue') and s.id <> new.id
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
drop trigger if exists z_subscription_changed on public.organization_subscriptions;
create trigger z_subscription_changed after insert or update or delete on public.organization_subscriptions
  for each row execute function public.org_subscription_changed();

-- Si el Super Admin cambia la prueba o la exención, se recalcula.
create or replace function public.org_billing_settings_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.compute_org_billing(new.id);
  return null;
end $$;
drop trigger if exists z_billing_settings_changed on public.organizations;
create trigger z_billing_settings_changed after update of trial_ends_at, billing_exempt, plan_id on public.organizations
  for each row execute function public.org_billing_settings_changed();

-- 3b. El bloqueo se aplica en la base de datos ----------------------------
-- auth_role() y auth_org() son las que usan TODAS las reglas de seguridad:
-- si devuelven vacío, la persona no ve ni toca nada. El Super Admin no se
-- bloquea nunca. Suspensión a mano: todos. Falta de pago: entrenadores y
-- asistentes desde el día del bloqueo; alumnos, 7 días después.
create or replace function public.auth_role() returns text
language sql stable security definer set search_path = public as $$
  select p.role from public.profiles p
  left join public.organizations o on o.id = p.organization_id
  where p.id = auth.uid() and p.is_active
    and (p.role = 'super_admin' or o.id is null or (
      o.status <> 'suspended'
      and (o.billing_blocked_since is null
           or current_date < o.billing_blocked_since + case when p.role = 'client' then 7 else 0 end)))
$$;

create or replace function public.auth_org() returns uuid
language sql stable security definer set search_path = public as $$
  select p.organization_id from public.profiles p
  left join public.organizations o on o.id = p.organization_id
  where p.id = auth.uid() and p.is_active
    and (p.role = 'super_admin' or o.id is null or (
      o.status <> 'suspended'
      and (o.billing_blocked_since is null
           or current_date < o.billing_blocked_since + case when p.role = 'client' then 7 else 0 end)))
$$;

-- Qué le pasa a mi cuenta (para mostrar el motivo del bloqueo y los avisos).
-- Funciona aunque la persona esté bloqueada.
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
      'client_blocked', v_o.status = 'suspended' or (v_o.billing_blocked_since is not null and current_date >= v_o.billing_blocked_since + 7));
  end if;
  select * into v_plan from public.platform_plans where id = v_o.plan_id;
  select * into v_next from public.organization_subscriptions
   where organization_id = v_o.id and status in ('pending', 'overdue') order by due_date limit 1;
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
      'due_date', v_next.due_date, 'amount', v_next.amount, 'currency', v_next.currency) end
  );
end $$;
grant execute on function public.my_org_billing() to authenticated;

-- 4. Tope de alumnos con 7 días de margen ---------------------------------
create or replace function public.clients_check_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_org public.organizations%rowtype;
  v_cap int;
begin
  if new.status not in ('active', 'prospect') then return new; end if;
  if tg_op = 'UPDATE' and old.status in ('active', 'prospect') then return new; end if;
  select * into v_org from public.organizations where id = new.organization_id;
  select client_limit into v_cap from public.platform_plans where id = v_org.plan_id;
  if v_cap is null or v_org.billing_exempt then return new; end if;
  if v_org.limit_exceeded_since is not null and v_org.limit_exceeded_since < now() - interval '7 days'
     and public.org_counted_clients(new.organization_id) >= v_cap then
    raise exception 'Tu plan permite hasta % alumnos y el margen de 7 días ya terminó. Para sumar alumnos nuevos, cambia de plan (o da de baja a alguno).', v_cap
      using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists b_check_client_limit on public.clients;
create trigger b_check_client_limit before insert or update of status on public.clients
  for each row execute function public.clients_check_limit();

create or replace function public.clients_after_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_org public.organizations%rowtype;
  v_cap int;
  v_count int;
  v_trainer text;
begin
  select * into v_org from public.organizations where id = coalesce(new.organization_id, old.organization_id);
  if not found then return null; end if;
  select client_limit into v_cap from public.platform_plans where id = v_org.plan_id;
  v_count := public.org_counted_clients(v_org.id);

  -- ¿Superó el tope? (Se marca el momento, para los 7 días de margen.)
  if v_cap is not null and v_count > v_cap and v_org.limit_exceeded_since is null then
    update public.organizations set limit_exceeded_since = now() where id = v_org.id;
    if not v_org.billing_exempt then
      insert into public.platform_events (kind, organization_id, payload)
      values ('limit_exceeded', v_org.id, jsonb_build_object('organization', v_org.name, 'clients', v_count, 'limit', v_cap));
    end if;
  elsif (v_cap is null or v_count <= v_cap) and v_org.limit_exceeded_since is not null then
    update public.organizations set limit_exceeded_since = null where id = v_org.id;
  end if;

  -- Novedad para el Super Admin: alumno nuevo (no para las exentas, como la demo,
  -- que vuelve a crear sus alumnos de ejemplo todos los días).
  if tg_op = 'INSERT' and not v_org.billing_exempt then
    select full_name into v_trainer from public.profiles where id = new.trainer_id;
    insert into public.platform_events (kind, organization_id, trainer_id, payload)
    values ('client_added', v_org.id, new.trainer_id, jsonb_build_object(
      'organization', v_org.name, 'trainer', v_trainer, 'client', new.full_name,
      'active_clients', public.org_active_clients(v_org.id), 'counted_clients', v_count));
  end if;
  return null;
end $$;
drop trigger if exists z_clients_after_change on public.clients;
create trigger z_clients_after_change after insert or update of status or delete on public.clients
  for each row execute function public.clients_after_change();

-- Si cambian el plan de una organización, se revisa el tope de nuevo.
create or replace function public.org_plan_changed() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cap int; v_count int;
begin
  select client_limit into v_cap from public.platform_plans where id = new.plan_id;
  v_count := public.org_counted_clients(new.id);
  if (v_cap is null or v_count <= v_cap) and new.limit_exceeded_since is not null then
    update public.organizations set limit_exceeded_since = null where id = new.id;
  elsif v_cap is not null and v_count > v_cap and new.limit_exceeded_since is null then
    update public.organizations set limit_exceeded_since = now() where id = new.id;
  end if;
  return null;
end $$;
drop trigger if exists z_plan_changed on public.organizations;
create trigger z_plan_changed after update of plan_id on public.organizations
  for each row execute function public.org_plan_changed();

-- Novedad para el Super Admin: entrenador nuevo.
create or replace function public.profiles_trainer_added() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'trainer' and new.organization_id is not null
     and not coalesce((select billing_exempt from public.organizations where id = new.organization_id), false) then
    insert into public.platform_events (kind, organization_id, trainer_id, payload)
    values ('trainer_added', new.organization_id, new.id, jsonb_build_object(
      'organization', (select name from public.organizations where id = new.organization_id), 'trainer', new.full_name));
  end if;
  return null;
end $$;
drop trigger if exists z_trainer_added on public.profiles;
create trigger z_trainer_added after insert on public.profiles
  for each row execute function public.profiles_trainer_added();

-- La organización de la demo no se cobra (si existe con ese nombre).
update public.organizations set billing_exempt = true where name ilike '%demo%';

grant execute on function public.org_period_amount(uuid, uuid) to authenticated;
