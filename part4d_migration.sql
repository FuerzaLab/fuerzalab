-- =====================================================================
-- CUARTA MIGRACIÓN DE LA PARTE 4 (Rutinas fijas, sin planificar)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
-- Requiere haber corrido antes part4c_migration.sql.
--
-- Muchos entrenadores no planifican por semanas: arman los días (Día A, B,
-- C) y los repiten. Para ellos, un programa puede ser de "rutinas fijas":
--  * programs.plan_mode = 'fixed' (vacío o 'weekly' = plan por semanas,
--    como siempre).
--  * Por dentro siguen siendo semanas (así el alumno ve su rutina de hoy y
--    las rutinas realizadas quedan como historial), pero las crea y las
--    copia la base de datos sola: el entrenador solo ve los días.
--  * Cuando el entrenador cambia un día, el cambio se copia SOLO a las
--    próximas veces de ese día que todavía no se hicieron. Lo ya entrenado
--    no se toca.
--  * fixed_extend: mantiene siempre varias semanas por delante (se llama
--    sola al abrir el Constructor o la rutina del alumno).
--  * fixed_add_day / fixed_update_day / fixed_delete_day: agregar, renombrar
--    o cambiar de día, y quitar un día, desde esta semana en adelante.
-- =====================================================================

alter table public.programs
  add column if not exists plan_mode text check (plan_mode in ('fixed', 'weekly'));

-- Semana "actual" de un programa (1 = la de su fecha de inicio).
create or replace function public.fixed_current_week(p_program uuid) returns int
language sql stable security definer set search_path = public as $$
  select greatest(1, floor((current_date - w.start_date) / 7.0)::int + 1)
  from public.weeks w where w.program_id = p_program and w.week_number = 1 and w.start_date is not null
$$;

-- Copia el contenido (ejercicios) de una rutina a otra, reemplazando lo que tenía.
create or replace function public.fixed_copy_session_content(p_from uuid, p_to uuid) returns void
language plpgsql set search_path = public as $$
declare
  b record;
  v_target_block uuid;
begin
  delete from public.workout_exercises where session_id = p_to;
  -- Los bloques de destino se emparejan por tipo y orden; si falta alguno, se crea.
  for b in select * from public.session_blocks where session_id = p_from order by sort_order loop
    select id into v_target_block from public.session_blocks
     where session_id = p_to and kind = b.kind and sort_order = b.sort_order limit 1;
    if v_target_block is null then
      insert into public.session_blocks
      select (jsonb_populate_record(null::public.session_blocks,
              to_jsonb(b) || jsonb_build_object('id', gen_random_uuid(), 'session_id', p_to))).*
      returning id into v_target_block;
    end if;
    insert into public.workout_exercises
    select (jsonb_populate_record(null::public.workout_exercises,
            to_jsonb(e) || jsonb_build_object('id', gen_random_uuid(), 'session_id', p_to, 'block_id', v_target_block))).*
    from public.workout_exercises e where e.session_id = p_from and e.block_id = b.id;
  end loop;
end $$;

-- Copia una rutina a sus próximas veces (mismo lugar, semanas siguientes) que todavía no se hicieron.
create or replace function public.fixed_sync_slot(p_session uuid) returns void
language plpgsql set search_path = public as $$
declare
  v_src public.sessions%rowtype;
  v_week int;
  t record;
begin
  select * into v_src from public.sessions where id = p_session;
  if not found then return; end if;
  if (select plan_mode from public.programs where id = v_src.program_id) is distinct from 'fixed' then return; end if;
  select week_number into v_week from public.weeks where id = v_src.week_id;
  perform set_config('app.fixed_sync', '1', true);
  for t in
    select s.id from public.sessions s join public.weeks w on w.id = s.week_id
     where s.program_id = v_src.program_id and s.sort_order = v_src.sort_order and w.week_number > v_week
       and not public.session_is_done(s.id)
  loop
    perform public.fixed_copy_session_content(p_session, t.id);
  end loop;
  perform set_config('app.fixed_sync', '', true);
