import { supabase } from "../lib/supabase";
import { listCatalog } from "./exercises";
import { resolveUnit, type GymUnits, type LoadUnit } from "../lib/units";

/** Unidad por defecto del entrenador (organización). Sin configurar: kg. */
export async function getDefaultGymUnits(orgId: string): Promise<GymUnits> {
  const { data } = await supabase.from("organizations").select("settings").eq("id", orgId).maybeSingle();
  const v = (data?.settings as any)?.default_gym_units;
  return v === "lb" || v === "mixed" ? v : "kg";
}

export async function setDefaultGymUnits(units: GymUnits): Promise<void> {
  const { error } = await supabase.rpc("set_default_gym_units", { p_units: units });
  if (error) {
    if (/set_default_gym_units/.test(error.message)) throw new Error("Falta correr part3v_migration.sql en Supabase.");
    throw error;
  }
}

/** Lo que figura en la ficha del alumno (null = usa el valor por defecto). */
export async function getClientGymUnitsRaw(clientId: string): Promise<GymUnits | null> {
  const { data } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
  const v = (data as any)?.gym_units;
  return v === "kg" || v === "lb" || v === "mixed" ? v : null;
}

export async function setClientGymUnits(clientId: string, units: GymUnits | null): Promise<void> {
  const { data, error } = await supabase.from("clients").update({ gym_units: units }).eq("id", clientId).select("id");
  if (error) {
    if (/gym_units/.test(error.message)) throw new Error("Falta correr part3v_migration.sql en Supabase.");
    throw error;
  }
  if (!data || data.length === 0) throw new Error("No se pudo guardar la unidad del gimnasio.");
}

/** Unidad efectiva del gimnasio del alumno: la de su ficha o, si no tiene, la del entrenador. */
export async function getEffectiveGymUnits(clientId: string, orgId: string | null): Promise<GymUnits> {
  const own = await getClientGymUnitsRaw(clientId).catch(() => null);
  if (own) return own;
  return orgId ? getDefaultGymUnits(orgId).catch((): GymUnits => "kg") : "kg";
}

/** id del equipamiento → nombre ("Máquina", "Polea", …). */
export async function getEquipmentNames(): Promise<Record<string, string>> {
  const items = await listCatalog("equipment").catch(() => []);
  return Object.fromEntries(items.map((i: any) => [i.id, i.label as string]));
}

/**
 * Arma la función que decide la unidad de cada ejercicio de la rutina.
 * En gimnasios mixtos usa el equipamiento del ejercicio y, como respaldo,
 * su nombre ("…en máquina", "…en polea").
 */
export function makeUnitResolver(gymUnits: GymUnits, equipmentNames: Record<string, string>) {
  return (ex: { load_unit?: LoadUnit | null; exercise_equipment_ids?: string[] | null; exercise_name?: string }): LoadUnit =>
    resolveUnit({
      prescribedUnit: ex.load_unit ?? null,
      gymUnits,
      equipmentNames: [...(ex.exercise_equipment_ids ?? []).map((id) => equipmentNames[id] ?? ""), ex.exercise_name ?? ""],
    });
}
