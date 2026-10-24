-- =====================================================================
-- NOVENA MIGRACIÓN DE LA PARTE 3 (Planes y pagos de la plataforma, para
-- el Super Admin)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- Crea dos tablas nuevas (no toca ninguna de las que ya tenés). Son
-- completamente separadas de "Pagos" del entrenador — esto es para
-- cobrarle a cada organización por usar la plataforma, no para que un
-- entrenador le cobre a sus clientes. Solo el Super Admin puede verlas.
-- =====================================================================

create table public.platform_plans (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  client_limit    int,  -- null = sin límite
  trainer_limit   int,  -- null = sin límite
  price           numeric not null check (price >= 0),
  currency        text not null default 'Bs',
  billing_period  text not null default 'monthly' check (billing_period in ('monthly', 'quarterly', 'annual')),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create table public.organization_subscriptions (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  platform_plan_id  uuid references public.platform_plans(id) on delete set null,
  status            text not null default 'pending' check (status in ('pending', 'paid', 'overdue', 'cancelled')),
  amount            numeric not null check (amount >= 0),
  currency          text not null default 'Bs',
  due_date          date not null,
  paid_at           timestamptz,
  method            text,
  notes             text,
  created_at        timestamptz not null default now()
);

create index idx_org_subscriptions_org on public.organization_subscriptions (organization_id, due_date desc);

alter table public.platform_plans enable row level security;
alter table public.organization_subscriptions enable row level security;

-- Solo el Super Admin puede ver o tocar esto — ni el entrenador ni el
-- cliente deberían saber nada de la facturación de la plataforma.
create policy p_select on public.platform_plans for select to authenticated using (public.is_super_admin());
create policy p_insert on public.platform_plans for insert to authenticated with check (public.is_super_admin());
create policy p_update on public.platform_plans for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy p_delete on public.platform_plans for delete to authenticated using (public.is_super_admin());

create policy p_select on public.organization_subscriptions for select to authenticated using (public.is_super_admin());
create policy p_insert on public.organization_subscriptions for insert to authenticated with check (public.is_super_admin());
create policy p_update on public.organization_subscriptions for update to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy p_delete on public.organization_subscriptions for delete to authenticated using (public.is_super_admin());
