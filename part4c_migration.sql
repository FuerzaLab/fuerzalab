-- =====================================================================
-- TERCERA MIGRACIÓN DE LA PARTE 4 (Rutinas realizadas: no se modifican)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- Una rutina (sesión) que el alumno ya marcó como realizada queda como
-- historial y no se puede modificar:
--  * no se le pueden agregar, cambiar ni quitar ejercicios o bloques;
--  * no se puede eliminar la rutina (borraría su registro);
--  * las series registradas de ese entrenamiento ya no se pueden cambiar.
-- Sí se puede: cambiarle el nombre, reordenarla entre las rutinas de la
-- semana, duplicarla y copiarla a otra semana (para cambiar la copia).
--
-- Borrar el programa entero o el alumno sigue funcionando (borra todo,
-- como antes). El Super Admin no tiene este bloqueo, por si hiciera falta
-- corregir algo.
-- =====================================================================

create or replace function public.session_is_done(p_session uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workout_logs l where l.session_id = p_session and l.status = 'completed')
$$;
grant execute on function public.session_is_done(uuid) to authenticated;

-- Ejercicios y bloques de una rutina realizada.
create or replace function public.guard_done_session_content() returns trigger
language plpgsql as $$
declare
  v_session uuid := coalesce(new.session_id, old.session_id);
begin
  -- Borrados en cascada (al borrar el programa o el alumno): se permiten.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return old; end if;
  if coalesce(current_setting('app.internal', true), '') = '1' or public.is_super_admin() then
    return coalesce(new, old);
  end if;
  if public.session_is_done(v_session) then
    raise exception 'Esta rutina ya fue realizada y no se puede modificar. Para cambiarla, duplícala o cópiala a otra semana.'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists c_guard_done_session on public.workout_exercises;
create trigger c_guard_done_session before insert or update or delete on public.workout_exercises
  for each row execute function public.guard_done_session_content();

drop trigger if exists c_guard_done_session on public.session_blocks;
create trigger c_guard_done_session before insert or update or delete on public.session_blocks
  for each row execute function public.guard_done_session_content();

-- Eliminar una rutina realizada (directamente, no en cascada).
create or replace function public.guard_done_session_delete() returns trigger
language plpgsql as $$
begin
  if pg_trigger_depth() > 1 then return old; end if;
  if coalesce(current_setting('app.internal', true), '') = '1' or public.is_super_admin() then return old; end if;
  if public.session_is_done(old.id) then
    raise exception 'Esta rutina ya fue realizada: no se puede eliminar porque se perdería su registro.'
      using errcode = '42501';
  end if;
  return old;
end $$;

drop trigger if exists c_guard_done_session_delete on public.sessions;
create trigger c_guard_done_session_delete before delete on public.sessions
  for each row execute function public.guard_done_session_delete();

-- Series de un entrenamiento ya terminado: no se cambian.
create or replace function public.guard_done_set_logs() returns trigger
language plpgsql as $$
declare
  v_log uuid := coalesce(new.workout_log_id, old.workout_log_id);
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return old; end if;
  if coalesce(current_setting('app.internal', true), '') = '1' or public.is_super_admin() then
    return coalesce(new, old);
  end if;
  if exists (select 1 from public.workout_logs l where l.id = v_log and l.status = 'completed') then
    raise exception 'Este entrenamiento ya fue terminado: sus series no se pueden modificar.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists c_guard_done_set_logs on public.workout_set_logs;
create trigger c_guard_done_set_logs before insert or update or delete on public.workout_set_logs
  for each row execute function public.guard_done_set_logs();
