import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { isMinor } from "../lib/minors";

/**
 * ¿La ficha de este alumno está bloqueada? Es menor de 18 años y todavía no
 * se subió la autorización firmada de su tutor. La base de datos no deja
 * cargarle entrenamientos, evaluaciones, medidas ni archivos (part4p); esto
 * sirve para avisarle al entrenador antes de que lo intente.
 */
export async function isClientLocked(clientId: string): Promise<boolean> {
  const [{ data: prof }, { data: client }] = await Promise.all([
    supabase.from("client_profiles").select("birth_date").eq("client_id", clientId).maybeSingle(),
    supabase.from("clients").select("guardian_consent_at").eq("id", clientId).maybeSingle(),
  ]);
  return isMinor(prof?.birth_date ?? null) && !client?.guardian_consent_at;
}

export function useClientLocked(clientId: string | null | undefined): boolean {
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    let alive = true;
    setLocked(false);
    if (clientId) isClientLocked(clientId).then((v) => alive && setLocked(v)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [clientId]);
  return locked;
}