end $$;
grant execute on function public.fixed_sync_slot(uuid) to authenticated;

-- Automático: al cambiar ejercicios de una rutina fija, se copia a las próximas veces.
-- (Postgres pide un trigger por tipo de cambio cuando se usan tablas de transición.)
create or replace function public.fixed_after_exercise_insert() returns trigger
language plpgsql set search_path = public as $$
declare v_id uuid;
begin
  if coalesce(current_setting('app.fixed_sync', true), '') = '1' then return null; end if;
  for v_id in select distinct session_id from changed_new loop perform public.fixed_sync_slot(v_id); end loop;
  return null;
end $$;
create or replace function public.fixed_after_exercise_delete() returns trigger
language plpgsql set search_path = public as $$
declare v_id uuid;
begin
  if coalesce(current_setting('app.fixed_sync', true), '') = '1' then return null; end if;
  if pg_trigger_depth() > 1 then return null; end if;  -- borrados en cascada (programa, alumno)
  for v_id in select distinct session_id from changed_old loop perform public.fixed_sync_slot(v_id); end loop;
  return null;
end $$;
create or replace function public.fixed_after_exercise_update() returns trigger
language plpgsql set search_path = public as $$
declare v_id uuid;
begin
  if coalesce(current_setting('app.fixed_sync', true), '') = '1' then return null; end if;
  for v_id in select distinct session_id from changed_new loop perform public.fixed_sync_slot(v_id); end loop;
  return null;
end $$;

drop trigger if exists z_fixed_sync_ins on public.workout_exercises;
create trigger z_fixed_sync_ins after insert on public.workout_exercises
  referencing new table as changed_new for each statement execute function public.fixed_after_exercise_insert();
drop trigger if exists z_fixed_sync_upd on public.workout_exercises;
create trigger z_fixed_sync_upd after update on public.workout_exercises
  referencing new table as changed_new for each statement execute function public.fixed_after_exercise_update();
drop trigger if exists z_fixed_sync_del on public.workout_exercises;
create trigger z_fixed_sync_del after delete on public.workout_exercises
  referencing old table as changed_old for each statement execute function public.fixed_after_exercise_delete();

-- Mantiene semanas por delante: crea las que falten copiando la última semana.
create or replace function public.fixed_extend(p_program uuid, p_weeks_ahead int default 8) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_prog public.programs%rowtype;
  v_cur int;
  v_last public.weeks%rowtype;
  v_new_week uuid;
  s record;
  v_new_session uuid;
begin
  select * into v_prog from public.programs where id = p_program;
  if not found or v_prog.plan_mode is distinct from 'fixed' then return; end if;
  -- Solo el equipo de esa organización o el propio alumno.
  if not (public.is_super_admin() or v_prog.organization_id = public.auth_org()) then return; end if;
  v_cur := coalesce(public.fixed_current_week(p_program), 1);
  perform set_config('app.fixed_sync', '1', true);
  loop
    select * into v_last from public.weeks where program_id = p_program order by week_number desc limit 1;
    exit when v_last.id is null or v_last.week_number >= v_cur + p_weeks_ahead;
    insert into public.weeks
    select (jsonb_populate_record(null::public.weeks,
            to_jsonb(v_last) || jsonb_build_object('id', gen_random_uuid(), 'week_number', v_last.week_number + 1, 'start_date', null))).*
    returning id into v_new_week;
    for s in select * from public.sessions where week_id = v_last.id order by sort_order loop
      insert into public.sessions
      select (jsonb_populate_record(null::public.sessions,
              to_jsonb(s) || jsonb_build_object('id', gen_random_uuid(), 'week_id', v_new_week, 'status', 'planned', 'scheduled_date', null))).*
      returning id into v_new_session;
      perform public.fixed_copy_session_content(s.id, v_new_session);
    end loop;
  end loop;
  perform set_config('app.fixed_sync', '', true);
