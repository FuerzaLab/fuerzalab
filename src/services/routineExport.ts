import { supabase } from "../lib/supabase";
import { exportReportPdf } from "../lib/exportReportPdf";
import { formatLoad } from "../lib/units";
import { BLOCK_LABEL, BLOCK_ORDER, listSessionBlocks, listSessions, listWorkoutExercises, type SessionRow, type WorkoutExerciseRow } from "./sessions";
import { getEffectiveGymUnits, getEquipmentNames, makeUnitResolver } from "./units";
import { listFixedSlots } from "./fixedRoutines";

/**
 * Exportar rutinas: PDF (con el logo de FuerzaLab y el del entrenador) y
 * Excel con el MISMO formato que acepta "Importar rutina" (Ejercicio,
 * Bloque, Series, Repeticiones, Carga, Descanso), así una rutina exportada
 * se puede volver a importar. Una rutina, la semana o todas las rutinas fijas.
 * No disponible en las cuentas de demostración (lo controla la pantalla).
 */
export type ExportScope = "session" | "week" | "fixed";

interface Routine {
  session: SessionRow;
  items: (WorkoutExerciseRow & { blockLabel: string; ss: string | null })[];
}

const DOW = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

async function collect(scope: ExportScope, session: SessionRow) {
  let sessions: SessionRow[] = [session];
  if (scope === "week") sessions = (await listSessions(session.week_id)).sort((a, b) => a.sort_order - b.sort_order);
  if (scope === "fixed") sessions = await listFixedSlots(session.program_id);

  const { data: prog } = await supabase.from("programs").select("name, client_id, organization_id").eq("id", session.program_id).maybeSingle();
  const { data: client } = prog?.client_id
    ? await supabase.from("clients").select("full_name").eq("id", prog.client_id).maybeSingle()
    : { data: null as any };
  const { data: week } = scope === "fixed" ? { data: null as any } : await supabase.from("weeks").select("week_number").eq("id", session.week_id).maybeSingle();
  const [gym, eq] = await Promise.all([
    prog?.client_id ? getEffectiveGymUnits(prog.client_id, prog.organization_id ?? null).catch(() => "kg" as any) : Promise.resolve("kg" as any),
    getEquipmentNames().catch(() => ({})),
  ]);
  const unitFor = makeUnitResolver(gym, eq);

  const routines: Routine[] = [];
  for (const s of sessions) {
    const [blocks, items] = await Promise.all([listSessionBlocks(s.id), listWorkoutExercises(s.id)]);
    const blockOf = new Map(blocks.map((b) => [b.id, b]));
    const order = (it: WorkoutExerciseRow) => {
      const b = it.block_id ? blockOf.get(it.block_id) : undefined;
      return [b ? BLOCK_ORDER.indexOf(b.kind) : 99, b?.sort_order ?? 0, it.sort_order] as const;
    };
    const sorted = [...items].sort((a, b) => {
      const x = order(a), y = order(b);
      return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
    });
    // Letras de biserie: A1, A2… por grupo dentro de la rutina.
    const letters = new Map<number, string>();
    const count = new Map<number, number>();
    const withMeta = sorted.map((it) => {
      const b = it.block_id ? blockOf.get(it.block_id) : undefined;
      let ss: string | null = null;
      if (it.superset_group != null) {
        if (!letters.has(it.superset_group)) letters.set(it.superset_group, String.fromCharCode(65 + letters.size));
        const n = (count.get(it.superset_group) ?? 0) + 1;
        count.set(it.superset_group, n);
        ss = `${letters.get(it.superset_group)}${n}`;
      }
      return { ...it, blockLabel: b ? BLOCK_LABEL[b.kind] : "Principal", ss };
    });
    routines.push({ session: s, items: withMeta });
  }
  return { routines, programName: prog?.name ?? "", clientName: client?.full_name ?? "", weekNumber: week?.week_number as number | undefined, unitFor };
}

const repsText = (it: WorkoutExerciseRow) =>
  it.duration_min != null && !it.sets
    ? `${it.duration_min} min`
    : it.reps_min != null
      ? it.reps_max != null && it.reps_max !== it.reps_min
        ? `${it.reps_min}-${it.reps_max}`
        : String(it.reps_min)
      : "";

function fileBase(clientName: string, title: string) {
  return `Rutina-${(clientName || "alumno").split(" ")[0]}-${title}`.replace(/[^\p{L}\p{N}-]+/gu, "-").replace(/-+/g, "-");
}

