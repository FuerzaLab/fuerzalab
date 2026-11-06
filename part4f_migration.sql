-- =====================================================================
-- SEXTA MIGRACIÓN DE LA PARTE 4 (Contacto de estudios y celular al invitar)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
--  * Cada organización (estudio o entrenador independiente) guarda su
--    contacto: persona, correo y WhatsApp. Sirve para cobrarle y para los
--    reportes y estados de cuenta.
--  * Las invitaciones guardan el celular (WhatsApp) del invitado. Cuando la
--    persona acepta y crea su cuenta, ese celular pasa a su perfil (si no
--    cargó otro).
-- =====================================================================

alter table public.organizations add column if not exists contact_name text;
alter table public.organizations add column if not exists contact_email text;
alter table public.organizations add column if not exists contact_phone text;

alter table public.invitations add column if not exists phone text;

create or replace function public.invitation_copy_phone() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted' and new.accepted_by is not null and new.phone is not null
     and (old.status is distinct from 'accepted' or old.accepted_by is distinct from new.accepted_by) then
    update public.profiles set phone = new.phone where id = new.accepted_by and (phone is null or phone = '');
  end if;
  return new;
end $$;

drop trigger if exists z_invitation_copy_phone on public.invitations;
create trigger z_invitation_copy_phone after update of status, accepted_by on public.invitations
  for each row execute function public.invitation_copy_phone();
