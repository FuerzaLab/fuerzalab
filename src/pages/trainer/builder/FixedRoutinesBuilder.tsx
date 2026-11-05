import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useToast } from "../../../contexts/ToastContext";
import Loading from "../../../components/ui/Loading";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import { DAY_OF_WEEK_LABEL, type SessionRow } from "../../../services/sessions";
import { addFixedDay, deleteFixedDay, extendFixedProgram, listFixedSlots, setPlanMode } from "../../../services/fixedRoutines";
import type { CatalogItem, ExerciseRow } from "../../../services/exercises";

/**
 * Constructor en modo "Rutinas fijas": solo los días (Día A, B, C…), sin
 * semanas, bloques ni mesociclos. Cada día muestra su "próxima vez"; lo que
 * se cambia ahí se copia solo a las siguientes veces (en la base de datos,
 * part4d_migration.sql). Lo ya entrenado queda como historial.
 */
export default function FixedRoutinesBuilder({
  programId,
  clientName,
  renderEditor,
  onSwitchedToWeekly,
}: {
  programId: string;
  clientName: string;
  /** El editor de rutina de siempre (SessionEditor), para el día elegido. */
  renderEditor: (session: SessionRow, onChanged: () => void) => JSX.Element;
  onSwitchedToWeekly: () => void;
  exercises?: ExerciseRow[];
  muscles?: CatalogItem[];
}) {
  const { notify } = useToast();
  const [slots, setSlots] = useState<SessionRow[] | null>(null);
  const [activeSort, setActiveSort] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDay, setNewDay] = useState(3);
  const [toDelete, setToDelete] = useState<SessionRow | null>(null);
  const [switching, setSwitching] = useState(false);

  const load = async () => {
    try {
      await extendFixedProgram(programId);
      const ss = await listFixedSlots(programId);
      setSlots(ss);
      setActiveSort((prev) => (prev !== null && ss.some((s) => s.sort_order === prev) ? prev : ss[0]?.sort_order ?? null));
    } catch (e: any) {
      notify(e.message);
      setSlots([]);
    }
  };
  useEffect(() => {
    setSlots(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId]);

  const openAdd = () => {
    const used = new Set((slots ?? []).map((s) => s.day_of_week));
    const nextLetter = String.fromCharCode(65 + (slots?.length ?? 0));
    setNewName(`Día ${nextLetter}`);
    setNewDay([1, 3, 5, 2, 4, 6, 7].find((d) => !used.has(d)) ?? 1);
    setAdding(true);
  };

  const active = slots?.find((s) => s.sort_order === activeSort) ?? null;

  if (!slots) return <Loading />;

  return (
    <>
      <div className="fixed-mode-bar">
        <span>
          🔁 <b>Rutinas fijas</b> — se repiten cada semana. Lo que cambies aplica desde la próxima vez; lo ya entrenado queda en el
          historial de {clientName.split(" ")[0]}.
        </span>
        <button className="link-btn" style={{ fontSize: 13.5 }} onClick={() => setSwitching(true)}>
          Pasar a plan por semanas
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        {slots.map((s) => (
          <span key={s.id} className={`fixed-day${s.sort_order === activeSort ? " on" : ""}`}>
            <button onClick={() => setActiveSort(s.sort_order)}>
              {s.name}
              {s.day_of_week ? ` · ${DAY_OF_WEEK_LABEL[s.day_of_week].slice(0, 3)}` : ""}
            </button>
            {slots.length > 1 && (
              <button aria-label={`Quitar ${s.name}`} className="x" onClick={() => setToDelete(s)}>
                <X size={13} />
              </button>
            )}
          </span>
        ))}
        {!adding && (
          <button className="fixed-day add" onClick={openAdd}>
            + Agregar día
          </button>
        )}
        {adding && (
          <span className="fixed-add-form">
            <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ width: 150, padding: "6px 8px" }} aria-label="Nombre del día" />
            <select className="input" value={newDay} onChange={(e) => setNewDay(Number(e.target.value))} style={{ width: "auto", padding: "6px 8px" }} aria-label="Día de la semana">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <option key={d} value={d}>{DAY_OF_WEEK_LABEL[d]}</option>
              ))}
            </select>
            <button
              className="btn"
              style={{ padding: "6px 12px", fontSize: 13 }}
              disabled={!newName.trim()}
              onClick={async () => {
                try {
                  await addFixedDay(programId, newName.trim(), newDay);
                  setAdding(false);
                  const before = new Set(slots.map((s) => s.sort_order));
                  const ss = await listFixedSlots(programId);
                  setSlots(ss);
                  setActiveSort(ss.find((s) => !before.has(s.sort_order))?.sort_order ?? activeSort);
                  notify("Día agregado.");
                } catch (e: any) {
                  notify(e.message);
                }
              }}
            >
              Agregar
            </button>
            <button className="btn ghost" style={{ padding: "6px 10px", fontSize: 13 }} onClick={() => setAdding(false)}>Cancelar</button>
          </span>
        )}
      </div>

      {active ? (
        <div key={active.id}>{renderEditor(active, load)}</div>
      ) : (
        <p className="note">Agrega el primer día para empezar.</p>
      )}

      {toDelete && (
        <ConfirmModal
          title={`Quitar ${toDelete.name}`}
          message={`Se quita de las próximas semanas. Las veces que ${clientName.split(" ")[0]} ya lo entrenó quedan en su historial.`}
          confirmLabel="Quitar"
          danger
          onClose={() => setToDelete(null)}
          onConfirm={async () => {
            try {
              await deleteFixedDay(programId, toDelete.sort_order);
              setToDelete(null);
              await load();
              notify("Día quitado.");
            } catch (e: any) {
              notify(e.message);
            }
          }}
        />
      )}

      {switching && (
        <ConfirmModal
          title="Pasar a plan por semanas"
          message="Vas a ver las semanas por separado, con bloques y progresión. Las rutinas que ya armaste siguen igual, pero desde ahí cada semana se edita por su cuenta (los cambios ya no se copian solos)."
          confirmLabel="Pasar a plan por semanas"
          onClose={() => setSwitching(false)}
          onConfirm={async () => {
            try {
              await setPlanMode(programId, "weekly");
              setSwitching(false);
              onSwitchedToWeekly();
            } catch (e: any) {
              notify(e.message);
            }
          }}
        />
      )}
    </>
  );
}
