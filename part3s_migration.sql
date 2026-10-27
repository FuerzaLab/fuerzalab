-- =====================================================================
-- DECIMOCTAVA MIGRACIÓN DE LA PARTE 3 (Marca del entrenador / estudio)
-- Pega esto en una NUEVA query del SQL Editor y presiona Run, una sola vez.
--
-- Permite que cada organización (el negocio del entrenador, o el estudio)
-- tenga su propia marca — nombre y logo — que se muestra junto a la de
-- FuerzaLab, con el mismo peso, en la app de sus clientes, de su equipo y
-- en los reportes en PDF.
--
--  * Bucket nuevo "brand-assets" (público: los logos se pueden ver sin
--    iniciar sesión, porque son la cara pública del negocio). Cada
--    organización solo puede subir/borrar en su propia carpeta.
--  * Función set_organization_brand: el entrenador guarda el nombre de su
--    marca y el logo de SU organización. Se usa una función (y no abrir la
--    tabla organizations a edición) para que el entrenador NO pueda tocar
--    nada más: ni el nombre interno, ni el estado, ni la facturación.
--
-- No modifica ninguna tabla ni regla existente. El logo va en la columna
-- organizations.logo_path (existía desde el script original, sin uso) y el
-- nombre de la marca en organizations.settings → brand_name.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('brand-assets', 'brand-assets', true, 2097152, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do nothing;

drop policy if exists brand_assets_insert on storage.objects;
drop policy if exists brand_assets_update on storage.objects;
drop policy if exists brand_assets_delete on storage.objects;

create policy brand_assets_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'brand-assets' and (
    public.is_super_admin()
    or (public.auth_role() = 'trainer' and (storage.foldername(name))[1] = public.auth_org()::text)));

create policy brand_assets_update on storage.objects for update to authenticated
  using (bucket_id = 'brand-assets' and (
    public.is_super_admin()
    or (public.auth_role() = 'trainer' and (storage.foldername(name))[1] = public.auth_org()::text)));

create policy brand_assets_delete on storage.objects for delete to authenticated
  using (bucket_id = 'brand-assets' and (
    public.is_super_admin()
    or (public.auth_role() = 'trainer' and (storage.foldername(name))[1] = public.auth_org()::text)));

create or replace function public.set_organization_brand(p_brand_name text, p_logo_path text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.auth_org();
begin
  if public.auth_role() is distinct from 'trainer' or v_org is null then
    raise exception 'Solo un entrenador puede cambiar la marca de su organización.';
  end if;
  if p_logo_path is not null and split_part(p_logo_path, '/', 1) <> v_org::text then
    raise exception 'El logo tiene que estar en la carpeta de tu organización.';
  end if;
  update public.organizations
     set logo_path = p_logo_path,
         settings  = case
                       when nullif(trim(coalesce(p_brand_name, '')), '') is null then settings - 'brand_name'
                       else settings || jsonb_build_object('brand_name', left(trim(p_brand_name), 60))
                     end,
         updated_at = now()
   where id = v_org;
end $$;

grant execute on function public.set_organization_brand(text, text) to authenticated;
