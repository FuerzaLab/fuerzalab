import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getOrgBrand, onBrandChanged, type OrgBrand } from "../services/brand";

// Una sola carga por organización mientras la app está abierta (la marca
// aparece en varias partes de la pantalla a la vez).
const cache = new Map<string, Promise<OrgBrand>>();

/** Marca de la organización del usuario actual, o null si no tiene (o es Super Admin). */
export function useOrgBrand(): OrgBrand | null {
  const { profile } = useAuth();
  const orgId = profile?.role !== "super_admin" ? profile?.organization_id ?? null : null;
  const [brand, setBrand] = useState<OrgBrand | null>(null);

  useEffect(() => {
    if (!orgId) {
      setBrand(null);
      return;
    }
    let alive = true;
    const load = (fresh: boolean) => {
      if (fresh || !cache.has(orgId)) cache.set(orgId, getOrgBrand(orgId));
      cache.get(orgId)!.then((b) => alive && setBrand(b));
    };
    load(false);
    const off = onBrandChanged(() => load(true));
    return () => {
      alive = false;
      off();
    };
  }, [orgId]);

  if (!brand || (!brand.name && !brand.logoUrl)) return null;
  return brand;
}
