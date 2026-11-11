-- =====================================================================
-- NOVENA MIGRACIÓN DE LA PARTE 4 (Rutinas fijas: copiar y cambiar de lugar)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
-- Requiere part4d_migration.sql (rutinas fijas).
--
--  * fixed_swap_days: intercambia el lugar de dos rutinas (Día A ↔ Día B)
--    desde esta semana en adelante. Solo en las semanas donde ninguna de las
--    dos se hizo todavía: lo ya entrenado queda como estaba.
--  * Permiso para copiar el contenido de una rutina a otra (para "Copiar").
-- =====================================================================

create or replace function public.fixed_swap_days(p_program uuid, p_sort_a int, p_sort_b int) returns void
language plpgsql set search_path = public as $$
declare
  v_cur int := coalesce(public.fixed_current_week(p_program), 1);
  w record;
  v_a uuid;
  v_b uuid;
begin
  if p_sort_a = p_sort_b then return; end if;
  perform set_config('app.fixed_sync', '1', true);
  for w in select id from public.weeks where program_id = p_program and week_number >= v_cur loop
    select id into v_a from public.sessions where week_id = w.id and sort_order = p_sort_a limit 1;
    select id into v_b from public.sessions where week_id = w.id and sort_order = p_sort_b limit 1;
    -- Las dos tienen que estar sin hacer (si no, se mezclaría el historial).
    if v_a is not null and public.session_is_done(v_a) then continue; end if;
    if v_b is not null and public.session_is_done(v_b) then continue; end if;
    if v_a is not null then update public.sessions set sort_order = -1 where id = v_a; end if;
    if v_b is not null then update public.sessions set sort_order = p_sort_a where id = v_b; end if;
    if v_a is not null then update public.sessions set sort_order = p_sort_b where id = v_a; end if;
  end loop;
  perform set_config('app.fixed_sync', '', true);
end $$;
grant execute on function public.fixed_swap_days(uuid, int, int) to authenticated;

grant execute on function public.fixed_copy_session_content(uuid, uuid) to authenticated;
