import { useState } from "react";
import { Check } from "lucide-react";
import Modal from "../../../components/ui/Modal";
import FilePickerButton from "../../../components/ui/FilePickerButton";
import {
  parseExcelFile,
  parseWordTable,
  extractWordText,
  rowsToRecords,
  fileKind,
} from "../../../lib/importParsing";
import { createExercise, GOAL_OPTIONS, type CatalogItem, type ExerciseRow, type NewExerciseInput } from "../../../services/exercises";
import SearchSelect from "../../../components/ui/SearchSelect";

const ALIASES = {
  name: ["ejercicio", "exercise", "nombre", "movimiento"],
  muscleGroup: ["musculo", "muscle", "grupo"],
  pattern: ["patron", "pattern", "movimiento"],
  equipment: ["equipamiento", "equipment", "equipo"],
  difficulty: ["nivel", "dificultad", "difficulty"],
  goals: ["objetivo", "goal"],
  instructions: ["instruccion", "indicacion", "cue"],
  mistakes: ["error", "mistake"],
};
type Field = keyof typeof ALIASES;

interface DraftRow {
  id: number;
  name: string;
  muscleGroup: string;
  pattern: string;
  equipment: string;
  difficulty: string;
  goals: string;
  instructions: string;
  mistakes: string;
}

