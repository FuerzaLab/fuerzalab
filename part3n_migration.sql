-- =====================================================================
-- DÉCIMOTERCERA MIGRACIÓN DE LA PARTE 3 (Comentario destacado por serie)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- Tabla nueva — no toca ninguna de las que ya tenés. Permite dejar un
-- comentario en una serie puntual de un ejercicio (por ejemplo, "Serie 3:
-- hacer con TUT 4-0-2"), que el cliente ve resaltado al entrenar esa
-- serie en particular.
-- =====================================================================

create table public.workout_exercise_set_notes (
  id                  uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  set_number          int not null check (set_number > 0),
  note                text not null,
  created_at          timestamptz not null default now(),
  unique (workout_exercise_id, set_number)
);

create index idx_set_notes_workout_exercise on public.workout_exercise_set_notes (workout_exercise_id);

alter table public.workout_exercise_set_notes enable row level security;

-- El entrenador (o un asistente con permiso) puede ver y escribir las
-- notas de sus propios ejercicios. El cliente solo puede leerlas, y solo
-- las de un programa ya publicado — mismo criterio que ya usan las demás
-- tablas de rutinas.
create policy p_select on public.workout_exercise_set_notes for select to authenticated
  using (
    exists (
      select 1 from public.workout_exercises we
      where we.id = workout_exercise_id
        and (
          we.trainer_id = auth.uid()
          or public.staff_can(we.trainer_id, 'programs', 'read')
          or (public.auth_role() = 'client' and we.client_id = public.my_client_id() and public.program_published(we.program_id))
        )
    )
  );

create policy p_write on public.workout_exercise_set_notes for all to authenticated
  using (
    exists (
      select 1 from public.workout_exercises we
      where we.id = workout_exercise_id
        and (we.trainer_id = auth.uid() or public.staff_can(we.trainer_id, 'programs', 'write'))
    )
  )
  with check (
    exists (
      select 1 from public.workout_exercises we
      where we.id = workout_exercise_id
        and (we.trainer_id = auth.uid() or public.staff_can(we.trainer_id, 'programs', 'write'))
    )
  );
