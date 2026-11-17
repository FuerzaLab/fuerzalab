-- =====================================================================
-- VIGESIMOPRIMERA MIGRACIÓN DE LA PARTE 4 (Pedidos de la abogada)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
-- Requiere part4p, part4q, part4r y part4t.
--
--  1. Alumno suspendido por falta de pago: su entrenador (y sus asistentes)
--     siguen viendo sus datos solo 30 días más (platform_settings
--     .trainer_access_days). Después, sus datos de salud, entrenamientos,
--     evaluaciones, fotos y mensajes quedan ocultos para el entrenador
--     hasta que el alumno pague. Solo aplica con el cobro a alumnos activo.
--  2. Borrado en los plazos de los Términos (lo decide el Super Admin):
--     clients.archived_at (fecha de la baja), clients.deletion_requested_at
--     y admin_deletion_candidates() para el panel "Datos por borrar".
--     El Super Admin puede borrar los archivos SOLO de los alumnos que marcó
--     para borrar.
--  3. Mensajes de menores: enlace privado de solo lectura para el tutor
--     (guardian_links + guardian_messages(token), sin iniciar sesión).
--  4. Autorización de menores actualizada: las autorizaciones ya subidas
--     deben renovarse en 30 días; si no, la ficha del menor se bloquea.
-- =====================================================================

-- 1. Acceso del entrenador a los datos de un alumno suspendido -------------
alter table public.platform_settings add column if not exists trainer_access_days int not null default 30 check (trainer_access_days >= 0);

-- ¿Este alumno está suspendido hace más de los días permitidos? (true = ocultar al entrenador y su equipo)
create or replace function public.client_data_hidden_for_trainer(p_client uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    public.auth_role() in ('trainer', 'staff')
    and exists (
      select 1
      from public.clients c, public.platform_settings s
      where c.id = p_client and s.id = 1
        and s.student_billing_enabled
        and not c.student_billing_exempt
        and c.access_until is not null
        and current_date > c.access_until + s.grace_days + s.trainer_access_days
    ), false)
$$;
grant execute on function public.client_data_hidden_for_trainer(uuid) to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'client_profiles', 'assessments', 'body_measurements', 'circumferences', 'skinfolds',
    'strength_tests', 'power_tests', 'endurance_tests', 'flexibility_tests', 'mobility_tests',
    'performance_tests', 'custom_test_results', 'progress_metrics', 'wellness_logs',
    'workout_logs', 'workout_set_logs', 'workout_exercise_logs', 'client_files', 'messages'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists p_suspended_hidden on public.%I', t);
      execute format(
        'create policy p_suspended_hidden on public.%I as restrictive for all to authenticated '
        'using (not public.client_data_hidden_for_trainer(client_id)) with check (not public.client_data_hidden_for_trainer(client_id))', t);
    end if;
  end loop;
end $$;