function norm(t: string) {
  return String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export default function ImportExercisesModal({
  scope,
  organizationId,
  ownerId,
  muscles,
  patterns,
  equipment,
  onClose,
  onImported,
}: {
  scope: "global" | "trainer";
  organizationId: string | null;
  ownerId: string | null;
  muscles: CatalogItem[];
  patterns: CatalogItem[];
  equipment: CatalogItem[];
  onClose: () => void;
  onImported: (created: ExerciseRow[]) => void;
}) {
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [pastedText, setPastedText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);

  const setFromRecords = (records: Array<Record<Field, string>>, sourceLabel: string) => {
    if (!records.length) {
      setError(`No encontramos ejercicios reconocibles${sourceLabel}. Revisa que haya una columna "Ejercicio", o pega el texto abajo (un nombre por línea).`);
      setRows([]);
      return;
    }
    setError("");
    setRows(records.map((r, i) => ({ id: i, ...r })));
  };

  const handleFile = async (file: File) => {
    setError("");
    setBusy(true);
    try {
      const kind = fileKind(file);
      if (kind === "excel") {
        setFromRecords(rowsToRecords<Field>(await parseExcelFile(file), ALIASES, "name"), " en el Excel");
      } else if (kind === "word") {
        const tableRows = rowsToRecords<Field>(await parseWordTable(file), ALIASES, "name");
        if (tableRows.length) {
          setFromRecords(tableRows, " en el Word");
        } else {
          const text = await extractWordText(file);
          const names = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
          setFromRecords(
            names.map((name) => ({ name, muscleGroup: "", pattern: "", equipment: "", difficulty: "", goals: "", instructions: "", mistakes: "" })),
            " en el Word"
          );
        }
      } else if (kind === "pdf") {
        setError("No podemos leer archivos PDF automáticamente en esta vista previa. Abre el PDF, copia el texto y pégalo abajo.");
      } else {
        setError("Formato no reconocido. Usa .xlsx, .xls o .docx, o pega el texto abajo.");
      }
    } catch {
      setError("No pudimos leer ese archivo. Puede estar dañado o protegido. Prueba con otro, o pega el texto abajo.");
    }
    setBusy(false);
  };

  const parsePasted = () => {
    const names = pastedText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!names.length) {
      setError("Pega al menos un nombre de ejercicio.");
      return;
    }
    setFromRecords(
      names.map((name) => ({ name, muscleGroup: "", pattern: "", equipment: "", difficulty: "", goals: "", instructions: "", mistakes: "" })),
      " en el texto pegado"
    );
  };

  const patch = (id: number, field: keyof DraftRow, value: string) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  const removeRow = (id: number) => setRows((rs) => rs.filter((r) => r.id !== id));

  const findCatalogId = (items: CatalogItem[], text: string) => items.find((i) => norm(i.label) === norm(text) || norm(text).includes(norm(i.label)))?.id ?? "";

  const confirm = async () => {
    setImporting(true);
    const created: ExerciseRow[] = [];
    try {
      for (const r of rows) {
        const muscleId = findCatalogId(muscles, r.muscleGroup);
        const patternId = findCatalogId(patterns, r.pattern);
        const equipIds = r.equipment
          .split(/[,;/]/)
          .map((e) => findCatalogId(equipment, e.trim()))
          .filter(Boolean);
        const goals = GOAL_OPTIONS.filter((g) => norm(r.goals).includes(norm(g)));
        const difficulty: NewExerciseInput["difficulty"] = /avanzad/i.test(r.difficulty) ? "advanced" : /principiant/i.test(r.difficulty) ? "beginner" : "intermediate";
        const ex = await createExercise(
          {
            name: r.name,
            primary_muscle_id: muscleId || null,
            movement_pattern_id: patternId || null,
            equipment_ids: equipIds,
            difficulty,
            goals: goals.length ? goals : ["Fuerza"],
            instructions: r.instructions,
            technical_cues: r.instructions,
            common_mistakes: r.mistakes,
          },
          scope,
          organizationId,
          ownerId
        );
        created.push(ex);
      }
      onImported(created);
    } catch (e: any) {
      setError(`Se importaron ${created.length} de ${rows.length} antes de un error: ${e.message}`);
      if (created.length) onImported(created);
    }
    setImporting(false);
  };

  return (
    <Modal title="Importar ejercicios" onClose={onClose} wide>
      <p className="note" style={{ marginBottom: 14 }}>
        Sube un Excel o Word con una columna "Ejercicio" (y, si quieres, "Músculo", "Equipamiento", "Patrón", "Nivel",
        "Objetivo"). Para PDF no podemos leerlo automáticamente aquí: cópialo y pégalo como texto más abajo.
      </p>

      <FilePickerButton accept=".xlsx,.xls,.docx,.pdf" onFile={handleFile} />
      {busy && <p className="note" style={{ marginBottom: 10 }}>Leyendo el archivo…</p>}

      <label className="field-label">O pega una lista de nombres (uno por línea)</label>
      <textarea className="input" style={{ minHeight: 70, marginBottom: 8 }} value={pastedText} onChange={(e) => setPastedText(e.target.value)} placeholder={"Zancada búlgara\nRemo en polea baja"} />
      <button type="button" className="btn ghost" onClick={parsePasted} style={{ marginBottom: 14 }}>
        Interpretar texto
      </button>

      {error && <p className="error-text" style={{ marginBottom: 14 }}>{error}</p>}

      {rows.length > 0 && (
        <>
          <h3 style={{ margin: "10px 0 8px" }}>Revisa antes de crear ({rows.length})</h3>
          <p className="note" style={{ marginBottom: 10 }}>
            Intentamos reconocer el músculo y el equipamiento contra tu catálogo; corrige lo que no haya quedado bien. Nada se crea hasta que confirmes abajo.
          </p>
          <div style={{ overflowX: "auto", marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12.5 }}>
                  <th style={{ padding: "6px 8px" }}>Ejercicio</th>
                  <th style={{ padding: "6px 8px" }}>Músculo</th>
                  <th style={{ padding: "6px 8px" }}>Patrón</th>
                  <th style={{ padding: "6px 8px" }}>Nivel</th>
                  <th style={{ padding: "6px 8px" }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--line)" }}>
                    <td style={{ padding: "6px 8px", minWidth: 160 }}>
                      <input className="input" style={{ padding: "6px 8px" }} value={r.name} onChange={(e) => patch(r.id, "name", e.target.value)} />
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <SearchSelect className="input" style={{ padding: "6px 8px" }} value={findCatalogId(muscles, r.muscleGroup)} onChange={(e) => patch(r.id, "muscleGroup", muscles.find((m) => m.id === e.target.value)?.label ?? "")}>
                        <option value="">Sin definir</option>
                        {muscles.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                      </SearchSelect>
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <SearchSelect className="input" style={{ padding: "6px 8px" }} value={findCatalogId(patterns, r.pattern)} onChange={(e) => patch(r.id, "pattern", patterns.find((p) => p.id === e.target.value)?.label ?? "")}>
                        <option value="">Sin definir</option>
                        {patterns.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                      </SearchSelect>
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <select className="input" style={{ padding: "6px 8px" }} value={r.difficulty} onChange={(e) => patch(r.id, "difficulty", e.target.value)}>
                        <option value="">Intermedio</option>
                        <option value="Principiante">Principiante</option>
                        <option value="Avanzado">Avanzado</option>
                      </select>
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <button type="button" aria-label={`Quitar ${r.name}`} onClick={() => removeRow(r.id)} style={{ border: 0, background: "none", color: "var(--muted)", cursor: "pointer" }}>
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn" onClick={confirm} disabled={importing}>
            <Check size={16} /> {importing ? "Creando…" : `Crear ${rows.length} ejercicios`}
          </button>
        </>
      )}
    </Modal>
  );
}
