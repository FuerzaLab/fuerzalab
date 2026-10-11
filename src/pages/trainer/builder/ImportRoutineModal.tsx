import { useState } from "react";
import { Check } from "lucide-react";
import Modal from "../../../components/ui/Modal";
import FilePickerButton from "../../../components/ui/FilePickerButton";
import {
  parseExcelFile,
  parseWordTable,
  extractWordText,
  parseTextLines,
  rowsToRecords,
  fileKind,
} from "../../../lib/importParsing";
import { addWorkoutExercise, updateWorkoutExercise, BLOCK_LABEL, BLOCK_ORDER, type BlockKind, type SessionBlockRow } from "../../../services/sessions";
import type { ExerciseRow } from "../../../services/exercises";

const ALIASES = {
  name: ["ejercicio", "exercise", "nombre"],
  block: ["bloque", "block", "seccion"],
  sets: ["series", "sets"],
  reps: ["repeticiones", "reps"],
  load: ["carga", "peso", "kg"],
  rest: ["descanso", "rest"],
} as const;
type Field = keyof typeof ALIASES;

interface DraftRow {
  id: number;
  name: string;
  block: string;
  sets: string;
  reps: string;
  load: string;
  rest: string;
  exerciseId: string;
}

function norm(t: string) {
  return String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const BLOCK_BY_LABEL: Record<string, BlockKind> = Object.fromEntries(BLOCK_ORDER.map((k) => [norm(BLOCK_LABEL[k]), k])) as Record<string, BlockKind>;

function matchBlock(text: string): BlockKind {
  const n = norm(text);
  for (const k of BLOCK_ORDER) if (n.includes(norm(BLOCK_LABEL[k]))) return k;
  return BLOCK_BY_LABEL[n] ?? "main";
}

export default function ImportRoutineModal({
  blocks,
  exercises,
  existingCount,
  onClose,
  onImport,
}: {
  blocks: SessionBlockRow[];
  exercises: ExerciseRow[];
  existingCount: number;
  onClose: () => void;
  onImport: (rows: DraftRow[]) => Promise<void>;
}) {
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [pastedText, setPastedText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);

  const findExercise = (name: string) =>
    exercises.find((e) => norm(e.name) === norm(name))?.id ?? exercises.find((e) => norm(e.name).includes(norm(name)) || norm(name).includes(norm(e.name)))?.id ?? "";

  const setFromRecords = (records: Array<Record<Field, string>>, sourceLabel: string) => {
    if (!records.length) {
      setError(`No encontramos ejercicios reconocibles${sourceLabel}. Revisa que haya una columna "Ejercicio", o pega el texto abajo.`);
      setRows([]);
      return;
    }
    setError("");
    setRows(records.map((r, i) => ({ id: i, ...r, block: matchBlock(r.block), exerciseId: findExercise(r.name) })));
  };

  const handleFile = async (file: File) => {
    setError("");
    setBusy(true);
    try {
      const kind = fileKind(file);
      if (kind === "excel") {
        setFromRecords(rowsToRecords(await parseExcelFile(file), ALIASES, "name"), " en el Excel");
      } else if (kind === "word") {
        const tableRows = rowsToRecords(await parseWordTable(file), ALIASES, "name");
        if (tableRows.length) {
          setFromRecords(tableRows, " en el Word");
        } else {
          const text = await extractWordText(file);
          applyPlainText(text);
        }
      } else if (kind === "pdf") {
        setError("No podemos leer archivos PDF automáticamente en esta vista previa. Abre el PDF, copia el texto de la rutina y pégalo abajo.");
      } else {
        setError("Formato no reconocido. Usa .xlsx, .xls o .docx, o pega el texto abajo.");
      }
    } catch {
      setError("No pudimos leer ese archivo. Puede estar dañado o protegido. Prueba con otro, o pega el texto abajo.");
    }
    setBusy(false);
  };

  const applyPlainText = (text: string) => {
    const parsed = parseTextLines(text);
    setFromRecords(
      parsed.map((p) => ({ name: p.name, block: "", sets: p.sets, reps: p.reps, load: p.load, rest: "" })),
      " en el texto"
    );
  };

  const parsePasted = () => {
    if (!pastedText.trim()) {
      setError("Pega primero el texto de la rutina.");
      return;
    }
    applyPlainText(pastedText);
  };

  const patch = (id: number, field: keyof DraftRow, value: string) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  const removeRow = (id: number) => setRows((rs) => rs.filter((r) => r.id !== id));

  const unmatchedCount = rows.filter((r) => !r.exerciseId).length;

  const confirm = async () => {
    if (rows.some((r) => !r.exerciseId)) {
      setError("Hay ejercicios sin coincidencia en tu biblioteca. Elige uno para cada fila, o quítala de la lista.");
      return;
    }
    setImporting(true);
    try {
      await onImport(rows);
    } catch (e: any) {
      setError(e.message ?? "No pudimos importar la rutina.");
    }
    setImporting(false);
  };

  return (
    <Modal title="Importar rutina" onClose={onClose} wide>
      <p className="note" style={{ marginBottom: 12 }}>
        Sube un Excel o Word con columnas como "Ejercicio", "Bloque", "Series", "Repeticiones", "Carga" y "Descanso".
        Para PDF no podemos leerlo automáticamente aquí: cópialo y pégalo como texto más abajo.
      </p>

      <div style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
        <span className="note">Esta rutina ya tiene {existingCount} ejercicio{existingCount === 1 ? "" : "s"}.</span>
      </div>

      <FilePickerButton accept=".xlsx,.xls,.docx,.pdf" onFile={handleFile} />
      {busy && <p className="note" style={{ marginBottom: 10 }}>Leyendo el archivo…</p>}

      <label className="field-label">O pega el texto de la rutina</label>
      <textarea className="input" style={{ minHeight: 70, marginBottom: 8 }} value={pastedText} onChange={(e) => setPastedText(e.target.value)} placeholder={"Sentadilla 3x10 60kg\nPress banca 4x8 40kg"} />
      <button type="button" className="btn ghost" onClick={parsePasted} style={{ marginBottom: 14 }}>
        Interpretar texto
      </button>

      {error && <p className="error-text" style={{ marginBottom: 14 }}>{error}</p>}

      {rows.length > 0 && (
        <>
          <h3 style={{ margin: "10px 0 4px" }}>Ejercicios nuevos a incorporar ({rows.length})</h3>
          <p className="note" style={{ marginBottom: 10 }}>
            Hacemos coincidir el nombre con tu biblioteca de ejercicios; corrige lo que no haya quedado bien.
            {unmatchedCount > 0 && <span style={{ color: "var(--bad)" }}> {unmatchedCount} fila{unmatchedCount === 1 ? "" : "s"} sin coincidir todavía.</span>}
          </p>
          <div style={{ overflowX: "auto", marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12.5 }}>
                  <th style={{ padding: "6px 8px" }}>Ejercicio</th>
                  <th style={{ padding: "6px 8px" }}>Bloque</th>
                  <th style={{ padding: "6px 8px" }}>Series</th>
                  <th style={{ padding: "6px 8px" }}>Reps</th>
                  <th style={{ padding: "6px 8px" }}>Carga</th>
                  <th style={{ padding: "6px 8px" }}>Descanso</th>
                  <th style={{ padding: "6px 8px" }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--line)", background: r.exerciseId ? undefined : "var(--bad-soft)" }}>
                    <td style={{ padding: "6px 8px", minWidth: 180 }}>
                      <select className="input" style={{ padding: "6px 8px" }} value={r.exerciseId} onChange={(e) => patch(r.id, "exerciseId", e.target.value)}>
                        <option value="">{r.name} (sin coincidir, elige uno)</option>
                        {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <select className="input" style={{ padding: "6px 8px" }} value={r.block} onChange={(e) => patch(r.id, "block", e.target.value)}>
                        {BLOCK_ORDER.filter((k) => blocks.some((b) => b.kind === k)).map((k) => <option key={k} value={k}>{BLOCK_LABEL[k]}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "6px" }}><input className="input" style={{ width: 56, padding: "6px 4px", textAlign: "center" }} value={r.sets} onChange={(e) => patch(r.id, "sets", e.target.value)} /></td>
                    <td style={{ padding: "6px" }}><input className="input" style={{ width: 64, padding: "6px 4px", textAlign: "center" }} value={r.reps} onChange={(e) => patch(r.id, "reps", e.target.value)} /></td>
                    <td style={{ padding: "6px" }}><input className="input" style={{ width: 64, padding: "6px 4px", textAlign: "center" }} value={r.load} onChange={(e) => patch(r.id, "load", e.target.value)} /></td>
                    <td style={{ padding: "6px" }}><input className="input" style={{ width: 64, padding: "6px 4px", textAlign: "center" }} value={r.rest} onChange={(e) => patch(r.id, "rest", e.target.value)} /></td>
                    <td style={{ padding: "6px 8px" }}>
                      <button type="button" aria-label={`Quitar ${r.name}`} onClick={() => removeRow(r.id)} style={{ border: 0, background: "none", color: "var(--muted)", cursor: "pointer" }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn" onClick={confirm} disabled={importing}>
            <Check size={16} /> {importing ? "Agregando…" : `Confirmar y agregar ${rows.length} ejercicios`}
          </button>
        </>
      )}
    </Modal>
  );
}

export async function applyImportedRows(params: {
  rows: DraftRow[];
  sessionId: string;
  blocks: SessionBlockRow[];
  startSortOrder: number;
}): Promise<number> {
  const blockByKind = Object.fromEntries(params.blocks.map((b) => [b.kind, b]));
  let order = params.startSortOrder;
  let count = 0;
  for (const r of params.rows) {
    const kind = (r.block || "main") as BlockKind;
    const block = blockByKind[kind] ?? params.blocks[0];
    if (!block) continue;
    const created = await addWorkoutExercise({
      sessionId: params.sessionId,
      blockId: block.id,
      exerciseId: r.exerciseId,
      sortOrder: order++,
      isCardio: kind === "cardio",
    });
    const fields: Record<string, number> = {};
    if (r.sets) fields.sets = Number(r.sets) || undefined!;
    if (r.reps) {
      const m = r.reps.match(/(\d+)\s*[-–]\s*(\d+)/);
      if (m) {
        fields.reps_min = Number(m[1]);
        fields.reps_max = Number(m[2]);
      } else if (Number(r.reps)) {
        fields.reps_min = Number(r.reps);
        fields.reps_max = Number(r.reps);
      }
    }
    if (r.load) fields.load_value = Number(r.load.replace(",", ".")) || undefined!;
    if (r.rest) fields.rest_s = Number(r.rest) || undefined!;
    if (Object.keys(fields).length) await updateWorkoutExercise(created.id, fields as any);
    count++;
  }
  return count;
}
