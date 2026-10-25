-- =====================================================================
-- DECIMOQUINTA MIGRACIÓN DE LA PARTE 3 (Equipo: clientes asignados a cada asistente)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
-- Requiere haber corrido antes part3o_migration.sql.
--
-- Hasta ahora, un asistente veía a TODOS los clientes de su entrenador
-- (dentro de las secciones habilitadas). Esto agrega la opción de que
-- vea solo los clientes que el entrenador le asigne a mano:
--
--   * staff_permissions.client_scope: 'all' (todos, como hasta ahora —
--     es el valor por defecto, así los asistentes que ya existen no
--     cambian) o 'assigned' (solo los asignados; un cliente nuevo no le
--     aparece hasta que se lo asignes).
--   * Tabla nueva staff_client_assignments: qué clientes ve cada asistente.
--   * Una regla RESTRICTIVA en cada tabla con datos de clientes. Postgres
--     la combina con "Y" con las reglas que ya existen: no las reemplaza
--     ni las toca, solo agrega un filtro más para el staff. Para el
--     entrenador, el cliente y el Super Admin no cambia nada.
--   * Las fotos (Storage) y los perfiles (nombre/email) de los clientes
--     respetan el mismo filtro.
-- =====================================================================

-- 1. Alcance por asistente ----------------------------------------------
alter table public.staff_permissions
  add column if not exists client_scope text not null default 'all'
  check (client_scope in ('all','assigned'));

-- El trigger que protege esta tabla solo dejaba modificar "permissions";
-- se recrea igual, sumando client_scope a lo que el entrenador puede cambiar.
drop trigger if exists b_guard_immutable on public.staff_permissions;
create trigger b_guard_immutable before update on public.staff_permissions
  for each row execute function public.guard_immutable_except('permissions', 'updated_at', 'client_scope');

-- Al aceptar una invitación, el alcance elegido viaja dentro de
-- "permissions" (clave _client_scope) porque así se copia solo desde la
-- invitación. Este trigger lo pasa a su columna y lo saca del jsonb.
create or replace function public.staff_permissions_extract_scope() returns trigger
language plpgsql as $$
begin
  if new.permissions ? '_client_scope' then
    if new.permissions ->> '_client_scope' in ('all','assigned') then
      new.client_scope := new.permissions ->> '_client_scope';
    end if;
    new.permissions := new.permissions - '_client_scope';
  end if;
  return new;
end $$;

drop trigger if exists a_extract_scope on public.staff_permissions;
create trigger a_extract_scope before insert or update on public.staff_permissions
  for each row execute function public.staff_permissions_extract_scope();

-- 2. Asignaciones ---------------------------------------------------------
create table if not exists public.staff_client_assignments (
  id          uuid primary key default gen_random_uuid(),
  trainer_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  staff_id    uuid not null references public.profiles(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (staff_id, client_id)
);

create index if not exists idx_staff_client_assignments_staff on public.staff_client_assignments (staff_id);

alter table public.staff_client_assignments enable row level security;

drop policy if exists p_select on public.staff_client_assignments;
drop policy if exists p_write on public.staff_client_assignments;

create policy p_select on public.staff_client_assignments for select to authenticated
  using (public.is_super_admin() or trainer_id = auth.uid() or staff_id = auth.uid());

-- Solo el entrenador asigna, y solo SUS clientes a SUS asistentes.
create policy p_write on public.staff_client_assignments for all to authenticated
  using (public.auth_role() = 'trainer' and trainer_id = auth.uid())
  with check (
    public.auth_role() = 'trainer'
    and trainer_id = auth.uid()
    and exists (select 1 from public.clients c where c.id = client_id and c.trainer_id = auth.uid())
    and exists (select 1 from public.staff_permissions sp where sp.staff_id = staff_client_assignments.staff_id and sp.trainer_id = auth.uid())
  );

-- 3. ¿Este asistente puede ver a este cliente? -------------------------
-- true para todos los que no son staff (las demás reglas ya deciden por
-- ellos), y para filas sin cliente (ej. una cita de agenda sin cliente).
create or replace function public.staff_sees_client(p_client uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    p_client is null
    or public.auth_role() is distinct from 'staff'
    or exists (
      select 1
      from public.clients c
      join public.staff_permissions sp on sp.trainer_id = c.trainer_id and sp.staff_id = auth.uid()
      where c.id = p_client
        and (sp.client_scope = 'all'
             or exists (select 1 from public.staff_client_assignments a
                        where a.staff_id = auth.uid() and a.client_id = p_client))
    ), false)
$$;

grant execute on function public.staff_sees_client(uuid) to authenticated;

-- 4. Regla restrictiva en cada tabla con datos de clientes ---------------
do $$
declare
  r record;
begin
  -- La tabla de clientes usa su propio id
  execute 'drop policy if exists p_staff_scope on public.clients';
  execute 'create policy p_staff_scope on public.clients as restrictive for all to authenticated '
          'using (public.staff_sees_client(id)) with check (public.staff_sees_client(id))';

  for r in
    select c.table_name
    from information_schema.columns c
    join pg_class t on t.relname = c.table_name and t.relkind = 'r'
    join pg_namespace n on n.oid = t.relnamespace and n.nspname = 'public'
    where c.table_schema = 'public'
      and c.column_name = 'client_id'
      and t.relrowsecurity
      and c.table_name not in ('staff_client_assignments', 'invitations')
  loop
    execute format('drop policy if exists p_staff_scope on public.%I', r.table_name);
    execute format(
      'create policy p_staff_scope on public.%I as restrictive for all to authenticated '
      'using (public.staff_sees_client(client_id)) with check (public.staff_sees_client(client_id))',
      r.table_name);
    raise notice 'Filtro por cliente asignado en %', r.table_name;
  end loop;
end $$;

-- 5. Fotos (Storage) y perfiles de clientes respetan el mismo filtro ----
create or replace function public.storage_client_access(p_org text, p_client uuid, p_kind text, p_write boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    p_client is not null and public.auth_role() in ('client','trainer','staff') and exists (
      select 1 from public.clients c
      where c.id = p_client and c.organization_id::text = p_org and (
        (public.auth_role() = 'client'  and c.profile_id = auth.uid() and p_kind is distinct from 'trainer')
        or (public.auth_role() = 'trainer' and c.trainer_id = auth.uid())
        or (public.auth_role() = 'staff'   and public.staff_can(c.trainer_id, 'files', case when p_write then 'write' else 'read' end)
                                           and public.staff_sees_client(c.id))
      )), false)
$$;

create or replace function public.can_see_profile(p_profile uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    public.auth_role() is not null and (
      p_profile = auth.uid()
      or public.is_super_admin()
      or p_profile = public.my_trainer_id()
      or exists (select 1 from public.clients c
                 where c.profile_id = p_profile
                   and (c.trainer_id = auth.uid()
                        or (public.staff_can(c.trainer_id, 'clients', 'read') and public.staff_sees_client(c.id))))
      or exists (select 1 from public.staff_permissions sp where sp.staff_id = p_profile and sp.trainer_id = auth.uid())
      or exists (select 1 from public.staff_permissions sp where sp.trainer_id = p_profile and sp.staff_id = auth.uid())
    ), false)
$$;

-- Para revisar qué tablas quedaron filtradas (opcional):
-- select tablename from pg_policies where policyname = 'p_staff_scope' order by tablename;
