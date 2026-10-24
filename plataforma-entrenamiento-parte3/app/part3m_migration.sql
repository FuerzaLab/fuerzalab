-- =====================================================================
-- DUODÉCIMA MIGRACIÓN DE LA PARTE 3 (Último ingreso a la app)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- Supabase guarda cuándo inició sesión cada persona, pero en una tabla
-- protegida (auth.users) a la que la app nunca tiene acceso directo, por
-- seguridad. Esto agrega una columna nueva en "profiles" (que la app sí
-- puede leer) y la mantiene sincronizada sola, cada vez que alguien
-- inicia sesión, con un disparador sobre esa tabla protegida.
-- =====================================================================

alter table public.profiles
  add column last_sign_in_at timestamptz;

create or replace function public.sync_last_sign_in() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set last_sign_in_at = new.last_sign_in_at where id = new.id;
  return new;
end $$;

drop trigger if exists on_auth_user_sign_in on auth.users;
create trigger on_auth_user_sign_in
  after update of last_sign_in_at on auth.users
  for each row execute function public.sync_last_sign_in();