/** PDF con la rutina (o las rutinas), listo para imprimir o mandar por WhatsApp. */
export async function exportRoutinePdf(scope: ExportScope, session: SessionRow, trainer: { name: string; logoUrl?: string | null }) {
  const { routines, programName, clientName, weekNumber, unitFor } = await collect(scope, session);
  const subtitle = scope === "fixed" ? "Rutinas fijas" : weekNumber ? `Semana ${weekNumber}` : "";
  // La columna Tempo solo si alguna rutina la usa.
  const withTempo = routines.some((r) => r.items.some((it) => it.tempo));
  const blocksHtml = routines
    .map(({ session: s, items }) => {
      let lastBlock = "";
      const rows = items
        .map((it) => {
          const head = it.blockLabel !== lastBlock ? `<tr class="blk"><td colspan="${withTempo ? 7 : 6}">${esc(it.blockLabel)}</td></tr>` : "";
          lastBlock = it.blockLabel;
          const unit = unitFor(it as any);
          return `${head}<tr><td>${it.ss ? `<b class="ss">${it.ss}</b> ` : ""}${esc(it.exercise_name)}</td><td>${it.sets ?? ""}</td><td>${esc(repsText(it))}</td><td>${it.load_value != null ? esc(formatLoad(it.load_value, unit)) : ""}</td><td>${it.rir ?? ""}</td><td>${it.rest_s ? `${it.rest_s} s` : ""}</td>${withTempo ? `<td>${esc(it.tempo ?? "")}</td>` : ""}</tr>`;
        })
        .join("");
      return `<div class="rt"><h2>${esc(s.name)}${s.day_of_week ? ` <span>· ${DOW[s.day_of_week]}</span>` : ""}</h2>
        ${items.length ? `<table><thead><tr><th>Ejercicio</th><th>Series</th><th>Reps</th><th>Carga</th><th>RIR</th><th>Descanso</th>${withTempo ? "<th>Tempo</th>" : ""}</tr></thead><tbody>${rows}</tbody></table>` : `<p class="empty">Sin ejercicios cargados.</p>`}</div>`;
    })
    .join("");
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#fff";
  el.innerHTML = `<style>
    .rx{font-family:Arial,sans-serif;color:#14202B;padding:34px 38px;font-size:12.5px}
    .rx .hd{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1E3FA8;padding-bottom:12px;margin-bottom:16px}
    .rx .hd img{height:38px;border-radius:8px}
    .rx .brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:20px;color:#0F1A33}.rx .brand span{color:#1E3FA8}
    .rx h1{font-size:20px;margin:0;color:#0F1A33}.rx .sub{color:#5E6A73;font-size:12px}
    .rx .rt{margin-bottom:16px;page-break-inside:avoid}.rx h2{font-size:15px;margin:0 0 6px;color:#1E3FA8}.rx h2 span{color:#5E6A73;font-weight:400}
    .rx table{width:100%;border-collapse:collapse}.rx th{text-align:left;font-size:10.5px;color:#5E6A73;padding:4px 6px;border-bottom:1px solid #DCE1DA}
    .rx td{padding:6px;border-bottom:1px solid #EEF1EC}.rx tr.blk td{background:#F1F3F0;font-weight:700;font-size:11px;color:#0F1A33}
    .rx .ss{color:#D6472B}.rx .empty{color:#8B93A7}.rx .ft{margin-top:14px;color:#8B93A7;font-size:10.5px}
  </style>
  <div class="rx">
    <div class="hd">
      <div><h1>${esc(clientName || "Rutina")}</h1><div class="sub">${esc([programName, subtitle].filter(Boolean).join(" · "))} · Entrenador: ${esc(trainer.name)}</div></div>
      <div class="brand">${trainer.logoUrl ? `<img src="${esc(trainer.logoUrl)}" crossorigin="anonymous">` : ""}<img src="/logo.png"><b>Fuerza<span>Lab</span></b></div>
    </div>
    ${blocksHtml}
    <div class="ft">Las letras (A1, A2) marcan biseries: se hacen alternadas. RIR = repeticiones en reserva. Generado con FuerzaLab el ${new Date().toLocaleDateString("es")}.</div>
  </div>`;
  document.body.appendChild(el);
  try {
    await new Promise((r) => setTimeout(r, 250)); // que carguen los logos
    await exportReportPdf(el.firstElementChild?.nextElementSibling as HTMLElement, fileBase(clientName, subtitle || session.name));
  } finally {
    el.remove();
  }
}

/** Excel con el formato del importador: una hoja por rutina. */
export async function exportRoutineExcel(scope: ExportScope, session: SessionRow) {
  const { routines, clientName, weekNumber, unitFor } = await collect(scope, session);
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  for (const { session: s, items } of routines) {
    const rows = items.map((it) => {
      const unit = unitFor(it as any);
      return {
        Ejercicio: it.exercise_name,
        Bloque: it.blockLabel,
        Series: it.sets ?? "",
        Repeticiones: repsText(it),
        Carga: it.load_value != null ? formatLoad(it.load_value, unit).replace(/\s*(kg|lb)$/, "") : "",
        Unidad: it.load_value != null ? unit : "",
        Descanso: it.rest_s ?? "",
        RIR: it.rir ?? "",
        Biserie: it.ss ?? "",
        Tempo: it.tempo ?? "",
      };
    });
    let name = s.name.replace(/[\\/?*[\]:]/g, " ").slice(0, 28) || "Rutina";
    while (used.has(name)) name = name.slice(0, 26) + " " + (used.size + 1);
    used.add(name);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Ejercicio: "", Bloque: "", Series: "", Repeticiones: "", Carga: "", Descanso: "" }]), name);
  }
  XLSX.writeFile(wb, `${fileBase(clientName, scope === "fixed" ? "rutinas-fijas" : weekNumber ? `semana-${weekNumber}` : session.name)}.xlsx`);
}
