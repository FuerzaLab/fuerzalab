-- =====================================================================
-- VIGESIMOQUINTA MIGRACIÓN DE LA PARTE 3 (Cobro por adelantado y avisos de cobro)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
-- Requiere haber corrido antes part3y_migration.sql.
--
--  1. Cobro por adelantado: el día que empieza cada período (su
--     vencimiento), el monto se recalcula con los alumnos activos de ese
--     día — una sola vez, y solo si el Super Admin no lo editó a mano. Los
--     alumnos que se suman a mitad del período se cobran desde el siguiente.
--  2. Si ese monto da 0 (ningún alumno activo), el cobro se marca pagado solo,
--     y no bloquea a nadie.
--  3. Nuevos avisos para el Super Admin en Novedades de la plataforma: cobro
--     que vence en 3 días o menos, y cobro que vence hoy.
-- =====================================================================

alter table public.organization_subscriptions add column if not exists auto_amount boolean not null default true;
alter table public.organization_subscriptions add column if not exists amount_recalculated_at timestamptz;

alter table public.platform_events drop constraint if exists platform_events_kind_check;
alter table public.platform_events add constraint platform_events_kind_check
  check (kind in ('client_added', 'trainer_added', 'limit_exceeded', 'org_blocked', 'trial_ending', 'payment_due_soon', 'payment_due_today'));

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
       where s.organization_id = p_org and s.status in ('pending', 'overdue')
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
       where s.organization_id = p_org and s.status in ('pending', 'overdue')
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

-- Los cobros de 0 que ya existan y estén vencidos se resuelven en el próximo
-- recálculo (al entrar alguien de la organización o al abrir el panel).
