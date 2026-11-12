-- =====================================================================
-- DUODÉCIMA MIGRACIÓN DE LA PARTE 4 (Menores: fotos de progreso)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
-- Requiere part4k_migration.sql.
--
--  * Al subir la autorización firmada, el entrenador indica si el tutor
--    autorizó las fotos de progreso (clients.guardian_photos_ok).
--  * La base de datos no deja guardar fotos de progreso de un alumno menor
--    de 18 años sin esa autorización (ni desde la app del alumno ni desde la
--    del entrenador).
-- =====================================================================

alter table public.clients add column if not exists guardian_photos_ok boolean not null default false;

create or replace function public.progress_photos_minor_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_birth date;
  v_ok boolean;
begin
  if new.kind is distinct from 'progress_photo' then return new; end if;
  select cp.birth_date into v_birth from public.client_profiles cp where cp.client_id = new.client_id;
  if v_birth is null or v_birth <= (current_date - interval '18 years')::date then
    return new; -- mayor de edad (o sin fecha de nacimiento)
  end if;
  select c.guardian_consent_at is not null and c.guardian_photos_ok into v_ok from public.clients c where c.id = new.client_id;
  if not coalesce(v_ok, false) then
    raise exception 'Las fotos de progreso de este alumno no están autorizadas por su madre, padre o tutor.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists b_minor_photos on public.client_files;
create trigger b_minor_photos before insert on public.client_files
  for each row execute function public.progress_photos_minor_guard();
