-- =====================================================================
-- DECIMOSÉPTIMA MIGRACIÓN DE LA PARTE 3 (Inicio: novedades de los clientes)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- Dos cosas nuevas, ninguna toca tablas existentes:
--
-- 1. dashboard_dismissals: qué novedades de Inicio ya marcó cada usuario
--    como "atendida", para que no le vuelvan a aparecer. Es por persona:
--    si un asistente marca algo como atendido, al entrenador le sigue
--    apareciendo (y al revés).
--
-- 2. personal_records (vista): los récords personales de los clientes en
--    los últimos 45 días. Un récord es una serie que supera la mejor marca
--    ANTERIOR de ese cliente en ese ejercicio: en ejercicios con carga se
--    compara el 1RM estimado (Epley: carga × (1 + reps/30)); en ejercicios
--    sin carga, las repeticiones. La primera vez que alguien hace un
--    ejercicio no cuenta como récord (no hay marca anterior que superar).
--    La vista respeta las reglas de seguridad de siempre (security_invoker):
--    cada uno ve solo los récords de los clientes que ya podía ver.
-- =====================================================================

create table if not exists public.dashboard_dismissals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  item_key     text not null,
  dismissed_at timestamptz not null default now(),
  unique (user_id, item_key)
);

alter table public.dashboard_dismissals enable row level security;

drop policy if exists p_own on public.dashboard_dismissals;
create policy p_own on public.dashboard_dismissals for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace view public.personal_records
with (security_invoker = true) as
with sets as (
  select
    s.id,
    s.client_id,
    s.exercise_id,
    s.workout_log_id,
    s.reps,
    s.load_kg,
    s.performed_at,
    (coalesce(s.load_kg, 0) > 0) as with_load,
    case
      when coalesce(s.load_kg, 0) > 0 and s.reps = 1 then s.load_kg
      when coalesce(s.load_kg, 0) > 0 then round((s.load_kg * (1 + s.reps / 30.0)) * 2) / 2
      else s.reps
    end as metric
  from public.workout_set_logs s
  where s.completed and s.reps > 0
),
ranked as (
  select
    sets.*,
    max(metric) over (
      partition by client_id, exercise_id, with_load
      order by performed_at, id
      rows between unbounded preceding and 1 preceding
    ) as previous_best
  from sets
),
records as (
  select *,
    row_number() over (partition by client_id, exercise_id, with_load, performed_at::date order by metric desc, id) as rn
  from ranked
  where previous_best is not null and metric > previous_best
    and performed_at >= now() - interval '45 days'
)
select r.id, r.client_id, r.exercise_id, e.name as exercise_name, r.workout_log_id, r.reps, r.load_kg,
       r.performed_at, r.with_load, r.metric, r.previous_best
from records r
join public.exercises e on e.id = r.exercise_id
where r.rn = 1;

grant select on public.personal_records to authenticated;
