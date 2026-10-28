/**
 * Cargas en kg o en libras (part3v_migration.sql).
 *
 * Regla de oro: POR DENTRO TODO SE GUARDA EN KG (load_kg, load_value). La
 * unidad solo decide cómo se muestra y se escribe cada carga. Así los
 * récords, el 1RM y los gráficos comparan bien aunque un día se haya hecho
 * un ejercicio en lb y otro en kg.
 *
 * Qué unidad corresponde a cada ejercicio, de más a menos específico:
 *  1. la de la serie, si el alumno la cambió al cargarla;
 *  2. la elegida a mano para ese ejercicio en la rutina (Constructor);
 *  3. la del gimnasio del alumno (su ficha), o la del entrenador por defecto:
 *     todo en kg, todo en lb, o mixto (máquinas y poleas en lb, el resto en kg).
 */

export type LoadUnit = "kg" | "lb";
export type GymUnits = "kg" | "lb" | "mixed";

export const LB_TO_KG = 0.45359237;

export const GYM_UNITS_LABEL: Record<GymUnits, string> = {
  kg: "Todo en kg",
  lb: "Todo en libras",
  mixed: "Mixto: máquinas y poleas en libras, discos y mancuernas en kg",
};

export function toKg(value: number, unit: LoadUnit): number {
  return unit === "lb" ? value * LB_TO_KG : value;
}

/** De kg a la unidad que se muestra, redondeado a algo legible (½ lb o 0,1 kg). */
export function fromKg(kg: number, unit: LoadUnit): number {
  if (unit === "lb") return Math.round((kg / LB_TO_KG) * 2) / 2;
  return Math.round(kg * 10) / 10;
}

const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));

/** "45 kg", "100 lb". */
export function formatLoad(kg: number | null | undefined, unit: LoadUnit): string {
  if (kg == null) return "—";
  return `${fmtNum(fromKg(Number(kg), unit))} ${unit}`;
}

/** Valor a mostrar en un campo de carga (texto), desde kg. */
export function loadInputValue(kg: number | null | undefined, unit: LoadUnit): string {
  return kg == null ? "" : String(fromKg(Number(kg), unit));
}

/** Lee lo que escribió el usuario en la unidad dada y lo devuelve en kg (con precisión, sin redondear). */
export function parseLoadToKg(text: string, unit: LoadUnit): number | null {
  const t = text.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(toKg(n, unit) * 10000) / 10000;
}

/** Máquinas de placas y poleas: en un gimnasio "mixto", son las que van en libras. */
const MACHINE_RE = /m[aá]quina|polea|cable|selectoriz/i;
/** La Smith se carga con discos: va con los discos, no con las máquinas. */
const SMITH_RE = /smith|multipower/i;

export function isMachineEquipment(names: string[]): boolean {
  if (names.some((n) => SMITH_RE.test(n))) return false;
  return names.some((n) => MACHINE_RE.test(n));
}

export function resolveUnit(params: {
  setUnit?: LoadUnit | null;
  prescribedUnit?: LoadUnit | null;
  gymUnits: GymUnits;
  equipmentNames: string[];
}): LoadUnit {
  if (params.setUnit) return params.setUnit;
  if (params.prescribedUnit) return params.prescribedUnit;
  if (params.gymUnits === "lb") return "lb";
  if (params.gymUnits === "mixed") return isMachineEquipment(params.equipmentNames) ? "lb" : "kg";
  return "kg";
}

/** Salto de carga real según la unidad: 2,5 kg o 5 lb (en kg). */
export function loadStepKg(unit: LoadUnit): number {
  return unit === "lb" ? 5 * LB_TO_KG : 2.5;
}