end $$;
grant execute on function public.fixed_extend(uuid, int) to authenticated;

-- Agregar un día (desde esta semana en adelante).
create or replace function public.fixed_add_day(p_program uuid, p_name text, p_day int) returns uuid
language plpgsql set search_path = public as $$
declare
  v_cur int := coalesce(public.fixed_current_week(p_program), 1);
  v_sort int;
  w record;
  v_new uuid;
  v_first uuid;
begin
  select coalesce(max(s.sort_order), -1) + 1 into v_sort from public.sessions s where s.program_id = p_program;
  for w in select * from public.weeks where program_id = p_program and week_number >= v_cur order by week_number loop
    insert into public.sessions (organization_id, trainer_id, client_id, program_id, week_id, day_of_week, sort_order, name)
    values (w.organization_id, w.trainer_id, w.client_id, p_program, w.id, p_day, v_sort, p_name)
    returning id into v_new;
    -- Los mismos bloques que crea la app para una rutina nueva.
    insert into public.session_blocks (organization_id, trainer_id, client_id, program_id, session_id, kind, sort_order)
    select w.organization_id, w.trainer_id, w.client_id, p_program, v_new, k.kind, k.ord - 1
      from unnest(array['warmup', 'main', 'cardio', 'mobility', 'flexibility']) with ordinality as k(kind, ord);
    if v_first is null then v_first := v_new; end if;
  end loop;
  return v_first;
end $$;
grant execute on function public.fixed_add_day(uuid, text, int) to authenticated;

-- Renombrar o cambiar de día (desde esta semana, en las veces que no se hicieron).
create or replace function public.fixed_update_day(p_program uuid, p_sort int, p_name text, p_day int) returns void
language plpgsql set search_path = public as $$
declare
  v_cur int := coalesce(public.fixed_current_week(p_program), 1);
begin
  update public.sessions s set name = p_name, day_of_week = p_day
    from public.weeks w
   where w.id = s.week_id and s.program_id = p_program and s.sort_order = p_sort
     and w.week_number >= v_cur and not public.session_is_done(s.id);
end $$;
grant execute on function public.fixed_update_day(uuid, int, text, int) to authenticated;

-- Quitar un día (las veces que no se hicieron, desde esta semana). Lo ya hecho queda.
create or replace function public.fixed_delete_day(p_program uuid, p_sort int) returns void
language plpgsql set search_path = public as $$
declare
  v_cur int := coalesce(public.fixed_current_week(p_program), 1);
begin
  delete from public.sessions s using public.weeks w
   where w.id = s.week_id and s.program_id = p_program and s.sort_order = p_sort
     and w.week_number >= v_cur and not public.session_is_done(s.id);
end $$;
grant execute on function public.fixed_delete_day(uuid, int) to authenticated;

-- Renombrar o cambiar de día una rutina fija en el Constructor: se aplica a
-- sus próximas veces que todavía no se hicieron.
create or replace function public.fixed_after_session_update() returns trigger
language plpgsql set search_path = public as $$
declare
  v_week int;
begin
  if coalesce(current_setting('app.fixed_sync', true), '') = '1' then return null; end if;
  if (select plan_mode from public.programs where id = new.program_id) is distinct from 'fixed' then return null; end if;
  if new.name is not distinct from old.name and new.day_of_week is not distinct from old.day_of_week then return null; end if;
  select week_number into v_week from public.weeks where id = new.week_id;
  perform set_config('app.fixed_sync', '1', true);
  update public.sessions s set name = new.name, day_of_week = new.day_of_week
    from public.weeks w
   where w.id = s.week_id and s.program_id = new.program_id and s.sort_order = new.sort_order
     and w.week_number > v_week and not public.session_is_done(s.id);
  perform set_config('app.fixed_sync', '', true);
  return null;
end $$;

drop trigger if exists z_fixed_session_sync on public.sessions;
create trigger z_fixed_session_sync after update of name, day_of_week on public.sessions
  for each row execute function public.fixed_after_session_update();
