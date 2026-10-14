-- =====================================================================
-- CUARTA MIGRACIÓN DE LA PARTE 3 (Cuestionario de bienestar diario)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- Si ya habías corrido una versión anterior de este mismo archivo, esta
-- la reemplaza por la versión final, basada en tu propia planilla
-- WAPerformance (Wellness_Diario). Como la tabla es nueva y recién se
-- entregó, no debería haber datos de prueba cargados; si los hubiera, se
-- perderían al recrearla.
--
-- 5 parámetros subjetivos (1 a 5, donde 5 siempre es el mejor estado),
-- más horas de sueño reales y localización del dolor si corresponde.
-- El cliente lo completa al iniciar su rutina programada, una vez por
-- día. El entrenador puede dejar una nota de "ajuste aplicado" frente a
-- una alerta.
-- =====================================================================

drop table if exists public.wellness_logs cascade;

create table public.wellness_logs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  trainer_id      uuid not null,
  client_id       uuid not null references public.clients(id) on delete cascade,
  log_date        date not null default current_date,
  sleep_hours     numeric(4,1),
  sleep_quality   smallint not null check (sleep_quality between 1 and 5),
  fatigue         smallint not null check (fatigue between 1 and 5),
  energy          smallint not null check (energy between 1 and 5),
  stress          smallint not null check (stress between 1 and 5),
  soreness        smallint not null check (soreness between 1 and 5),
  pain_location   text,
  notes           text,
  trainer_adjustment text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (client_id, log_date)
);

create index idx_wellness_logs_client_date on public.wellness_logs (client_id, log_date desc);

create trigger a_inherit_scope before insert on public.wellness_logs
  for each row execute function public.inherit_scope('clients', 'client_id');

create trigger a_guard_scope before update on public.wellness_logs
  for each row execute function public.guard_scope_columns();

create trigger z_set_updated_at before update on public.wellness_logs
  for each row execute function public.set_updated_at();

-- El cliente puede crear y corregir su propio registro del día, pero
-- solo en los campos del cuestionario — "ajuste aplicado" queda
-- protegido a nivel de base de datos, no solo oculto en la pantalla,
-- para que solo el entrenador pueda escribirlo.
create trigger b_guard_client_update before update on public.wellness_logs
  for each row execute function public.guard_client_update(
    'sleep_hours', 'sleep_quality', 'fatigue', 'energy', 'stress', 'soreness',
    'pain_location', 'notes', 'updated_at');

select public._apply_data_policies('wellness_logs', 'health', p_super => false,
  p_client_insert => 'true', p_client_update => 'true');
