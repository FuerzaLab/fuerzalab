-- =====================================================================
-- DECIMOSÉPTIMA MIGRACIÓN DE LA PARTE 4 (Cobro por alumno)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
-- Requiere part3y, part4a y part4p.
--
-- Nuevo modelo: FuerzaLab es GRATIS para entrenadores y estudios; cada
-- ALUMNO le paga a FuerzaLab su plan (mensual, trimestral, semestral o
-- anual) por QR y sube el comprobante, que el Super Admin confirma.
--
--  1. Cobro a organizaciones APAGADO (no borrado): todas quedan "sin cobro"
--     (billing_exempt), sin cupos ni bloqueos. Los alumnos que esperaban
--     cupo quedan habilitados. Las organizaciones nuevas tienen 30 días de
--     prueba (es la "etapa de prueba" de su entrenador).
--  2. platform_settings: etapa de prueba sí/no, días gratis (30), días de
--     gracia (7), aviso previo (5), imagen del QR, titular de la cuenta.
--  3. student_plans: los planes del alumno y sus precios (los cargas tú;
--     arrancan inactivos hasta que tengan precio).
--  4. clients.access_until (hasta qué día tiene la app) y
--     clients.student_billing_exempt (alumno sin cobro). Solo el Super Admin
--     los cambia. Al registrarse, el alumno recibe:
--       - en etapa de prueba: hasta el fin de la prueba de su entrenador;
--       - después: 30 días gratis desde su registro.
--     Los alumnos que ya tienen cuenta reciben al menos 30 días desde hoy.
--     Las organizaciones demo no cobran.
--  5. student_payments: los pagos del alumno con su comprobante. El monto
--     sale del plan (el alumno no lo puede cambiar). Al aprobarlo, el plan
--     se suma a partir del día en que vence el actual (o desde hoy, si ya
--     venció).
--  6. Bucket "platform-files": el QR (lo ven todos) y los comprobantes
--     (solo el alumno que lo subió y el Super Admin).
--  7. my_org_billing() le dice a la app del alumno hasta cuándo tiene la app
--     y si está suspendido (más de 7 días después del vencimiento).
--     El entrenador NUNCA pierde el acceso a los datos de sus alumnos.
-- =====================================================================

-- 1. Cobro a organizaciones apagado ----------------------------------------
alter table public.organizations alter column billing_exempt set default true;

create or replace function public.org_set_trial() returns trigger language plpgsql as $$
begin
  if new.trial_ends_at is null then
    new.trial_ends_at := now() + interval '30 days';
  end if;
  return new;
end $$;

do $$
begin
  perform set_config('app.internal', '1', true);
  update public.organizations set billing_exempt = true where not billing_exempt;
  update public.organizations set billing_blocked_since = null where billing_blocked_since is not null;
  update public.clients set seat_pending = false where seat_pending;
end $$;

-- 2. Ajustes de la plataforma -----------------------------------------------
create table if not exists public.platform_settings (
  id             int primary key default 1 check (id = 1),
  beta_mode      boolean not null default true,
  free_days      int not null default 30 check (free_days >= 0),
  grace_days     int not null default 7 check (grace_days >= 0),
  reminder_days  int not null default 5 check (reminder_days >= 0),
  qr_path        text,
  qr_expires_on  date,
  account_holder text not null default 'Mario Ernesto Rodas Arce',
  bank_name      text,
  updated_at     timestamptz not null default now()
);
insert into public.platform_settings (id) values (1) on conflict (id) do nothing;

alter table public.platform_settings enable row level security;
drop policy if exists p_select on public.platform_settings;
drop policy if exists p_update on public.platform_settings;
create policy p_select on public.platform_settings for select to authenticated using (true);
create policy p_update on public.platform_settings for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- 3. Planes del alumno -----------------------------------------------------
create table if not exists public.student_plans (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  months     int not null check (months > 0),
  price      numeric(10,2) not null default 0 check (price >= 0),
  currency   text not null default 'Bs',
  active     boolean not null default false,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);

insert into public.student_plans (name, months, sort)
select v.name, v.months, v.sort
from (values ('Mensual', 1, 1), ('Trimestral', 3, 2), ('Semestral', 6, 3), ('Anual', 12, 4)) as v(name, months, sort)
where not exists (select 1 from public.student_plans);

alter table public.student_plans enable row level security;
drop policy if exists p_select on public.student_plans;
drop policy if exists p_write on public.student_plans;
create policy p_select on public.student_plans for select to authenticated using (active or public.is_super_admin());
create policy p_write on public.student_plans for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- 4. Hasta cuándo tiene la app cada alumno ------------------------------
alter table public.clients add column if not exists access_until date;
alter table public.clients add column if not exists student_billing_exempt boolean not null default false;

-- Solo el Super Admin (o la propia base de datos) cambia el plan de un alumno.
create or replace function public.clients_protect_student_access() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('app.internal', true), '') = '1' or coalesce(public.is_super_admin(), false) then
    return new;
  end if;
  new.access_until := old.access_until;
  new.student_billing_exempt := old.student_billing_exempt;
  return new;
