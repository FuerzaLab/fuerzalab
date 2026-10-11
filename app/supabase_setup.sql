-- =====================================================================
-- PLATAFORMA DE ENTRENAMIENTO — FASE 3 / PASO 1: BASE DE DATOS
-- Supabase (PostgreSQL). Ejecutar COMPLETO en: SQL Editor > New query.
--
-- Contenido:
--   1. Tablas
--   2. Funciones auxiliares (seguridad)
--   3. Triggers (alta por invitación, alcance, métricas, updated_at)
--   4. Vistas
--   5. Row Level Security (políticas)
--   6. Storage (buckets y políticas)
--   7. Índices y permisos de funciones
--
-- Convenciones:
--   * Cada tabla de datos de cliente lleva organization_id, trainer_id, client_id.
--     En tablas hijas, esas columnas las rellena un trigger desde el padre
--     (el cliente de la app NO necesita enviarlas y no puede falsificarlas).
--   * Permisos de staff (staff_permissions.permissions, jsonb), por módulo:
--       {"clients":"read","health":"none","assessments":"write", ...}
--     Módulos: clients, health, assessments, exercises, programs, logs,
--              messages, payments, reports, files, analytics.
--     Niveles: "read" | "write" (write incluye read). Sin clave = sin acceso.
--   * Los estados se guardan como text + CHECK (más fácil de evolucionar).
--   * "Vencido" (pagos) es derivado: ver vista payments_with_status.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLAS
-- ---------------------------------------------------------------------

-- A. Identidad y clientes ---------------------------------------------

create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  status      text not null default 'active' check (status in ('active','suspended')),
  logo_path   text,
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete restrict,
  role            text not null check (role in ('super_admin','trainer','staff','client')),
  full_name       text not null default '',
  email           text not null,
  phone           text,
  avatar_path     text,
  locale          text not null default 'es',
  timezone        text not null default 'UTC',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint profiles_org_required check (role = 'super_admin' or organization_id is not null)
);

create table if not exists public.clients (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  trainer_id      uuid not null references public.profiles(id) on delete restrict,
  profile_id      uuid unique references public.profiles(id) on delete set null,
  full_name       text not null,
  email           text,
  phone           text,
  status          text not null default 'active' check (status in ('prospect','active','paused','archived')),
  start_date      date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.client_profiles (
  client_id         uuid primary key references public.clients(id) on delete cascade,
  organization_id   uuid not null,
  trainer_id        uuid not null,
  birth_date        date,
  sex               text check (sex in ('male','female','other')),
  height_cm         numeric check (height_cm > 0),
  training_level    text check (training_level in ('beginner','intermediate','advanced','elite')),
  sports_history    text,
  injuries          text,
  medical_notes     text,
  emergency_contact jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Notas internas del entrenador (el cliente NUNCA las ve)
create table if not exists public.client_notes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  trainer_id      uuid not null,
  client_id       uuid not null references public.clients(id) on delete cascade,
  body            text not null,
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invited_by      uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  role            text not null check (role in ('trainer','staff','client')),
  email           text,
  full_name       text,
  code            text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
  trainer_id      uuid references public.profiles(id) on delete cascade,
  client_id       uuid references public.clients(id) on delete cascade,
  permissions     jsonb not null default '{}'::jsonb,
  status          text not null default 'pending' check (status in ('pending','accepted','expired','revoked')),
  expires_at      timestamptz not null default (now() + interval '14 days'),
  accepted_by     uuid references public.profiles(id) on delete set null,
  accepted_at     timestamptz,
  created_at      timestamptz not null default now(),
  constraint invitations_trainer_required check (role = 'trainer' or trainer_id is not null)
);

create table if not exists public.staff_permissions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  staff_id        uuid not null references public.profiles(id) on delete cascade,
  trainer_id      uuid not null references public.profiles(id) on delete cascade,
  permissions     jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (staff_id, trainer_id)
);

create table if not exists public.client_goals (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  trainer_id      uuid not null,
  client_id       uuid not null references public.clients(id) on delete cascade,
  category        text not null check (category in ('strength','hypertrophy','power','endurance','mobility','body_comp','other')),
  title           text not null,
  metric_key      text,
  target_value    numeric,
  unit            text,
  target_date     date,
  status          text not null default 'active' check (status in ('active','achieved','dropped')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- B. Biblioteca de ejercicios -----------------------------------------

create table if not exists public.catalog_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,  -- null = global
  kind            text not null check (kind in ('muscle_group','movement_pattern','equipment','category')),
  key             text not null,
  label           text not null,
  sort_order      int not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);
create unique index if not exists catalog_items_unique
  on public.catalog_items (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), kind, key);

create table if not exists public.exercises (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid references public.organizations(id) on delete cascade,
  owner_id             uuid references public.profiles(id) on delete set null,
  scope                text not null default 'trainer' check (scope in ('global','organization','trainer')),
  name                 text not null,
  description          text,
  category_id          uuid references public.catalog_items(id) on delete set null,
  primary_muscle_id    uuid references public.catalog_items(id) on delete set null,
  secondary_muscle_ids uuid[] not null default '{}',
  movement_pattern_id  uuid references public.catalog_items(id) on delete set null,
  equipment_ids        uuid[] not null default '{}',
  difficulty           text check (difficulty in ('beginner','intermediate','advanced')),
  goals                text[] not null default '{}',
  instructions         text,
  technical_cues       text,
  common_mistakes      text,
  considerations       text,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint exercises_scope_consistency check (
    (scope = 'global' and organization_id is null and owner_id is null)
    or (scope in ('organization','trainer') and organization_id is not null and owner_id is not null)
  )
);

create table if not exists public.exercise_media (
  id            uuid primary key default gen_random_uuid(),
  exercise_id   uuid not null references public.exercises(id) on delete cascade,
  kind          text not null check (kind in ('image','video_file','video_url')),
  storage_path  text,
  external_url  text,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  constraint exercise_media_source check (
    (kind = 'video_url' and external_url is not null)
    or (kind <> 'video_url' and storage_path is not null)
  )
);

create table if not exists public.exercise_variations (
  id                  uuid primary key default gen_random_uuid(),
  exercise_id         uuid not null references public.exercises(id) on delete cascade,
  related_exercise_id uuid not null references public.exercises(id) on delete cascade,
  relation            text not null check (relation in ('variant','progression','regression')),
  sort_order          int not null default 0,
  notes               text,
  created_at          timestamptz not null default now(),
  unique (exercise_id, related_exercise_id, relation),
  check (exercise_id <> related_exercise_id)
);

-- C. Evaluaciones ------------------------------------------------------

