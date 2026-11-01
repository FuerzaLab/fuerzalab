-- =====================================================================
-- VIGESIMOTERCERA MIGRACIÓN DE LA PARTE 3 (Videos de YouTube o Vimeo en ejercicios)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- Cada ejercicio puede tener un enlace a un video de YouTube o Vimeo, que se
-- reproduce DENTRO de FuerzaLab (insertado, no descargado). Si el video deja
-- de estar disponible (lo borraron, lo pasaron a privado o desactivaron la
-- inserción), la app lo marca y le avisa al entrenador en Novedades.
--
--  * exercises.video_url: el enlace.
--  * exercises.video_status: 'broken' cuando se detectó que no funciona;
--    vacío cuando está bien (o nunca se revisó).
--  * exercises.video_checked_at / video_broken_reason: cuándo y por qué.
--  * report_exercise_video_broken(): cualquiera que vea el ejercicio (por
--    ejemplo, un alumno al intentar ver el video) puede avisar que no
--    funciona. Solo marca ese estado: no permite cambiar nada más.
--  * Al guardar un enlace nuevo, el estado se limpia solo (trigger).
-- =====================================================================

alter table public.exercises add column if not exists video_url text;
alter table public.exercises add column if not exists video_status text check (video_status in ('broken'));
alter table public.exercises add column if not exists video_checked_at timestamptz;
alter table public.exercises add column if not exists video_broken_reason text;

create or replace function public.exercises_reset_video_status() returns trigger
language plpgsql as $$
begin
  if new.video_url is distinct from old.video_url then
    new.video_status := null;
    new.video_broken_reason := null;
    new.video_checked_at := null;
  end if;
  return new;
end $$;

drop trigger if exists a_reset_video_status on public.exercises;
create trigger a_reset_video_status before update on public.exercises
  for each row execute function public.exercises_reset_video_status();

create or replace function public.report_exercise_video_broken(p_exercise uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_ok boolean;
begin
  -- Solo quien puede ver el ejercicio (las mismas reglas de siempre) puede avisar.
  select exists (
    select 1 from public.exercises e
    where e.id = p_exercise and e.video_url is not null
      and (e.scope = 'global'
           or e.organization_id = public.auth_org()
           or public.is_super_admin())
  ) into v_ok;
  if not v_ok then
    return;
  end if;
  update public.exercises
     set video_status = 'broken',
         video_broken_reason = left(coalesce(p_reason, ''), 200),
         video_checked_at = now()
   where id = p_exercise;
end $$;
grant execute on function public.report_exercise_video_broken(uuid, text) to authenticated;