end $$;
drop trigger if exists a_protect_student_access on public.clients;
create trigger a_protect_student_access before update on public.clients
  for each row execute function public.clients_protect_student_access();

-- Al registrarse (cuando la ficha queda vinculada a su cuenta): días gratis.
create or replace function public.clients_init_student_access() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_s public.platform_settings%rowtype;
  v_trial date;
  v_demo boolean;
begin
  if new.profile_id is null or new.access_until is not null then return new; end if;
  if tg_op = 'UPDATE' and old.profile_id is not null then return new; end if;
  select * into v_s from public.platform_settings where id = 1;
  select o.trial_ends_at::date, o.name ilike '%demo%' into v_trial, v_demo
    from public.organizations o where o.id = new.organization_id;
  if coalesce(v_demo, false) then
    new.student_billing_exempt := true;
  end if;
  if coalesce(v_s.beta_mode, true) and v_trial is not null and v_trial >= current_date then
    new.access_until := v_trial;
  else
    new.access_until := current_date + coalesce(v_s.free_days, 30);
  end if;
  return new;
end $$;
drop trigger if exists b_init_student_access on public.clients;
create trigger b_init_student_access before insert or update of profile_id on public.clients
  for each row execute function public.clients_init_student_access();

-- Alumnos que ya tienen cuenta: al menos 30 días desde hoy (o hasta el fin de la prueba de su entrenador, si es más tarde).
do $$
begin
  perform set_config('app.internal', '1', true);
  update public.clients c
     set access_until = greatest(coalesce(o.trial_ends_at::date, current_date), current_date + 30),
         student_billing_exempt = c.student_billing_exempt or o.name ilike '%demo%'
    from public.organizations o
   where o.id = c.organization_id and c.profile_id is not null and c.access_until is null;
end $$;

-- 5. Pagos del alumno ----------------------------------------------------------
create table if not exists public.student_payments (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  plan_id         uuid references public.student_plans(id) on delete set null,
  plan_name       text,
  months          int,
  amount          numeric(10,2),
  currency        text not null default 'Bs',
  receipt_path    text,
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  note            text,
  period_start    date,
  period_end      date,
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  reviewed_at     timestamptz,
  reviewed_by     uuid
);
create index if not exists idx_student_payments_client on public.student_payments (client_id);
create index if not exists idx_student_payments_status on public.student_payments (status);

-- El alumno solo elige el plan: nombre, meses y monto salen del plan.
create or replace function public.student_payments_fill() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_plan public.student_plans%rowtype;
begin
  select organization_id into new.organization_id from public.clients where id = new.client_id;
  if coalesce(public.is_super_admin(), false) and new.months is not null and new.amount is not null then
    new.plan_name := coalesce(new.plan_name, 'Pago registrado');
    return new;
  end if;
  select * into v_plan from public.student_plans where id = new.plan_id and active;
  if not found then
    raise exception 'Ese plan no está disponible.' using errcode = 'P0001';
  end if;
  new.plan_name := v_plan.name;
  new.months := v_plan.months;
  new.amount := v_plan.price;
  new.currency := v_plan.currency;
  if not coalesce(public.is_super_admin(), false) then
    if exists (select 1 from public.student_payments p where p.client_id = new.client_id and p.status = 'pending') then
      raise exception 'Ya enviaste un comprobante que está en revisión. Apenas lo confirmemos, se actualiza tu plan.' using errcode = 'P0001';
    end if;
    new.status := 'pending';
    new.period_start := null;
    new.period_end := null;
    new.reviewed_at := null;
    new.reviewed_by := null;
    new.note := null;
  end if;
  return new;
end $$;
drop trigger if exists a_fill on public.student_payments;
create trigger a_fill before insert on public.student_payments
  for each row execute function public.student_payments_fill();

alter table public.student_payments enable row level security;
drop policy if exists p_select on public.student_payments;
drop policy if exists p_insert on public.student_payments;
drop policy if exists p_admin on public.student_payments;
create policy p_select on public.student_payments for select to authenticated
  using (public.is_super_admin()
         or client_id = public.my_client_id()
         or exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = auth.uid()));
create policy p_insert on public.student_payments for insert to authenticated
  with check (client_id = public.my_client_id());
create policy p_admin on public.student_payments for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- Aprobar o rechazar un comprobante (solo Super Admin).
create or replace function public.admin_review_student_payment(p_id uuid, p_approve boolean, p_note text default null)
returns public.student_payments
language plpgsql security definer set search_path = public as $$
declare
  v_p public.student_payments%rowtype;
  v_until date;
  v_start date;
  v_end date;
