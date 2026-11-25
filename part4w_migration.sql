-- =====================================================================
-- VIGESIMOTERCERA MIGRACIÓN DE LA PARTE 4 (Último ingreso real)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- "Último ingreso" se actualizaba solo cuando alguien escribía su correo y
-- contraseña. Pero la app deja la sesión iniciada: un alumno que la abre
-- todos los días sin volver a escribir su contraseña quedaba con la fecha
-- vieja. Ahora la app avisa cada vez que alguien la abre (o vuelve a ella),
-- como mucho una vez por hora, y esa fecha pasa a ser su último ingreso.
-- =====================================================================

create or replace function public.touch_last_seen() returns void
language sql security definer set search_path = public as $$
  update public.profiles
     set last_sign_in_at = now()
   where id = auth.uid()
     and (last_sign_in_at is null or last_sign_in_at < now() - interval '1 hour');
$$;
grant execute on function public.touch_last_seen() to authenticated;

-- Al iniciar sesión con contraseña, nunca se retrocede la fecha.
create or replace function public.sync_last_sign_in() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set last_sign_in_at = greatest(coalesce(last_sign_in_at, new.last_sign_in_at), new.last_sign_in_at)
   where id = new.id;
  return new;
end $$;
