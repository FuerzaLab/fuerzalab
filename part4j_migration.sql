-- =====================================================================
-- DÉCIMA MIGRACIÓN DE LA PARTE 4 (Pruebas de rendimiento)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- Evaluaciones → "Rendimiento: potencia, velocidad y funcionales":
-- saltos (CMJ, SJ, drop jump), lanzamiento de balón medicinal, sprints con
-- parciales, sprint lanzado, cambio de dirección (505, 5-10-5),
-- dinamometría de mano, sentarse y levantarse (30 s y 5 repeticiones) y
-- velocidad de marcha. Cada prueba guarda sus intentos, el mejor valor y lo
-- que se calcula (potencia estimada, RSI, velocidad, asimetrías…).
-- Permisos como el resto de las evaluaciones: el entrenador (y su asistente
-- con permiso de Evaluaciones) carga y edita; el alumno las ve.
-- =====================================================================

create table if not exists public.performance_tests (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  trainer_id      uuid not null,
  client_id       uuid not null,
  assessment_id   uuid not null references public.assessments(id) on delete cascade,
  test_key        text not null,
  side            text check (side in ('left', 'right')),
  trials          numeric[] not null default '{}',
  value           numeric,
  details         jsonb not null default '{}',
  computed        jsonb not null default '{}',
  notes           text,
  created_at      timestamptz not null default now()
);
create index if not exists performance_tests_client_idx on public.performance_tests (client_id, test_key);
create index if not exists performance_tests_assessment_idx on public.performance_tests (assessment_id);

-- Organización, entrenador y alumno salen siempre de la evaluación.
create or replace function public.performance_tests_fill() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select a.organization_id, a.trainer_id, a.client_id into new.organization_id, new.trainer_id, new.client_id
    from public.assessments a where a.id = new.assessment_id;
  if new.client_id is null then raise exception 'Evaluación inexistente.'; end if;
  return new;
end $$;
drop trigger if exists a_fill on public.performance_tests;
create trigger a_fill before insert or update of assessment_id on public.performance_tests
  for each row execute function public.performance_tests_fill();

alter table public.performance_tests enable row level security;
drop policy if exists p_select on public.performance_tests;
drop policy if exists p_insert on public.performance_tests;
drop policy if exists p_update on public.performance_tests;
drop policy if exists p_delete on public.performance_tests;
create policy p_select on public.performance_tests for select to authenticated using (
  public.is_trainer_scope(organization_id, trainer_id)
  or (organization_id = public.auth_org() and public.staff_can(trainer_id, 'assessments', 'read'))
  or public.is_super_admin()
  or public.is_own_client(client_id, organization_id)
);
create policy p_insert on public.performance_tests for insert to authenticated with check (
  public.is_trainer_scope(organization_id, trainer_id)
  or (organization_id = public.auth_org() and public.staff_can(trainer_id, 'assessments', 'write'))
);
create policy p_update on public.performance_tests for update to authenticated
  using (public.is_trainer_scope(organization_id, trainer_id)
         or (organization_id = public.auth_org() and public.staff_can(trainer_id, 'assessments', 'write')))
  with check (public.is_trainer_scope(organization_id, trainer_id)
         or (organization_id = public.auth_org() and public.staff_can(trainer_id, 'assessments', 'write')));
create policy p_delete on public.performance_tests for delete to authenticated using (
  public.is_trainer_scope(organization_id, trainer_id)
  or (organization_id = public.auth_org() and public.staff_can(trainer_id, 'assessments', 'write'))
);
