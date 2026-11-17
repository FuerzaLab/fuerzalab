-- =====================================================================
-- DECIMOCTAVA MIGRACIÓN DE LA PARTE 4 (Fotos de progreso "solo para mí")
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- El alumno puede marcar cada foto de progreso que él subió como "solo para
-- mí": nadie más la ve (ni su entrenador, ni los asistentes, ni el Super
-- Admin), ni en la app, ni en los reportes, ni abriendo el archivo directo.
-- Por defecto las fotos se comparten con el entrenador, como hasta ahora.
-- Las fotos que sube el entrenador no se pueden ocultar.
--
--  * client_files.client_private (false = compartida).
--  * Regla RESTRICTIVA: una foto privada solo la ve/modifica su alumno.
--  * El alumno puede cambiar ese dato (y nada más) de sus propias fotos.
--  * Los archivos privados tampoco se pueden abrir desde Storage.
--  * client_private_photo_count(): cuántas fotos ocultas tiene un alumno
--    (para avisarle al entrenador, sin mostrárselas).
--  * release_private_photos_for_deletion(): al ELIMINAR por completo a un
--    alumno, permite borrar también sus fotos privadas.
-- =====================================================================

alter table public.client_files add column if not exists client_private boolean not null default false;
create index if not exists idx_client_files_storage_path on public.client_files (storage_path);

-- Una foto privada solo existe para su alumno.
drop policy if exists p_client_private on public.client_files;
create policy p_client_private on public.client_files as restrictive for all to authenticated
  using (not client_private or public.is_own_client(client_id, organization_id))
  with check (not client_private or public.is_own_client(client_id, organization_id));

-- El alumno puede actualizar sus fotos de progreso (el trigger de abajo deja cambiar solo client_private).
drop policy if exists p_client_update_private on public.client_files;
create policy p_client_update_private on public.client_files for update to authenticated
  using (public.is_own_client(client_id, organization_id) and kind = 'progress_photo' and visibility = 'client_and_trainer')
  with check (public.is_own_client(client_id, organization_id) and kind = 'progress_photo' and visibility = 'client_and_trainer');

create or replace function public.client_files_client_update_guard() returns trigger
language plpgsql as $$
declare
  v_private boolean;
begin
  if public.auth_role() is distinct from 'client' or coalesce(current_setting('app.internal', true), '') = '1' then
    return new;
  end if;
  if new.client_private is distinct from old.client_private and new.client_private and old.uploaded_by is distinct from auth.uid() then
    raise exception 'Esta foto la subió tu entrenador, así que no se puede ocultar. Si no quieres que esté, pídele que la borre.' using errcode = '42501';
  end if;
  v_private := new.client_private;
  new := old;
  new.client_private := v_private;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists a_client_update_guard on public.client_files;
create trigger a_client_update_guard before update on public.client_files
  for each row execute function public.client_files_client_update_guard();

-- Los archivos de fotos privadas tampoco se abren desde Storage (salvo su alumno).
create or replace function public.photo_file_hidden(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.client_files f
    where f.storage_path = p_name and f.client_private
      and not public.is_own_client(f.client_id, f.organization_id))
$$;
grant execute on function public.photo_file_hidden(text) to authenticated;

drop policy if exists client_files_private_photos on storage.objects;
create policy client_files_private_photos on storage.objects as restrictive for select to authenticated
  using (bucket_id <> 'client-files' or not public.photo_file_hidden(name));

-- Cuántas fotos ocultas tiene un alumno (solo el número, para su entrenador o sus asistentes).
create or replace function public.client_private_photo_count(p_client uuid) returns int
language sql stable security definer set search_path = public as $$
  select case when exists (
           select 1 from public.clients c
           where c.id = p_client
             and (c.trainer_id = auth.uid() or public.staff_can(c.trainer_id, 'files', 'read')))
         then (select count(*)::int from public.client_files f
               where f.client_id = p_client and f.kind = 'progress_photo' and f.client_private)
         else 0 end
$$;
grant execute on function public.client_private_photo_count(uuid) to authenticated;

-- Al eliminar por completo a un alumno: sus fotos privadas también se borran.
create or replace function public.release_private_photos_for_deletion(p_client uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.clients c where c.id = p_client and (c.trainer_id = auth.uid() or public.is_super_admin())) then
    raise exception 'No tienes permiso para eliminar a este alumno.' using errcode = '42501';
  end if;
  perform set_config('app.internal', '1', true);
  update public.client_files set client_private = false where client_id = p_client and client_private;
end $$;
grant execute on function public.release_private_photos_for_deletion(uuid) to authenticated;