begin
  if not coalesce(public.is_super_admin(), false) then
    raise exception 'Solo el Super Admin puede confirmar pagos.' using errcode = '42501';
  end if;
  select * into v_p from public.student_payments where id = p_id for update;
  if not found then raise exception 'No se encontró el pago.'; end if;
  if v_p.status <> 'pending' then raise exception 'Este pago ya fue revisado.'; end if;
  if not p_approve then
    update public.student_payments
       set status = 'rejected', note = nullif(btrim(coalesce(p_note, '')), ''), reviewed_at = now(), reviewed_by = auth.uid()
     where id = p_id returning * into v_p;
    return v_p;
  end if;
  select access_until into v_until from public.clients where id = v_p.client_id for update;
  v_start := case when v_until is not null and v_until >= current_date then v_until else current_date end;
  v_end := (v_start + make_interval(months => v_p.months))::date;
  perform set_config('app.internal', '1', true);
  update public.clients set access_until = v_end where id = v_p.client_id;
  update public.student_payments
     set status = 'approved', period_start = v_start, period_end = v_end,
         note = nullif(btrim(coalesce(p_note, '')), ''), reviewed_at = now(), reviewed_by = auth.uid()
   where id = p_id returning * into v_p;
  return v_p;
end $$;
grant execute on function public.admin_review_student_payment(uuid, boolean, text) to authenticated;

-- Registrar un pago a mano (por ejemplo, en efectivo) y aprobarlo de una vez.
create or replace function public.admin_add_student_payment(p_client uuid, p_plan uuid, p_amount numeric default null, p_note text default null)
returns public.student_payments
language plpgsql security definer set search_path = public as $$
declare
  v_plan public.student_plans%rowtype;
  v_id uuid;
begin
  if not coalesce(public.is_super_admin(), false) then
    raise exception 'Solo el Super Admin puede registrar pagos.' using errcode = '42501';
  end if;
  select * into v_plan from public.student_plans where id = p_plan;
  if not found then raise exception 'Elige un plan.'; end if;
  insert into public.student_payments (client_id, plan_id, plan_name, months, amount, currency, note)
  values (p_client, v_plan.id, v_plan.name, v_plan.months, coalesce(p_amount, v_plan.price), v_plan.currency, p_note)
  returning id into v_id;
  return public.admin_review_student_payment(v_id, true, p_note);
end $$;
grant execute on function public.admin_add_student_payment(uuid, uuid, numeric, text) to authenticated;

-- Cambiar a mano hasta cuándo tiene la app un alumno, o dejarlo sin cobro.
create or replace function public.admin_set_student_access(p_client uuid, p_until date, p_exempt boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(public.is_super_admin(), false) then
    raise exception 'Solo el Super Admin.' using errcode = '42501';
  end if;
  perform set_config('app.internal', '1', true);
  update public.clients set access_until = p_until, student_billing_exempt = coalesce(p_exempt, false) where id = p_client;
end $$;
grant execute on function public.admin_set_student_access(uuid, date, boolean) to authenticated;

-- Lista para el panel "Pagos de alumnos" (solo Super Admin).
create or replace function public.admin_students_billing()
returns table (
  client_id uuid, client_name text, client_status text, has_account boolean,
  access_until date, exempt boolean,
  organization_id uuid, organization_name text, trainer_name text,
  last_paid_at timestamptz, last_plan text, pending_payments int
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(public.is_super_admin(), false) then
    raise exception 'Solo el Super Admin puede ver este panel.' using errcode = '42501';
  end if;
  return query
  select c.id, c.full_name, c.status, c.profile_id is not null,
         c.access_until, c.student_billing_exempt,
         c.organization_id, o.name, p.full_name,
         (select max(sp.reviewed_at) from public.student_payments sp where sp.client_id = c.id and sp.status = 'approved'),
         (select sp.plan_name from public.student_payments sp where sp.client_id = c.id and sp.status = 'approved' order by sp.reviewed_at desc limit 1),
         (select count(*)::int from public.student_payments sp where sp.client_id = c.id and sp.status = 'pending')
  from public.clients c
  join public.organizations o on o.id = c.organization_id
  left join public.profiles p on p.id = c.trainer_id
  where c.status <> 'archived' and c.profile_id is not null
  order by c.access_until nulls last, c.full_name;
end $$;
grant execute on function public.admin_students_billing() to authenticated;

-- 6. Archivos: QR y comprobantes ------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('platform-files', 'platform-files', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

drop policy if exists platform_files_select on storage.objects;
drop policy if exists platform_files_insert on storage.objects;
drop policy if exists platform_files_admin on storage.objects;
-- qr/...                    : lo ve cualquiera con cuenta; lo sube el Super Admin.
-- receipts/{client_id}/...  : lo sube y lo ve el alumno; lo ve el Super Admin.
create policy platform_files_select on storage.objects for select to authenticated
  using (bucket_id = 'platform-files' and (
           (storage.foldername(name))[1] = 'qr'
           or public.is_super_admin()
           or ((storage.foldername(name))[1] = 'receipts' and (storage.foldername(name))[2] = public.my_client_id()::text)));
create policy platform_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'platform-files'
              and (storage.foldername(name))[1] = 'receipts'
              and (storage.foldername(name))[2] = public.my_client_id()::text);
create policy platform_files_admin on storage.objects for all to authenticated
  using (bucket_id = 'platform-files' and public.is_super_admin())
  with check (bucket_id = 'platform-files' and public.is_super_admin());

-- 7. Lo que la app del alumno sabe de su plan -----------------------------
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
      'student_blocked', not coalesce(v_c.student_billing_exempt, false) and v_c.access_until is not null
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
