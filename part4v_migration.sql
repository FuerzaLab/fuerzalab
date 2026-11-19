-- =====================================================================
-- VIGESIMOSEGUNDA MIGRACIÓN DE LA PARTE 4 (Orden de los bloques de una rutina)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- En el Constructor, el entrenador puede ordenar los bloques de una rutina
-- (Calentamiento, Principal, Cardio…) arrastrándolos o con ▲ ▼.
--  * reorder_session_blocks(rutina, bloques en orden): guarda el orden y, en
--    rutinas fijas, lo copia a las próximas veces de esa rutina.
--  * fixed_copy_session_content (rutinas fijas) ahora empareja los bloques
--    por tipo (antes, por tipo y posición) y copia también su orden: así,
--    cambiar el orden no duplica bloques en las próximas semanas.
-- Corre con los permisos de quien la usa (las reglas de seguridad de siempre).
-- =====================================================================

create or replace function public.reorder_session_blocks(p_session uuid, p_block_ids uuid[]) returns void
language plpgsql set search_path = public as $$
declare
  i int;
begin
  for i in 1 .. coalesce(array_length(p_block_ids, 1), 0) loop
    update public.session_blocks set sort_order = i - 1
     where id = p_block_ids[i] and session_id = p_session and sort_order is distinct from i - 1;
  end loop;
  perform public.fixed_sync_slot(p_session);
end $$;
grant execute on function public.reorder_session_blocks(uuid, uuid[]) to authenticated;

create or replace function public.fixed_copy_session_content(p_from uuid, p_to uuid) returns void
language plpgsql set search_path = public as $$
declare
  b record;
  v_target_block uuid;
begin
  delete from public.workout_exercises where session_id = p_to;
  -- Los bloques de destino se emparejan por tipo (y toman el orden del original); si falta alguno, se crea.
  for b in select * from public.session_blocks where session_id = p_from order by sort_order loop
    select id into v_target_block from public.session_blocks
     where session_id = p_to and kind = b.kind
     order by (sort_order = b.sort_order) desc, sort_order
     limit 1;
    if v_target_block is null then
      insert into public.session_blocks
      select (jsonb_populate_record(null::public.session_blocks,
              to_jsonb(b) || jsonb_build_object('id', gen_random_uuid(), 'session_id', p_to))).*
      returning id into v_target_block;
    else
      update public.session_blocks set sort_order = b.sort_order
       where id = v_target_block and sort_order is distinct from b.sort_order;
    end if;
    insert into public.workout_exercises
    select (jsonb_populate_record(null::public.workout_exercises,
            to_jsonb(e) || jsonb_build_object('id', gen_random_uuid(), 'session_id', p_to, 'block_id', v_target_block))).*
    from public.workout_exercises e where e.session_id = p_from and e.block_id = b.id;
  end loop;
end $$;