-- Los archivos del alumno (fotos, comprobantes) tampoco.
create or replace function public.storage_client_hidden_for_trainer(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.client_data_hidden_for_trainer(public.safe_uuid((storage.foldername(p_name))[2]))
$$;
grant execute on function public.storage_client_hidden_for_trainer(text) to authenticated;

drop policy if exists client_files_suspended_hidden on storage.objects;
create policy client_files_suspended_hidden on storage.objects as restrictive for select to authenticated
  using (bucket_id <> 'client-files' or not public.storage_client_hidden_for_trainer(name));

-- 2. Borrado en los plazos ---------------------------------------------------
alter table public.clients add column if not exists archived_at timestamptz;
alter table public.clients add column if not exists deletion_requested_at timestamptz;

update public.clients set archived_at = updated_at where status = 'archived' and archived_at is null;

create or replace function public.clients_track_archived() returns trigger
language plpgsql as $$
begin
  if new.status = 'archived' and (tg_op = 'INSERT' or old.status is distinct from 'archived') then
    new.archived_at := now();
  elsif new.status <> 'archived' then
    new.archived_at := null;
  end if;
  return new;
end $$;
drop trigger if exists b_track_archived on public.clients;
create trigger b_track_archived before insert or update of status on public.clients
  for each row execute function public.clients_track_archived();

-- Alumnos que ya cumplieron un plazo de borrado (solo Super Admin).
--   trial_ended : terminó su prueba, nunca pagó y lleva más de 30 días suspendido.
--   suspended   : pagó alguna vez y lleva más de 6 meses suspendido.
--   archived    : dado de baja hace más de 12 meses.
drop function if exists public.admin_deletion_candidates();
create or replace function public.admin_deletion_candidates()
returns table (
  client_id uuid, organization_id uuid, client_name text, client_phone text, organization_name text, trainer_name text,
  reason text, since date, has_account boolean, deletion_requested_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_s public.platform_settings%rowtype;
begin
  if not coalesce(public.is_super_admin(), false) then
    raise exception 'Solo el Super Admin.' using errcode = '42501';
  end if;
  select * into v_s from public.platform_settings where id = 1;
  return query
  select c.id, c.organization_id, c.full_name, c.phone, o.name, p.full_name,
         case
           when c.status = 'archived' then 'archived'
           when exists (select 1 from public.student_payments sp where sp.client_id = c.id and sp.status = 'approved') then 'suspended'
           else 'trial_ended'
         end,
         case when c.status = 'archived' then c.archived_at::date else c.access_until + v_s.grace_days end,
         c.profile_id is not null,
         c.deletion_requested_at
  from public.clients c
  join public.organizations o on o.id = c.organization_id
  left join public.profiles p on p.id = c.trainer_id
  where (c.status = 'archived' and c.archived_at < now() - interval '12 months')
     or (c.status <> 'archived' and v_s.student_billing_enabled and not c.student_billing_exempt
         and c.access_until is not null
         and (
           (not exists (select 1 from public.student_payments sp where sp.client_id = c.id and sp.status = 'approved')
            and current_date > c.access_until + v_s.grace_days + 30)
           or (current_date > (c.access_until + v_s.grace_days + interval '6 months')::date)
         ))
  order by 8;
end $$;
grant execute on function public.admin_deletion_candidates() to authenticated;

-- Marcar para borrar: habilita al Super Admin a borrar los archivos de ESE alumno
-- (y libera sus fotos "solo para mí", para que también se borren).
create or replace function public.admin_request_client_deletion(p_client uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(public.is_super_admin(), false) then
    raise exception 'Solo el Super Admin.' using errcode = '42501';
  end if;
  perform set_config('app.internal', '1', true);
  update public.clients set deletion_requested_at = now() where id = p_client;
  update public.client_files set client_private = false where client_id = p_client and client_private;
end $$;
grant execute on function public.admin_request_client_deletion(uuid) to authenticated;

create or replace function public.storage_admin_can_delete(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.is_super_admin() and exists (
    select 1 from public.clients c
    where c.id = public.safe_uuid((storage.foldername(p_name))[2]) and c.deletion_requested_at is not null), false)
$$;
grant execute on function public.storage_admin_can_delete(text) to authenticated;

drop policy if exists client_files_admin_deletion_select on storage.objects;
drop policy if exists client_files_admin_deletion_delete on storage.objects;
create policy client_files_admin_deletion_select on storage.objects for select to authenticated
  using (bucket_id = 'client-files' and public.storage_admin_can_delete(name));
create policy client_files_admin_deletion_delete on storage.objects for delete to authenticated
  using (bucket_id = 'client-files' and public.storage_admin_can_delete(name));

-- 3. Enlace de solo lectura para el tutor -----------------------------------
create table if not exists public.guardian_links (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  token       text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '90 days',
  revoked_at  timestamptz
);
create index if not exists idx_guardian_links_client on public.guardian_links (client_id);

alter table public.guardian_links enable row level security;
drop policy if exists p_trainer on public.guardian_links;
create policy p_trainer on public.guardian_links for all to authenticated
  using (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = auth.uid()))
  with check (exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = auth.uid()));

-- Lo que ve el tutor con su enlace (sin iniciar sesión): solo los mensajes.
create or replace function public.guardian_messages(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_link public.guardian_links%rowtype;
  v_client public.clients%rowtype;
  v_trainer text;
begin
  select * into v_link from public.guardian_links
   where token = p_token and revoked_at is null and expires_at > now();
  if not found then
    return jsonb_build_object('ok', false);
  end if;
  select * into v_client from public.clients where id = v_link.client_id;
  select full_name into v_trainer from public.profiles where id = v_client.trainer_id;
  return jsonb_build_object(
    'ok', true,
    'client', split_part(v_client.full_name, ' ', 1),
    'trainer', v_trainer,
    'expires_at', v_link.expires_at,
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
               'from_trainer', m.sender_id is distinct from v_client.profile_id,
               'sender', coalesce(pr.full_name, ''),
               'body', m.body,
               'has_attachment', m.attachment_path is not null,
               'at', m.created_at) order by m.created_at)
      from public.messages m
      left join public.profiles pr on pr.id = m.sender_id
      where m.client_id = v_client.id), '[]'::jsonb));
end $$;
grant execute on function public.guardian_messages(text) to anon, authenticated;

-- 4. Autorización de menores actualizada --------------------------------------
alter table public.clients add column if not exists guardian_consent_version text;
alter table public.clients add column if not exists guardian_consent_renew_by date;

-- Las autorizaciones ya subidas (versión anterior) se renuevan en 30 días.
do $$
begin
  perform set_config('app.internal', '1', true);
  update public.clients
     set guardian_consent_renew_by = current_date + 30
   where guardian_consent_at is not null and guardian_consent_version is null and guardian_consent_renew_by is null;
end $$;

-- La ficha se bloquea si es menor y falta la autorización, o si venció el plazo para renovarla.
create or replace function public.client_data_locked(p_client uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select cp.birth_date > (current_date - interval '18 years')::date
    from public.client_profiles cp where cp.client_id = p_client
  ), false)
  and coalesce((
    select c.guardian_consent_at is null
           or (c.guardian_consent_renew_by is not null and current_date > c.guardian_consent_renew_by)
    from public.clients c where c.id = p_client
  ), false)
$$;