create table if not exists public.assessments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  trainer_id      uuid not null,
  client_id       uuid not null references public.clients(id) on delete cascade,
  assessed_at     date not null default current_date,
  type            text not null default 'periodic' check (type in ('initial','periodic','ad_hoc','self_report')),
  status          text not null default 'completed' check (status in ('draft','completed')),
  performed_by    uuid default auth.uid(),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.body_measurements (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  trainer_id      uuid not null,
  client_id       uuid not null,
  assessment_id   uuid not null unique references public.assessments(id) on delete cascade,
  weight_kg       numeric not null check (weight_kg > 0),
  height_cm       numeric,
  bmi             numeric,
  body_fat_pct    numeric,
  fat_mass_kg     numeric,
  muscle_mass_kg  numeric,
  lean_mass_kg    numeric,
  method          text,
  extra           jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.circumferences (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  trainer_id      uuid not null,
  client_id       uuid not null,
  assessment_id   uuid not null references public.assessments(id) on delete cascade,
  site            text not null check (site in ('neck','shoulders','chest','waist','hip','arm','forearm','thigh','calf','custom')),
  custom_label    text,
  side            text not null default 'none' check (side in ('left','right','none')),
  value_cm        numeric not null check (value_cm > 0),
  created_at      timestamptz not null default now(),
  constraint circumferences_custom_label check (site <> 'custom' or custom_label is not null)
);

create table if not exists public.skinfolds (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  trainer_id      uuid not null,
  client_id       uuid not null,
  assessment_id   uuid not null references public.assessments(id) on delete cascade,
  site            text not null,
  side            text check (side in ('left','right')),
  value_mm        numeric not null check (value_mm > 0),
  protocol        text,
  result_notes    text,
  created_at      timestamptz not null default now()
);

create table if not exists public.strength_tests (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null,
  trainer_id        uuid not null,
  client_id         uuid not null,
  assessment_id     uuid not null references public.assessments(id) on delete cascade,
  exercise_id       uuid not null references public.exercises(id) on delete restrict,
  load_kg           numeric not null check (load_kg >= 0),
  reps              int not null default 1 check (reps > 0),
  is_direct_1rm     boolean not null default false,
  estimated_1rm     numeric,
  formula           text,
  relative_strength numeric,
  notes             text,
  created_at        timestamptz not null default now()
);

create table if not exists public.power_tests (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null,
  trainer_id         uuid not null,
  client_id          uuid not null,
  assessment_id      uuid not null references public.assessments(id) on delete cascade,
  test_type          text not null check (test_type in ('vertical_jump','horizontal_jump','throw','power_output','other')),
  value              numeric not null,
  unit               text not null,
  implement_weight_kg numeric,
  attempt            int,
  notes              text,
  created_at         timestamptz not null default now()
);

create table if not exists public.endurance_tests (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  trainer_id      uuid not null,
  client_id       uuid not null,
  assessment_id   uuid not null references public.assessments(id) on delete cascade,
  test_type       text not null,
  distance_m      numeric,
  time_s          numeric,
  speed           numeric,
  hr_avg          int,
  hr_max          int,
  vo2_est         numeric,
  formula         text,
  result          numeric,
  notes           text,
  created_at      timestamptz not null default now()
);

create table if not exists public.mobility_tests (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  trainer_id      uuid not null,
  client_id       uuid not null,
  assessment_id   uuid not null references public.assessments(id) on delete cascade,
  joint           text not null,
  movement        text not null,
  side            text check (side in ('left','right','both')),
  value           numeric not null,
  unit            text not null default 'degrees' check (unit in ('degrees','cm','score')),
  notes           text,
  created_at      timestamptz not null default now()
);

create table if not exists public.flexibility_tests (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  trainer_id      uuid not null,
  client_id       uuid not null,
  assessment_id   uuid not null references public.assessments(id) on delete cascade,
  test_name       text not null,
  muscle_group    text,
  side            text check (side in ('left','right','both')),
  value           numeric not null,
  unit            text not null default 'cm' check (unit in ('degrees','cm','score')),
  notes           text,
  created_at      timestamptz not null default now()
);

create table if not exists public.custom_test_definitions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  trainer_id       uuid not null references public.profiles(id) on delete cascade,
  name             text not null,
  category         text not null check (category in ('body','strength','power','endurance','mobility','flexibility','other')),
  unit             text,
  result_type      text not null default 'number' check (result_type in ('number','time','text','boolean','scale')),
  method           text,
  instructions     text,
  reference_values jsonb,
  notes            text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.custom_test_results (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  trainer_id      uuid not null,
  client_id       uuid not null,
  assessment_id   uuid not null references public.assessments(id) on delete cascade,
  definition_id   uuid not null references public.custom_test_definitions(id) on delete restrict,
  value_num       numeric,
  value_text      text,
  value_bool      boolean,
  notes           text,
  created_at      timestamptz not null default now()
);

-- D. Programación y rutinas -------------------------------------------
-- Niveles macro/meso/bloque son OPCIONALES: un programa "simple" usa
-- solo programs -> weeks -> sessions. program_id se repite en todos los
-- hijos (denormalizado) para poder aplicar reglas de visibilidad simples.

create table if not exists public.programs (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  trainer_id         uuid not null references public.profiles(id) on delete restrict,
  client_id          uuid references public.clients(id) on delete cascade,   -- null si es plantilla
  name               text not null,
  goal               text,
  method             text not null default 'simple' check (method in ('simple','linear','undulating','block','atr','custom')),
  start_date         date,
  end_date           date,
  status             text not null default 'draft' check (status in ('draft','active','completed','archived')),
  is_template        boolean not null default false,
  source_template_id uuid references public.programs(id) on delete set null,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint programs_template_or_client check (
    (is_template and client_id is null) or (not is_template and client_id is not null)
  )
);

create table if not exists public.macrocycles (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  trainer_id      uuid not null,
  client_id       uuid,
  program_id      uuid not null references public.programs(id) on delete cascade,
  name            text not null,
  objective       text,
  start_date      date,
  end_date        date,
  sort_order      int not null default 0,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.mesocycles (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null,
  trainer_id          uuid not null,
  client_id           uuid,
  program_id          uuid not null,
  macrocycle_id       uuid not null references public.macrocycles(id) on delete cascade,
  name                text not null,
  phase               text not null default 'none' check (phase in ('accumulation','transformation','realization','other','none')),
  objective           text,
  duration_weeks      int check (duration_weeks > 0),
  frequency           int check (frequency between 1 and 14),
  volume_focus        text,
  intensity_focus     text,
  progression_criteria text,
  sort_order          int not null default 0,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.training_blocks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  trainer_id      uuid not null,
  client_id       uuid,
  program_id      uuid not null,
  mesocycle_id    uuid not null references public.mesocycles(id) on delete cascade,
  name            text not null,
  phase           text not null default 'none' check (phase in ('accumulation','transformation','realization','other','none')),
  objective       text,
  duration_weeks  int check (duration_weeks > 0),
  sort_order      int not null default 0,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.weeks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  trainer_id      uuid not null,
  client_id       uuid,
  program_id      uuid not null references public.programs(id) on delete cascade,
  block_id        uuid references public.training_blocks(id) on delete set null,
  week_number     int not null check (week_number > 0),
  start_date      date,
  focus           text,
  volume_level    text,
  intensity_level text,
  target_rir      numeric,
  target_rpe      numeric,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (program_id, week_number)
);

-- Sesión planificada (fusiona el "workouts" del diseño original)
create table if not exists public.sessions (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null,
  trainer_id        uuid not null,
  client_id         uuid,
  program_id        uuid not null,
  week_id           uuid not null references public.weeks(id) on delete cascade,
  day_of_week       int check (day_of_week between 1 and 7),
  scheduled_date    date,
  sort_order        int not null default 0,
  name              text not null,
  focus             text,
  estimated_minutes int check (estimated_minutes > 0),
  notes             text,
  status            text not null default 'planned' check (status in ('planned','completed','skipped')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.session_blocks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  trainer_id      uuid not null,
  client_id       uuid,
  program_id      uuid not null,
  session_id      uuid not null references public.sessions(id) on delete cascade,
  kind            text not null default 'main' check (kind in ('warmup','main','superset','circuit','mobility','flexibility','cooldown')),
  name            text,
  sort_order      int not null default 0,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.workout_exercises (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null,
  trainer_id         uuid not null,
  client_id          uuid,
  program_id         uuid not null,
  session_id         uuid not null references public.sessions(id) on delete cascade,
  block_id           uuid references public.session_blocks(id) on delete set null,
  exercise_id        uuid not null references public.exercises(id) on delete restrict,
  sort_order         int not null default 0,
  sets               int not null default 3 check (sets > 0),
  reps_min           int check (reps_min >= 0),
  reps_max           int check (reps_max >= 0),
  prescription_type  text not null default 'reps' check (prescription_type in ('reps','time','distance')),
  load_type          text check (load_type in ('kg','pct_1rm','bodyweight','rpe_based')),
  load_value         numeric,
  rir                numeric,
  rpe                numeric,
  rest_s             int check (rest_s >= 0),
  tempo              text,
  technical_notes    text,
  video_override_url text,
  superset_group     int,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.progression_rules (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null,
  trainer_id          uuid not null,
  client_id           uuid,
  program_id          uuid not null references public.programs(id) on delete cascade,
  workout_exercise_id uuid references public.workout_exercises(id) on delete cascade,
  block_id            uuid references public.training_blocks(id) on delete cascade,
  rule_type           text not null check (rule_type in ('linear_load','double_progression','rir_based','percent_wave','custom')),
  params              jsonb not null default '{}'::jsonb,
  applies_from_week   int,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.workout_templates (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  trainer_id      uuid not null references public.profiles(id) on delete cascade,
  name            text not null,
  description     text,
  goal            text,
  level           text,
  days_per_week   int check (days_per_week between 1 and 7),
  visibility      text not null default 'private' check (visibility in ('private','organization')),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.workout_template_sessions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  trainer_id      uuid not null,
  template_id     uuid not null references public.workout_templates(id) on delete cascade,
  day_index       int not null check (day_index > 0),
  name            text not null,
  focus           text,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.workout_template_exercises (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null,
  trainer_id          uuid not null,
  template_id         uuid not null,
  template_session_id uuid not null references public.workout_template_sessions(id) on delete cascade,
  block_kind          text check (block_kind in ('warmup','main','superset','circuit','mobility','flexibility','cooldown')),
  exercise_id         uuid not null references public.exercises(id) on delete restrict,
  sort_order          int not null default 0,
  sets                int not null default 3 check (sets > 0),
  reps_min            int check (reps_min >= 0),
  reps_max            int check (reps_max >= 0),
  prescription_type   text not null default 'reps' check (prescription_type in ('reps','time','distance')),
  load_type           text check (load_type in ('kg','pct_1rm','bodyweight','rpe_based')),
  load_value          numeric,
  rir                 numeric,
  rpe                 numeric,
  rest_s              int check (rest_s >= 0),
  tempo               text,
  technical_notes     text,
  superset_group      int,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- E. Ejecución del cliente ---------------------------------------------
-- Nota: borrar una sesión/programa borra sus logs (ON DELETE CASCADE).
-- La app debe advertirlo; para conservar historial, archivar el programa.

create table if not exists public.workout_logs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  trainer_id      uuid not null,
  client_id       uuid not null,
  program_id      uuid not null,
  session_id      uuid not null unique references public.sessions(id) on delete cascade,
  started_at      timestamptz,
  completed_at    timestamptz,
  status          text not null default 'in_progress' check (status in ('pending','in_progress','completed','skipped')),
  session_rpe     numeric check (session_rpe between 0 and 10),
  sensations      text,
  comments        text,
  duration_min    int check (duration_min >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.workout_exercise_logs (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null,
  trainer_id              uuid not null,
  client_id               uuid not null,
  workout_log_id          uuid not null references public.workout_logs(id) on delete cascade,
  workout_exercise_id     uuid references public.workout_exercises(id) on delete set null,
  exercise_id             uuid not null references public.exercises(id) on delete restrict,
  substituted_exercise_id uuid references public.exercises(id) on delete set null,
  sensation               text,
  pain_level              int check (pain_level between 0 and 10),
  pain_area               text,
  comment                 text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table if not exists public.workout_set_logs (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null,
  trainer_id          uuid not null,
  client_id           uuid not null,
  workout_log_id      uuid not null references public.workout_logs(id) on delete cascade,
  workout_exercise_id uuid references public.workout_exercises(id) on delete set null,
  exercise_id         uuid not null references public.exercises(id) on delete restrict,
  set_number          int not null check (set_number > 0),
  reps                int not null check (reps >= 0),
  load_kg             numeric check (load_kg >= 0),
  rir                 numeric,
  rpe                 numeric,
  completed           boolean not null default true,
  comment             text,
  performed_at        timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- F. Análisis, alertas y sugerencias -----------------------------------

create table if not exists public.progress_metrics (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  trainer_id      uuid not null,
  client_id       uuid not null references public.clients(id) on delete cascade,
  metric_key      text not null,
  exercise_id     uuid references public.exercises(id) on delete set null,
  muscle_group_id uuid references public.catalog_items(id) on delete set null,
  value           numeric not null,
  unit            text,
  period_date     date not null,
  granularity     text not null default 'session' check (granularity in ('session','week','month')),
  source_type     text,
  source_id       uuid,
  created_at      timestamptz not null default now()
);

create table if not exists public.alert_rules (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  trainer_id      uuid not null references public.profiles(id) on delete cascade,
  alert_type      text not null check (alert_type in ('no_logs','low_adherence','stagnation','big_change','assessment_due','payment_due','payment_overdue','custom')),
  params          jsonb not null default '{}'::jsonb,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (trainer_id, alert_type)
);

create table if not exists public.alerts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  trainer_id      uuid not null,
  client_id       uuid not null references public.clients(id) on delete cascade,
  alert_type      text not null,
  severity        text not null default 'review' check (severity in ('info','review','urgent')),
  payload         jsonb not null default '{}'::jsonb,
  status          text not null default 'open' check (status in ('open','reviewed','dismissed')),
  dedupe_key      text,
  reviewed_by     uuid references public.profiles(id) on delete set null,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (client_id, dedupe_key)
);

create table if not exists public.recommendations (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null,
  trainer_id           uuid not null,
  client_id            uuid not null references public.clients(id) on delete cascade,
  category             text not null check (category in ('focus','exercise','progression','regression','volume','intensity','frequency','follow_up')),
  title                text not null,
  rationale            text not null,
  evidence             jsonb not null default '{}'::jsonb,
  suggested_changes    jsonb,
  rule_key             text not null,
  engine_version       text not null default '1',
  dedupe_key           text,
  status               text not null default 'pending' check (status in ('pending','accepted','modified','ignored')),
  decision_note        text,
  decided_by           uuid references public.profiles(id) on delete set null,
  decided_at           timestamptz,
  resulting_program_id uuid references public.programs(id) on delete set null,
  resulting_session_id uuid references public.sessions(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (client_id, dedupe_key)
);

-- G. Comunicación ------------------------------------------------------

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  trainer_id      uuid not null,
  client_id       uuid not null references public.clients(id) on delete cascade,
  sender_id       uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body            text not null check (length(btrim(body)) > 0),
  attachment_path text,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipient_id    uuid not null references public.profiles(id) on delete cascade,
  type            text not null,
  title           text not null,
  body            text,
  data            jsonb not null default '{}'::jsonb,
  dedupe_key      text,
  read_at         timestamptz,
  created_at      timestamptz not null default now(),
  unique (recipient_id, dedupe_key)
);

create table if not exists public.notification_deliveries (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  notification_id uuid not null references public.notifications(id) on delete cascade,
  created_by      uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  channel         text not null check (channel in ('in_app','email','whatsapp','push')),
  status          text not null default 'pending' check (status in ('pending','sent','failed','manual')),
  sent_at         timestamptz,
  external_ref    text,
  error           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  event_type  text not null,
  channels    text[] not null default '{in_app}',
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (profile_id, event_type)
);

create table if not exists public.reminder_rules (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  trainer_id       uuid not null references public.profiles(id) on delete cascade,
  reminder_type    text not null check (reminder_type in ('workout','log_pending','assessment','measurement','payment_due','payment_overdue')),
  offset_days      int not null default 0,
  frequency        text,
  channels         text[] not null default '{in_app}',
  message_template text not null,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique,
  keys        jsonb not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- H. Pagos -------------------------------------------------------------

create table if not exists public.payment_plans (
  id             uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  trainer_id     uuid not null references public.profiles(id) on delete cascade,
  name           text not null,
  price          numeric not null check (price >= 0),
  currency       text not null default 'USD',
  billing_period text not null default 'monthly' check (billing_period in ('monthly','quarterly','custom')),
  duration_days  int check (duration_days > 0),
  description    text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.client_plans (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  trainer_id      uuid not null,
  client_id       uuid not null references public.clients(id) on delete cascade,
  plan_id         uuid not null references public.payment_plans(id) on delete restrict,
  start_date      date not null default current_date,
  due_date        date not null,
  status          text not null default 'active' check (status in ('active','expired','cancelled','paused')),
  price_override  numeric check (price_override >= 0),
  auto_renew      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  trainer_id      uuid not null,
  client_id       uuid not null references public.clients(id) on delete cascade,
  client_plan_id  uuid references public.client_plans(id) on delete set null,
  amount          numeric not null check (amount >= 0),
  currency        text not null default 'USD',
  due_date        date not null,
  paid_at         timestamptz,
  method          text check (method in ('cash','transfer','online','other')),
  status          text not null default 'pending' check (status in ('pending','paid','cancelled')),
  receipt_path    text,
  external_ref    text,
  notes           text,
  recorded_by     uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- I. Reportes, archivos y auditoría -----------------------------------

create table if not exists public.reports (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null,
  trainer_id         uuid not null,
  client_id          uuid references public.clients(id) on delete cascade,
  type               text not null check (type in ('evolution','training','financial')),
  period_from        date,
  period_to          date,
  params             jsonb not null default '{}'::jsonb,
  snapshot           jsonb,
  file_path          text,
  generated_by       uuid default auth.uid(),
  shared_with_client boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.client_files (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  trainer_id      uuid not null,
  client_id       uuid not null references public.clients(id) on delete cascade,
  kind            text not null check (kind in ('progress_photo','document','receipt','message_attachment','other')),
  storage_path    text not null,
  taken_at        date,
  visibility      text not null default 'client_and_trainer' check (visibility in ('trainer_only','client_and_trainer')),
  uploaded_by     uuid default auth.uid(),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.audit_log (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  actor_id        uuid not null default auth.uid(),
  action          text not null,
  entity          text not null,
  entity_id       uuid,
  diff            jsonb,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. FUNCIONES AUXILIARES DE SEGURIDAD
--    (SECURITY DEFINER: leen profiles/clients sin pasar por RLS y así
--     evitan recursión infinita en las políticas.)
-- ---------------------------------------------------------------------

create or replace function public.auth_role() returns text
language sql stable security definer set search_path = public as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.is_active
$$;

create or replace function public.auth_org() returns uuid
language sql stable security definer set search_path = public as $$
  select p.organization_id from public.profiles p where p.id = auth.uid() and p.is_active
$$;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role() = 'super_admin', false)
$$;

-- Id de la ficha de cliente del usuario actual (si es cliente activo)
create or replace function public.my_client_id() returns uuid
language sql stable security definer set search_path = public as $$
  select c.id from public.clients c
  join public.profiles p on p.id = c.profile_id
  where c.profile_id = auth.uid() and p.is_active and p.role = 'client' and c.status <> 'archived'
$$;

-- Entrenador del cliente actual
create or replace function public.my_trainer_id() returns uuid
language sql stable security definer set search_path = public as $$
  select c.trainer_id from public.clients c
  join public.profiles p on p.id = c.profile_id
  where c.profile_id = auth.uid() and p.is_active and p.role = 'client' and c.status <> 'archived'
$$;

-- ¿Soy este entrenador (y de esta organización)?
create or replace function public.is_trainer_scope(p_org uuid, p_trainer uuid) returns boolean
language sql stable set search_path = public as $$
  select coalesce(public.auth_role() = 'trainer' and p_org = public.auth_org() and p_trainer = auth.uid(), false)
$$;

-- ¿Soy este cliente (de esta organización)?
create or replace function public.is_own_client(p_client uuid, p_org uuid) returns boolean
language sql stable set search_path = public as $$
  select coalesce(p_client is not null and p_client = public.my_client_id() and p_org = public.auth_org(), false)
$$;

-- ¿Soy staff de este entrenador con permiso sobre el módulo?
create or replace function public.staff_can(p_trainer uuid, p_module text, p_level text default 'read') returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    public.auth_role() = 'staff' and exists (
      select 1 from public.staff_permissions sp
      where sp.staff_id = auth.uid()
        and sp.trainer_id = p_trainer
        and case when p_level = 'write'
                 then sp.permissions ->> p_module = 'write'
                 else sp.permissions ->> p_module in ('read','write') end
    ), false)
$$;

-- ¿Puedo ver el perfil de este usuario?
create or replace function public.can_see_profile(p_profile uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    public.auth_role() is not null and (
      p_profile = auth.uid()
      or public.is_super_admin()
      or p_profile = public.my_trainer_id()
      or exists (select 1 from public.clients c
                 where c.profile_id = p_profile
                   and (c.trainer_id = auth.uid() or public.staff_can(c.trainer_id, 'clients', 'read')))
      or exists (select 1 from public.staff_permissions sp where sp.staff_id = p_profile and sp.trainer_id = auth.uid())
      or exists (select 1 from public.staff_permissions sp where sp.trainer_id = p_profile and sp.staff_id = auth.uid())
    ), false)
$$;

create or replace function public.program_published(p_program uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.programs g where g.id = p_program and g.status in ('active','completed'))
$$;

create or replace function public.is_self_report(p_assessment uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.assessments a
                 where a.id = p_assessment and a.type = 'self_report' and a.client_id = public.my_client_id())
$$;

-- El cliente puede editar un log mientras no esté completado o dentro de 24 h
create or replace function public.log_editable(p_log uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workout_logs l
                 where l.id = p_log and l.client_id = public.my_client_id()
                   and (l.status <> 'completed' or l.completed_at > now() - interval '24 hours'))
$$;

create or replace function public.safe_uuid(p_text text) returns uuid
language plpgsql immutable as $$
begin
  return p_text::uuid;
exception when others then
  return null;
end $$;

-- Reglas de escritura sobre ejercicios (usadas por exercises y su multimedia)
create or replace function public.exercise_writable(p_scope text, p_org uuid, p_owner uuid) returns boolean
language sql stable set search_path = public as $$
  select coalesce(
    (p_scope = 'global' and public.is_super_admin())
    or (p_scope in ('organization','trainer') and p_org = public.auth_org() and (
          (public.auth_role() = 'trainer' and p_owner = auth.uid())
          or (public.auth_role() = 'staff' and p_scope = 'trainer' and public.staff_can(p_owner, 'exercises', 'write'))
       )), false)
$$;

-- Acceso a archivos de un cliente en Storage
create or replace function public.storage_client_access(p_org text, p_client uuid, p_kind text, p_write boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    p_client is not null and public.auth_role() in ('client','trainer','staff') and exists (
      select 1 from public.clients c
      where c.id = p_client and c.organization_id::text = p_org and (
        (public.auth_role() = 'client'  and c.profile_id = auth.uid() and p_kind is distinct from 'trainer')
        or (public.auth_role() = 'trainer' and c.trainer_id = auth.uid())
        or (public.auth_role() = 'staff'   and public.staff_can(c.trainer_id, 'files', case when p_write then 'write' else 'read' end))
      )), false)
$$;

-- RPC: activar/desactivar un usuario (Super Admin, o entrenador sobre sus clientes/staff)
create or replace function public.set_profile_active(p_profile uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_ok boolean;
begin
  v_ok := public.is_super_admin()
    or (public.auth_role() = 'trainer' and (
          exists (select 1 from public.clients c where c.profile_id = p_profile and c.trainer_id = auth.uid())
          or exists (select 1 from public.staff_permissions sp where sp.staff_id = p_profile and sp.trainer_id = auth.uid())));
  if not coalesce(v_ok, false) then
    raise exception 'No tienes permiso para modificar este usuario' using errcode = '42501';
  end if;
  perform set_config('app.internal', '1', true);
  update public.profiles set is_active = p_active where id = p_profile;
end $$;

-- RPC pública: validar un código de invitación antes de registrarse
create or replace function public.check_invitation(p_code text)
returns table (valid boolean, role text, email text, full_name text, org_name text)
language sql stable security definer set search_path = public as $$
  select true, i.role, i.email, i.full_name, o.name
  from public.invitations i
  join public.organizations o on o.id = i.organization_id
  where i.code = upper(btrim(p_code)) and i.status = 'pending' and i.expires_at > now()
$$;

-- ---------------------------------------------------------------------
-- 3. FUNCIONES DE TRIGGER
-- ---------------------------------------------------------------------

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Copia organization_id / trainer_id / client_id / program_id / template_id
-- desde el registro padre. Args: tabla_padre, columna_fk_en_hijo.
-- Se ejecuta con los permisos del usuario, así que RLS impide colgar filas
-- de un padre que el usuario no puede ver.
create or replace function public.inherit_scope() returns trigger
language plpgsql as $$
declare
  v_fk uuid;
  v_parent jsonb;
  v_patch jsonb;
begin
  v_fk := nullif(to_jsonb(new) ->> tg_argv[1], '')::uuid;
  execute format('select to_jsonb(t) from public.%I t where t.id = $1', tg_argv[0])
    into v_parent using v_fk;
  if v_parent is null then
    raise exception 'Registro padre (%) no encontrado o sin acceso', tg_argv[0] using errcode = '42501';
  end if;

  v_patch := jsonb_build_object(
    'organization_id', v_parent -> 'organization_id',
    'trainer_id',      v_parent -> 'trainer_id');
  if (v_parent -> 'client_id') is not null then
    v_patch := v_patch || jsonb_build_object('client_id', v_parent -> 'client_id');
  end if;
  if tg_argv[0] = 'programs' then
    v_patch := v_patch || jsonb_build_object('program_id', v_parent -> 'id');
  elsif (v_parent -> 'program_id') is not null then
    v_patch := v_patch || jsonb_build_object('program_id', v_parent -> 'program_id');
  end if;
  if tg_argv[0] = 'workout_templates' then
    v_patch := v_patch || jsonb_build_object('template_id', v_parent -> 'id');
  elsif (v_parent -> 'template_id') is not null then
    v_patch := v_patch || jsonb_build_object('template_id', v_parent -> 'template_id');
  end if;

  new := jsonb_populate_record(new, v_patch);
  return new;
end $$;

-- En tablas raíz: el client_id debe pertenecer al mismo entrenador y organización
create or replace function public.enforce_client_scope() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  j jsonb := to_jsonb(new);
  v_cid uuid := nullif(j ->> 'client_id', '')::uuid;
  c record;
begin
  if v_cid is null then
    return new;
  end if;
  select trainer_id, organization_id into c from public.clients where id = v_cid;
  if not found
     or c.trainer_id is distinct from nullif(j ->> 'trainer_id', '')::uuid
     or c.organization_id is distinct from nullif(j ->> 'organization_id', '')::uuid then
    raise exception 'El cliente no pertenece a este entrenador/organización' using errcode = '42501';
  end if;
  return new;
end $$;

-- organization_id / trainer_id / client_id no se pueden cambiar tras crear la fila
create or replace function public.guard_scope_columns() returns trigger
language plpgsql as $$
declare
  o jsonb := to_jsonb(old);
  n jsonb := to_jsonb(new);
  k text;
begin
  if auth.uid() is null or coalesce(current_setting('app.internal', true), '') = '1' then
    return new;
  end if;
  foreach k in array array['organization_id','trainer_id','client_id'] loop
    if (o -> k) is distinct from (n -> k) then
      raise exception 'La columna % no puede modificarse', k using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;

-- Si el usuario es CLIENTE, solo puede modificar las columnas indicadas
create or replace function public.guard_client_update() returns trigger
language plpgsql as $$
begin
  if auth.uid() is null or coalesce(current_setting('app.internal', true), '') = '1' then
    return new;
  end if;
  if public.auth_role() = 'client'
     and (to_jsonb(new) - tg_argv) is distinct from (to_jsonb(old) - tg_argv) then
    raise exception 'Solo puedes modificar los campos permitidos' using errcode = '42501';
  end if;
  return new;
end $$;

-- Para TODOS los usuarios: solo se pueden modificar las columnas indicadas
create or replace function public.guard_immutable_except() returns trigger
language plpgsql as $$
begin
  if auth.uid() is null or coalesce(current_setting('app.internal', true), '') = '1' then
    return new;
  end if;
  if (to_jsonb(new) - tg_argv) is distinct from (to_jsonb(old) - tg_argv) then
    raise exception 'Este registro solo permite modificar: %', array_to_string(tg_argv, ', ') using errcode = '42501';
  end if;
  return new;
end $$;

-- Anti-escalada: nadie (salvo Super Admin) cambia su rol, organización, email o estado
create or replace function public.protect_profile_columns() returns trigger
language plpgsql as $$
begin
  if auth.uid() is null or coalesce(current_setting('app.internal', true), '') = '1' then
    return new;
  end if;
  if public.is_super_admin() then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.organization_id is distinct from old.organization_id
     or new.is_active is distinct from old.is_active
     or new.email is distinct from old.email
     or new.id is distinct from old.id then
    raise exception 'No puedes modificar rol, organización, email ni estado' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.validate_client_row() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles p
                 where p.id = new.trainer_id and p.role = 'trainer' and p.organization_id = new.organization_id) then
    raise exception 'El entrenador indicado no existe en esta organización' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.set_message_sender() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null then
    new.sender_id := auth.uid();
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Alta de usuarios por invitación (sin service_role ni Edge Functions)
--   * El cliente de la app llama a supabase.auth.signUp con
--     options.data = { invite_code: 'XXXXXXXXXXXX', full_name: '...' }
--   * Sin código: solo se permite si NO existe todavía ningún Super Admin
--     (así se crea el primer administrador desde el panel de Supabase).
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_code text := upper(btrim(coalesce(new.raw_user_meta_data ->> 'invite_code', '')));
  v_name text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  v_inv  public.invitations%rowtype;
  v_client uuid;
begin
  if v_code = '' then
    if not exists (select 1 from public.profiles where role = 'super_admin') then
      insert into public.profiles (id, organization_id, role, full_name, email)
      values (new.id, null, 'super_admin', coalesce(v_name, split_part(new.email, '@', 1)), new.email);
      return new;
    end if;
    raise exception 'Se requiere un código de invitación para registrarse' using errcode = 'P0001';
  end if;

  select * into v_inv from public.invitations where code = v_code for update;
  if not found or v_inv.status <> 'pending' or v_inv.expires_at < now() then
    raise exception 'Código de invitación inválido o vencido' using errcode = 'P0001';
  end if;
  if v_inv.email is not null and lower(v_inv.email) <> lower(new.email) then
    raise exception 'El código de invitación no corresponde a este email' using errcode = 'P0001';
  end if;

  v_name := coalesce(v_name, v_inv.full_name, split_part(new.email, '@', 1));

  insert into public.profiles (id, organization_id, role, full_name, email)
  values (new.id, v_inv.organization_id, v_inv.role, v_name, new.email);

  if v_inv.role = 'client' then
    if v_inv.client_id is not null then
      update public.clients
         set profile_id = new.id, email = coalesce(email, new.email)
       where id = v_inv.client_id and profile_id is null and organization_id = v_inv.organization_id;
      if not found then
        raise exception 'La ficha de cliente ya fue reclamada o no existe' using errcode = 'P0001';
      end if;
    else
      insert into public.clients (organization_id, trainer_id, profile_id, full_name, email, status, start_date)
      values (v_inv.organization_id, v_inv.trainer_id, new.id, v_name, new.email, 'active', current_date)
      returning id into v_client;
      insert into public.client_profiles (client_id, organization_id, trainer_id)
      values (v_client, v_inv.organization_id, v_inv.trainer_id);
    end if;
  elsif v_inv.role = 'staff' then
    insert into public.staff_permissions (organization_id, staff_id, trainer_id, permissions)
    values (v_inv.organization_id, new.id, v_inv.trainer_id, v_inv.permissions);
  end if;

  update public.invitations
     set status = 'accepted', accepted_by = new.id, accepted_at = now()
   where id = v_inv.id;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Métricas de progreso derivadas (se recalculan en el servidor, el cliente
-- no puede falsificarlas)
-- ---------------------------------------------------------------------

create or replace function public.refresh_log_metrics(p_log uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  l public.workout_logs%rowtype;
  v_date date;
begin
  delete from public.progress_metrics where source_type = 'workout_log' and source_id = p_log;

  select * into l from public.workout_logs where id = p_log;
  if not found or l.status <> 'completed' then
    return;
  end if;
  v_date := (coalesce(l.completed_at, now()) at time zone 'UTC')::date;

  insert into public.progress_metrics
    (organization_id, trainer_id, client_id, metric_key, value, unit, period_date, granularity, source_type, source_id)
  select l.organization_id, l.trainer_id, l.client_id, m.k, m.v, m.u, v_date, 'session', 'workout_log', p_log
  from (
    select 'session_volume'::text as k, coalesce(sum(reps * coalesce(load_kg, 0)), 0)::numeric as v, 'kg'::text as u
      from public.workout_set_logs where workout_log_id = p_log and completed
    union all
    select 'session_sets', count(*)::numeric, 'sets'
      from public.workout_set_logs where workout_log_id = p_log and completed
    union all
    select 'session_reps', coalesce(sum(reps), 0)::numeric, 'reps'
      from public.workout_set_logs where workout_log_id = p_log and completed
  ) m;

  insert into public.progress_metrics
    (organization_id, trainer_id, client_id, metric_key, exercise_id, value, unit, period_date, granularity, source_type, source_id)
  select l.organization_id, l.trainer_id, l.client_id, 'e1rm', s.exercise_id,
         round(max(s.load_kg * (1 + s.reps / 30.0)), 1), 'kg', v_date, 'session', 'workout_log', p_log
  from public.workout_set_logs s
  where s.workout_log_id = p_log and s.completed and s.load_kg > 0 and s.reps between 1 and 12
  group by s.exercise_id;
end $$;

create or replace function public.trg_workout_log_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_log_metrics(new.id);
  update public.sessions
     set status = case new.status when 'completed' then 'completed' when 'skipped' then 'skipped' else 'planned' end
   where id = new.session_id
     and status is distinct from (case new.status when 'completed' then 'completed' when 'skipped' then 'skipped' else 'planned' end);
  return null;
end $$;

create or replace function public.trg_set_log_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_log_metrics(old.workout_log_id);
  else
    perform public.refresh_log_metrics(new.workout_log_id);
  end if;
  return null;
end $$;

create or replace function public.trg_body_metrics() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_date date;
begin
  if tg_op = 'DELETE' then
    delete from public.progress_metrics where source_type = 'body_measurement' and source_id = old.id;
    return null;
  end if;
  delete from public.progress_metrics where source_type = 'body_measurement' and source_id = new.id;
  select assessed_at into v_date from public.assessments where id = new.assessment_id;

  insert into public.progress_metrics
    (organization_id, trainer_id, client_id, metric_key, value, unit, period_date, granularity, source_type, source_id)
  select new.organization_id, new.trainer_id, new.client_id, v.k, v.val, v.u, v_date, 'session', 'body_measurement', new.id
  from (values
    ('weight'::text,         new.weight_kg,      'kg'::text),
    ('body_fat_pct',         new.body_fat_pct,   '%'),
    ('muscle_mass_kg',       new.muscle_mass_kg, 'kg'),
    ('fat_mass_kg',          new.fat_mass_kg,    'kg'),
    ('lean_mass_kg',         new.lean_mass_kg,   'kg'),
    ('bmi',                  new.bmi,            'kg/m2')
  ) as v(k, val, u)
  where v.val is not null;
  return null;
end $$;

create or replace function public.trg_strength_metrics() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_date date;
begin
  if tg_op = 'DELETE' then
    delete from public.progress_metrics where source_type = 'strength_test' and source_id = old.id;
    return null;
  end if;
  delete from public.progress_metrics where source_type = 'strength_test' and source_id = new.id;
  select assessed_at into v_date from public.assessments where id = new.assessment_id;

  insert into public.progress_metrics
    (organization_id, trainer_id, client_id, metric_key, exercise_id, value, unit, period_date, granularity, source_type, source_id)
  values
    (new.organization_id, new.trainer_id, new.client_id, 'e1rm', new.exercise_id,
     coalesce(new.estimated_1rm,
              case when new.is_direct_1rm or new.reps = 1 then new.load_kg
                   else round(new.load_kg * (1 + new.reps / 30.0), 1) end),
     'kg', v_date, 'session', 'strength_test', new.id);
  return null;
end $$;

-- ---------------------------------------------------------------------
-- Enlace de triggers
-- ---------------------------------------------------------------------
do $$
declare
  spec text;
  t text;
  p text[];
begin
  -- 3.1 updated_at en toda tabla que lo tenga
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name = 'updated_at'
  loop
    execute format('drop trigger if exists z_set_updated_at on public.%I', t);
    execute format('create trigger z_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;

  -- 3.2 organization/trainer/client inmutables
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.column_name in ('organization_id','trainer_id')
    group by c.table_name having count(*) = 2
  loop
    execute format('drop trigger if exists a_guard_scope on public.%I', t);
    execute format('create trigger a_guard_scope before update on public.%I for each row execute function public.guard_scope_columns()', t);
  end loop;

  -- 3.3 herencia de alcance desde el padre: 'tabla:padre:columna_fk'
  foreach spec in array array[
    'client_profiles:clients:client_id',
    'assessments:clients:client_id',
    'client_goals:clients:client_id',
    'client_notes:clients:client_id',
    'progress_metrics:clients:client_id',
    'alerts:clients:client_id',
    'recommendations:clients:client_id',
    'messages:clients:client_id',
    'client_plans:clients:client_id',
    'payments:clients:client_id',
    'client_files:clients:client_id',
    'body_measurements:assessments:assessment_id',
    'circumferences:assessments:assessment_id',
    'skinfolds:assessments:assessment_id',
    'strength_tests:assessments:assessment_id',
    'power_tests:assessments:assessment_id',
    'endurance_tests:assessments:assessment_id',
    'mobility_tests:assessments:assessment_id',
    'flexibility_tests:assessments:assessment_id',
    'custom_test_results:assessments:assessment_id',
    'macrocycles:programs:program_id',
    'weeks:programs:program_id',
    'progression_rules:programs:program_id',
    'mesocycles:macrocycles:macrocycle_id',
    'training_blocks:mesocycles:mesocycle_id',
    'sessions:weeks:week_id',
    'session_blocks:sessions:session_id',
    'workout_exercises:sessions:session_id',
    'workout_logs:sessions:session_id',
    'workout_exercise_logs:workout_logs:workout_log_id',
    'workout_set_logs:workout_logs:workout_log_id',
    'workout_template_sessions:workout_templates:template_id',
    'workout_template_exercises:workout_template_sessions:template_session_id'
  ] loop
    p := string_to_array(spec, ':');
    execute format('drop trigger if exists a_inherit_scope on public.%I', p[1]);
    execute format('create trigger a_inherit_scope before insert on public.%I for each row execute function public.inherit_scope(%L, %L)', p[1], p[2], p[3]);
  end loop;

  -- 3.4 tablas con client_id opcional: el cliente debe pertenecer al entrenador/organización
  --     (las demás tablas de cliente heredan el alcance del cliente/padre en 3.3)
  foreach t in array array['programs','reports']
  loop
    execute format('drop trigger if exists b_enforce_client_scope on public.%I', t);
    execute format('create trigger b_enforce_client_scope before insert or update on public.%I for each row execute function public.enforce_client_scope()', t);
  end loop;

  -- 3.5 el cliente solo puede modificar ciertas columnas: 'tabla:col1,col2,...'
  foreach spec in array array[
    'clients:full_name,phone,updated_at',
    'client_profiles:birth_date,sex,height_cm,sports_history,injuries,medical_notes,emergency_contact,updated_at',
    'payments:receipt_path,updated_at',
    'assessments:assessed_at,status,notes,updated_at',
    'workout_logs:started_at,completed_at,status,session_rpe,sensations,comments,duration_min,updated_at',
    'workout_exercise_logs:substituted_exercise_id,sensation,pain_level,pain_area,comment,updated_at',
    'workout_set_logs:set_number,reps,load_kg,rir,rpe,completed,comment,performed_at,updated_at'
  ] loop
    p := string_to_array(spec, ':');
    execute format('drop trigger if exists b_guard_client_update on public.%I', p[1]);
    execute format('create trigger b_guard_client_update before update on public.%I for each row execute function public.guard_client_update(%s)',
                   p[1], (select string_agg(quote_literal(x), ',') from unnest(string_to_array(p[2], ',')) x));
  end loop;
end $$;

-- 3.6 Triggers específicos
drop trigger if exists b_validate_client on public.clients;
create trigger b_validate_client before insert or update of trainer_id, organization_id on public.clients
  for each row execute function public.validate_client_row();

drop trigger if exists b_protect_profile on public.profiles;
create trigger b_protect_profile before update on public.profiles
  for each row execute function public.protect_profile_columns();

drop trigger if exists b_message_sender on public.messages;
create trigger b_message_sender before insert on public.messages
  for each row execute function public.set_message_sender();

drop trigger if exists b_guard_immutable on public.messages;
create trigger b_guard_immutable before update on public.messages
  for each row execute function public.guard_immutable_except('read_at');

drop trigger if exists b_guard_immutable on public.notifications;
create trigger b_guard_immutable before update on public.notifications
  for each row execute function public.guard_immutable_except('read_at');

drop trigger if exists b_guard_immutable on public.invitations;
create trigger b_guard_immutable before update on public.invitations
  for each row execute function public.guard_immutable_except('status');

drop trigger if exists b_guard_immutable on public.staff_permissions;
create trigger b_guard_immutable before update on public.staff_permissions
  for each row execute function public.guard_immutable_except('permissions', 'updated_at');

drop trigger if exists c_metrics on public.workout_logs;
create trigger c_metrics after insert or update on public.workout_logs
  for each row execute function public.trg_workout_log_after();

drop trigger if exists c_metrics on public.workout_set_logs;
create trigger c_metrics after insert or update or delete on public.workout_set_logs
  for each row execute function public.trg_set_log_after();

drop trigger if exists c_metrics on public.body_measurements;
create trigger c_metrics after insert or update or delete on public.body_measurements
  for each row execute function public.trg_body_metrics();

drop trigger if exists c_metrics on public.strength_tests;
create trigger c_metrics after insert or update or delete on public.strength_tests
  for each row execute function public.trg_strength_metrics();

-- ---------------------------------------------------------------------
-- 4. VISTAS (security_invoker: respetan RLS del usuario que consulta)
-- ---------------------------------------------------------------------

create or replace view public.payments_with_status with (security_invoker = true) as
select p.*,
       case when p.status = 'pending' and p.due_date < current_date then 'overdue' else p.status end as effective_status
from public.payments p;

create or replace view public.v_adherence_weekly with (security_invoker = true) as
select s.organization_id, s.trainer_id, s.client_id,
       date_trunc('week', s.scheduled_date)::date as week_start,
       count(*)                                                     as planned,
       count(*) filter (where l.status = 'completed')               as completed,
       round(100.0 * count(*) filter (where l.status = 'completed') / count(*), 1) as adherence_pct
from public.sessions s
join public.programs g on g.id = s.program_id and g.status in ('active','completed') and not g.is_template
left join public.workout_logs l on l.session_id = s.id
where s.scheduled_date is not null and s.client_id is not null
group by s.organization_id, s.trainer_id, s.client_id, date_trunc('week', s.scheduled_date);

-- ---------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
--    Denegar por defecto. Un generador temporal crea las 4 políticas
--    (select/insert/update/delete) de las tablas con datos de cliente.
-- ---------------------------------------------------------------------

create or replace function public._apply_data_policies(
  p_table         text,
  p_module        text,                       -- módulo de staff_permissions (null = sin acceso de staff)
  p_client_col    text    default 'client_id',
  p_has_client    boolean default true,       -- false = tabla sin client_id (config del entrenador)
  p_super         boolean default true,       -- ¿el Super Admin puede leer?
  p_client_select text    default 'true',     -- condición extra para que el CLIENTE lea ('false' = no)
  p_client_insert text    default 'false',
  p_client_update text    default 'false',
  p_client_delete text    default 'false'
) returns void language plpgsql as $$
declare
  r record;
  v_c text; v_tr text; v_sr text; v_sw text;
  v_sel text; v_ins text; v_upd text;
begin
  execute format('alter table public.%I enable row level security', p_table);
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = p_table loop
    execute format('drop policy %I on public.%I', r.policyname, p_table);
  end loop;

  v_tr := 'public.is_trainer_scope(organization_id, trainer_id)';
  v_c := case when p_has_client
              then format('public.is_own_client(%I, organization_id)', p_client_col)
              else '(public.auth_role() = ''client'' and organization_id = public.auth_org())' end;
  if p_module is null then
    v_sr := 'false'; v_sw := 'false';
  else
    v_sr := format('(organization_id = public.auth_org() and public.staff_can(trainer_id, %L, ''read''))', p_module);
    v_sw := format('(organization_id = public.auth_org() and public.staff_can(trainer_id, %L, ''write''))', p_module);
  end if;

  v_sel := format('%s or %s%s or %s', v_tr, v_sr,
                  case when p_super then ' or public.is_super_admin()' else '' end,
                  case when p_client_select = 'false' then 'false' else format('(%s and (%s))', v_c, p_client_select) end);
  v_ins := format('%s or %s or %s', v_tr, v_sw,
                  case when p_client_insert = 'false' then 'false' else format('(%s and (%s))', v_c, p_client_insert) end);
  v_upd := format('%s or %s or %s', v_tr, v_sw,
                  case when p_client_update = 'false' then 'false' else format('(%s and (%s))', v_c, p_client_update) end);

  execute format('create policy p_select on public.%I for select to authenticated using (%s)', p_table, v_sel);
  execute format('create policy p_insert on public.%I for insert to authenticated with check (%s)', p_table, v_ins);
  execute format('create policy p_update on public.%I for update to authenticated using (%s) with check (%s)', p_table, v_upd, v_upd);
  execute format('create policy p_delete on public.%I for delete to authenticated using (%s or %s)', p_table, v_tr,
                 case when p_client_delete = 'false' then 'false' else format('(%s and (%s))', v_c, p_client_delete) end);
end $$;

-- 5.1 Clientes y datos personales
select public._apply_data_policies('clients',         'clients', p_client_col => 'id', p_client_update => 'true');
select public._apply_data_policies('client_profiles', 'health',  p_super => false, p_client_update => 'true');
select public._apply_data_policies('client_notes',    'clients', p_super => false, p_client_select => 'false');
select public._apply_data_policies('client_goals',    'clients');

-- 5.2 Evaluaciones (el cliente puede autoregistrar: assessments de tipo self_report)
select public._apply_data_policies('assessments', 'assessments',
  p_client_insert => $$type = 'self_report'$$,
  p_client_update => $$type = 'self_report'$$,
  p_client_delete => $$type = 'self_report'$$);

select public._apply_data_policies(t, 'assessments',
  p_client_insert => 'public.is_self_report(assessment_id)',
  p_client_update => 'public.is_self_report(assessment_id)',
  p_client_delete => 'public.is_self_report(assessment_id)')
from unnest(array['body_measurements','circumferences','power_tests','endurance_tests',
                  'mobility_tests','flexibility_tests','custom_test_results']) t;

select public._apply_data_policies(t, 'assessments') from unnest(array['skinfolds','strength_tests']) t;

select public._apply_data_policies('custom_test_definitions', 'assessments', p_has_client => false,
  p_client_select => 'is_active and trainer_id = public.my_trainer_id()');

-- 5.3 Programación (el cliente solo ve programas activos/completados)
select public._apply_data_policies('programs', 'programs', p_client_select => $$status in ('active','completed')$$);

select public._apply_data_policies(t, 'programs', p_client_select => 'public.program_published(program_id)')
from unnest(array['macrocycles','mesocycles','training_blocks','weeks','sessions','session_blocks','workout_exercises']) t;

select public._apply_data_policies('progression_rules', 'programs', p_client_select => 'false');

select public._apply_data_policies(t, 'programs', p_has_client => false, p_client_select => 'false')
from unnest(array['workout_templates','workout_template_sessions','workout_template_exercises']) t;

-- Plantillas compartidas con la organización (lectura para entrenadores/staff)
drop policy if exists p_select_org on public.workout_templates;
create policy p_select_org on public.workout_templates for select to authenticated
  using (visibility = 'organization' and organization_id = public.auth_org()
         and public.auth_role() in ('trainer','staff'));

drop policy if exists p_select_org on public.workout_template_sessions;
create policy p_select_org on public.workout_template_sessions for select to authenticated
  using (exists (select 1 from public.workout_templates t where t.id = template_id));

drop policy if exists p_select_org on public.workout_template_exercises;
create policy p_select_org on public.workout_template_exercises for select to authenticated
  using (exists (select 1 from public.workout_templates t where t.id = template_id));

-- 5.4 Ejecución del cliente
select public._apply_data_policies('workout_logs', 'logs',
  p_client_insert => 'true',
  p_client_update => $$(status <> 'completed' or completed_at > now() - interval '24 hours')$$);

select public._apply_data_policies(t, 'logs',
  p_client_insert => 'public.log_editable(workout_log_id)',
  p_client_update => 'public.log_editable(workout_log_id)',
  p_client_delete => 'public.log_editable(workout_log_id)')
from unnest(array['workout_exercise_logs','workout_set_logs']) t;

-- 5.5 Análisis (el cliente lee sus métricas; alertas y sugerencias son solo del equipo)
select public._apply_data_policies('progress_metrics', 'analytics');
select public._apply_data_policies('alerts',           'analytics', p_client_select => 'false');
select public._apply_data_policies('recommendations',  'analytics', p_client_select => 'false');
select public._apply_data_policies('alert_rules',      null, p_has_client => false, p_client_select => 'false');
select public._apply_data_policies('reminder_rules',   null, p_has_client => false,
  p_client_select => 'is_active and trainer_id = public.my_trainer_id()');

-- 5.6 Mensajes (el Super Admin no lee mensajes)
select public._apply_data_policies('messages', 'messages', p_super => false,
  p_client_insert => 'true', p_client_update => 'true');

-- 5.7 Pagos
select public._apply_data_policies('payment_plans', 'payments', p_has_client => false,
  p_client_select => 'exists (select 1 from public.client_plans cp where cp.plan_id = payment_plans.id)');
select public._apply_data_policies('client_plans', 'payments');
select public._apply_data_policies('payments',     'payments', p_client_update => $$status = 'pending'$$);

-- 5.8 Reportes y archivos
select public._apply_data_policies('reports', 'reports', p_client_select => 'shared_with_client');
select public._apply_data_policies('client_files', 'files', p_super => false,
  p_client_select => $$visibility = 'client_and_trainer'$$,
  p_client_insert => $$visibility = 'client_and_trainer'$$,
  p_client_delete => $$visibility = 'client_and_trainer'$$);

drop function public._apply_data_policies(text, text, text, boolean, boolean, text, text, text, text);

-- 5.9 Super Admin: gestión administrativa de clientes
drop policy if exists p_admin_update on public.clients;
create policy p_admin_update on public.clients for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists p_admin_delete on public.clients;
create policy p_admin_delete on public.clients for delete to authenticated
  using (public.is_super_admin());

-- 5.10 Organizaciones
alter table public.organizations enable row level security;
drop policy if exists p_select on public.organizations;
drop policy if exists p_insert on public.organizations;
drop policy if exists p_update on public.organizations;
drop policy if exists p_delete on public.organizations;
create policy p_select on public.organizations for select to authenticated
  using (public.is_super_admin() or id = public.auth_org());
create policy p_insert on public.organizations for insert to authenticated with check (public.is_super_admin());
create policy p_update on public.organizations for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy p_delete on public.organizations for delete to authenticated using (public.is_super_admin());

-- 5.11 Perfiles (se crean solo desde handle_new_user)
alter table public.profiles enable row level security;
drop policy if exists p_select on public.profiles;
drop policy if exists p_update on public.profiles;
create policy p_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.can_see_profile(id));
create policy p_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_super_admin())
  with check (id = auth.uid() or public.is_super_admin());

-- 5.12 Invitaciones
alter table public.invitations enable row level security;
drop policy if exists p_select on public.invitations;
drop policy if exists p_insert on public.invitations;
drop policy if exists p_update on public.invitations;
create policy p_select on public.invitations for select to authenticated
  using (public.is_super_admin() or invited_by = auth.uid());
create policy p_insert on public.invitations for insert to authenticated
  with check (
    (public.is_super_admin() and invited_by = auth.uid())
    or (public.auth_role() = 'trainer'
        and role in ('client','staff')
        and organization_id = public.auth_org()
        and trainer_id = auth.uid()
        and invited_by = auth.uid()
        and (client_id is null or exists (select 1 from public.clients c
                                          where c.id = client_id and c.trainer_id = auth.uid())))
  );
create policy p_update on public.invitations for update to authenticated
  using (public.is_super_admin() or invited_by = auth.uid())
  with check (public.is_super_admin() or invited_by = auth.uid());

-- 5.13 Permisos de staff (las filas se crean al aceptar la invitación)
alter table public.staff_permissions enable row level security;
drop policy if exists p_select on public.staff_permissions;
drop policy if exists p_update on public.staff_permissions;
drop policy if exists p_delete on public.staff_permissions;
create policy p_select on public.staff_permissions for select to authenticated
  using (public.is_super_admin() or staff_id = auth.uid() or trainer_id = auth.uid());
create policy p_update on public.staff_permissions for update to authenticated
  using (public.auth_role() = 'trainer' and trainer_id = auth.uid())
  with check (public.auth_role() = 'trainer' and trainer_id = auth.uid());
create policy p_delete on public.staff_permissions for delete to authenticated
  using (public.auth_role() = 'trainer' and trainer_id = auth.uid());

-- 5.14 Catálogos y ejercicios
alter table public.catalog_items enable row level security;
drop policy if exists p_select on public.catalog_items;
drop policy if exists p_write on public.catalog_items;
create policy p_select on public.catalog_items for select to authenticated
  using (public.auth_role() is not null and (organization_id is null or organization_id = public.auth_org()));
create policy p_write on public.catalog_items for all to authenticated
  using (public.is_super_admin() or (public.auth_role() = 'trainer' and organization_id = public.auth_org()))
  with check (public.is_super_admin() or (public.auth_role() = 'trainer' and organization_id = public.auth_org()));

alter table public.exercises enable row level security;
drop policy if exists p_select on public.exercises;
drop policy if exists p_insert on public.exercises;
drop policy if exists p_update on public.exercises;
drop policy if exists p_delete on public.exercises;
create policy p_select on public.exercises for select to authenticated
  using (
    public.is_super_admin()
    or (public.auth_role() is not null and (
         scope = 'global'
         or (scope = 'organization' and organization_id = public.auth_org())
         or (scope = 'trainer' and organization_id = public.auth_org()
             and (owner_id = auth.uid()
                  or owner_id = public.my_trainer_id()
                  or public.staff_can(owner_id, 'exercises', 'read')))))
  );
create policy p_insert on public.exercises for insert to authenticated
  with check (public.exercise_writable(scope, organization_id, owner_id));
create policy p_update on public.exercises for update to authenticated
  using (public.exercise_writable(scope, organization_id, owner_id))
  with check (public.exercise_writable(scope, organization_id, owner_id));
create policy p_delete on public.exercises for delete to authenticated
  using (public.exercise_writable(scope, organization_id, owner_id));

alter table public.exercise_media enable row level security;
drop policy if exists p_select on public.exercise_media;
drop policy if exists p_write on public.exercise_media;
create policy p_select on public.exercise_media for select to authenticated
  using (exists (select 1 from public.exercises e where e.id = exercise_id));
create policy p_write on public.exercise_media for all to authenticated
  using (exists (select 1 from public.exercises e
                 where e.id = exercise_id and public.exercise_writable(e.scope, e.organization_id, e.owner_id)))
  with check (exists (select 1 from public.exercises e
                      where e.id = exercise_id and public.exercise_writable(e.scope, e.organization_id, e.owner_id)));

alter table public.exercise_variations enable row level security;
drop policy if exists p_select on public.exercise_variations;
drop policy if exists p_write on public.exercise_variations;
create policy p_select on public.exercise_variations for select to authenticated
  using (exists (select 1 from public.exercises e where e.id = exercise_id));
create policy p_write on public.exercise_variations for all to authenticated
  using (exists (select 1 from public.exercises e
                 where e.id = exercise_id and public.exercise_writable(e.scope, e.organization_id, e.owner_id)))
  with check (exists (select 1 from public.exercises e
                      where e.id = exercise_id and public.exercise_writable(e.scope, e.organization_id, e.owner_id)));

-- 5.15 Notificaciones y preferencias
alter table public.notifications enable row level security;
drop policy if exists p_select on public.notifications;
drop policy if exists p_insert on public.notifications;
drop policy if exists p_update on public.notifications;
drop policy if exists p_delete on public.notifications;
create policy p_select on public.notifications for select to authenticated using (recipient_id = auth.uid());
create policy p_insert on public.notifications for insert to authenticated
  with check ((organization_id = public.auth_org() or public.is_super_admin())
              and (recipient_id = auth.uid() or public.can_see_profile(recipient_id)));
create policy p_update on public.notifications for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy p_delete on public.notifications for delete to authenticated using (recipient_id = auth.uid());

alter table public.notification_deliveries enable row level security;
drop policy if exists p_select on public.notification_deliveries;
drop policy if exists p_insert on public.notification_deliveries;
drop policy if exists p_update on public.notification_deliveries;
create policy p_select on public.notification_deliveries for select to authenticated
  using (created_by = auth.uid()
         or exists (select 1 from public.notifications n where n.id = notification_id));
create policy p_insert on public.notification_deliveries for insert to authenticated
  with check (created_by = auth.uid() and organization_id = public.auth_org());
create policy p_update on public.notification_deliveries for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

alter table public.notification_preferences enable row level security;
drop policy if exists p_own on public.notification_preferences;
create policy p_own on public.notification_preferences for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

alter table public.push_subscriptions enable row level security;
drop policy if exists p_own on public.push_subscriptions;
create policy p_own on public.push_subscriptions for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- 5.16 Auditoría
alter table public.audit_log enable row level security;
drop policy if exists p_select on public.audit_log;
drop policy if exists p_insert on public.audit_log;
create policy p_select on public.audit_log for select to authenticated using (public.is_super_admin());
create policy p_insert on public.audit_log for insert to authenticated
  with check (actor_id = auth.uid() and public.auth_role() is not null);

-- 5.17 Red de seguridad: RLS activo en TODA tabla de public
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6. STORAGE
--   exercise-media : {org|global}/{trainer_uid}/archivo
--   client-files   : {org}/{client_id}/{tipo}/archivo
--                    (tipo = 'trainer' => archivos que el cliente NO ve)
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('exercise-media', 'exercise-media', false, 52428800,
   array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm']),
  ('client-files', 'client-files', false, 10485760,
   array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

drop policy if exists exercise_media_select on storage.objects;
drop policy if exists exercise_media_insert on storage.objects;
drop policy if exists exercise_media_update on storage.objects;
drop policy if exists exercise_media_delete on storage.objects;
drop policy if exists client_files_select on storage.objects;
drop policy if exists client_files_insert on storage.objects;
drop policy if exists client_files_update on storage.objects;
drop policy if exists client_files_delete on storage.objects;

create policy exercise_media_select on storage.objects for select to authenticated
  using (bucket_id = 'exercise-media' and public.auth_role() is not null and (
           (storage.foldername(name))[1] = 'global'
           or (storage.foldername(name))[1] = public.auth_org()::text
           or public.is_super_admin()));

create policy exercise_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'exercise-media' and (
           (public.is_super_admin() and (storage.foldername(name))[1] = 'global')
           or (public.auth_role() = 'trainer'
               and (storage.foldername(name))[1] = public.auth_org()::text
               and (storage.foldername(name))[2] = auth.uid()::text)
           or (public.auth_role() = 'staff'
               and (storage.foldername(name))[1] = public.auth_org()::text
               and public.staff_can(public.safe_uuid((storage.foldername(name))[2]), 'exercises', 'write'))));

create policy exercise_media_update on storage.objects for update to authenticated
  using (bucket_id = 'exercise-media' and (
           (public.is_super_admin() and (storage.foldername(name))[1] = 'global')
           or (public.auth_role() = 'trainer'
               and (storage.foldername(name))[1] = public.auth_org()::text
               and (storage.foldername(name))[2] = auth.uid()::text)
           or (public.auth_role() = 'staff'
               and (storage.foldername(name))[1] = public.auth_org()::text
               and public.staff_can(public.safe_uuid((storage.foldername(name))[2]), 'exercises', 'write'))));

create policy exercise_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'exercise-media' and (
           (public.is_super_admin() and (storage.foldername(name))[1] = 'global')
           or (public.auth_role() = 'trainer'
               and (storage.foldername(name))[1] = public.auth_org()::text
               and (storage.foldername(name))[2] = auth.uid()::text)
           or (public.auth_role() = 'staff'
               and (storage.foldername(name))[1] = public.auth_org()::text
               and public.staff_can(public.safe_uuid((storage.foldername(name))[2]), 'exercises', 'write'))));

create policy client_files_select on storage.objects for select to authenticated
  using (bucket_id = 'client-files' and public.storage_client_access(
           (storage.foldername(name))[1], public.safe_uuid((storage.foldername(name))[2]),
           (storage.foldername(name))[3], false));

create policy client_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'client-files' and public.storage_client_access(
           (storage.foldername(name))[1], public.safe_uuid((storage.foldername(name))[2]),
           (storage.foldername(name))[3], true));

create policy client_files_update on storage.objects for update to authenticated
  using (bucket_id = 'client-files' and public.storage_client_access(
           (storage.foldername(name))[1], public.safe_uuid((storage.foldername(name))[2]),
           (storage.foldername(name))[3], true));

create policy client_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'client-files' and public.storage_client_access(
           (storage.foldername(name))[1], public.safe_uuid((storage.foldername(name))[2]),
           (storage.foldername(name))[3], true));

-- ---------------------------------------------------------------------
-- 7. ÍNDICES Y PERMISOS DE FUNCIONES
-- ---------------------------------------------------------------------

do $$
declare r record;
begin
  -- Índices en columnas de alcance y de relación
  for r in
    select c.table_name, c.column_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
    where c.table_schema = 'public'
      and c.column_name in ('organization_id','trainer_id','client_id','program_id','assessment_id',
                            'session_id','week_id','workout_log_id','exercise_id','template_id',
                            'template_session_id','macrocycle_id','mesocycle_id','recipient_id',
                            'plan_id','profile_id','staff_id','notification_id')
      and not exists (
        select 1 from information_schema.key_column_usage k
        join information_schema.table_constraints tc
          on tc.constraint_name = k.constraint_name and tc.table_schema = k.table_schema
        where k.table_schema = 'public' and k.table_name = c.table_name and k.column_name = c.column_name
          and tc.constraint_type in ('PRIMARY KEY','UNIQUE'))
  loop
    execute format('create index if not exists %I on public.%I (%I)',
                   'idx_' || r.table_name || '_' || r.column_name, r.table_name, r.column_name);
  end loop;
end $$;

create index if not exists idx_metrics_lookup   on public.progress_metrics (client_id, metric_key, period_date);
create index if not exists idx_setlogs_history  on public.workout_set_logs (client_id, exercise_id, performed_at);
create index if not exists idx_messages_thread  on public.messages (client_id, created_at);
create index if not exists idx_notif_inbox      on public.notifications (recipient_id, read_at, created_at);
create index if not exists idx_payments_due     on public.payments (trainer_id, status, due_date);
create index if not exists idx_sessions_sched   on public.sessions (client_id, scheduled_date);
create index if not exists idx_assess_history   on public.assessments (client_id, assessed_at);
create index if not exists idx_alerts_open      on public.alerts (trainer_id, status);
create index if not exists idx_exercises_name   on public.exercises using gin (to_tsvector('spanish', name));

-- Permisos de ejecución: nada para anon, salvo check_invitation.
-- Las funciones de trigger y de mantenimiento no son invocables por RPC.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig, p.proname, (p.prorettype = 'trigger'::regtype) as is_trigger
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    if r.proname = 'check_invitation' then
      execute format('grant execute on function %s to anon, authenticated', r.sig);
    elsif not r.is_trigger and r.proname <> 'refresh_log_metrics' then
      execute format('grant execute on function %s to authenticated', r.sig);
    end if;
  end loop;
end $$;

-- Las vistas se consultan con los permisos del usuario (RLS aplica)
grant select on public.payments_with_status, public.v_adherence_weekly to authenticated;

-- =====================================================================
-- FIN. Siguiente paso manual (una sola vez):
--   Authentication > Users > Add user: crea el administrador (email + clave).
--   Como aún no hay Super Admin, el trigger lo marca automáticamente como tal.
-- =====================================================================
