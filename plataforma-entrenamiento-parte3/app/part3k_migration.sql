-- =====================================================================
-- DÉCIMA MIGRACIÓN DE LA PARTE 3 (Agenda del entrenador)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- Crea una tabla nueva (no toca ninguna de las que ya tenés), para que el
-- entrenador pueda armar su agenda: citas presenciales o asesorías online
-- con sus clientes, en un horario y fecha puntuales.
-- =====================================================================

create table public.trainer_appointments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  trainer_id      uuid not null references public.profiles(id) on delete cascade,
  client_id       uuid references public.clients(id) on delete set null,
  kind            text not null default 'in_person' check (kind in ('in_person', 'online')),
  title           text,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  notes           text,
  created_at      timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index idx_trainer_appointments_trainer on public.trainer_appointments (trainer_id, starts_at);
create index idx_trainer_appointments_client on public.trainer_appointments (client_id) where client_id is not null;

alter table public.trainer_appointments enable row level security;

-- El entrenador ve y administra su propia agenda. Un asistente (staff) con
-- permiso de escritura sobre "programs" también puede verla y editarla, en
-- nombre del entrenador al que está vinculado — mismo criterio que ya usan
-- las rutinas y las plantillas.
create policy p_select on public.trainer_appointments for select to authenticated
  using (
    trainer_id = auth.uid()
    or (public.auth_role() = 'staff' and public.staff_can(trainer_id, 'programs', 'read'))
  );

create policy p_write on public.trainer_appointments for all to authenticated
  using (
    trainer_id = auth.uid()
    or (public.auth_role() = 'staff' and public.staff_can(trainer_id, 'programs', 'write'))
  )
  with check (
    trainer_id = auth.uid()
    or (public.auth_role() = 'staff' and public.staff_can(trainer_id, 'programs', 'write'))
  );
