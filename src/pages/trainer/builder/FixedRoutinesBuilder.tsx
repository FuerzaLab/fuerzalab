import { useEffect, useState } from "react";
import { X, Copy, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "../../../contexts/ToastContext";
import Loading from "../../../components/ui/Loading";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import { DAY_OF_WEEK_LABEL, type SessionRow } from "../../../services/sessions";
import { addFixedDay, deleteFixedDay, duplicateFixedDay, extendFixedProgram, listFixedSlots, setPlanMode, swapFixedDays } from "../../../services/fixedRoutines";
import type { CatalogItem, ExerciseRow } from "../../../services/exercises";
import { supabase } from "../../../lib/supabase";
import { setStrictOrder } from "../../../services/programs";

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
  // 0 = sin día fijo (el alumno elige cuál hacer).
  const [newDay, setNewDay] = useState(0);
  const [busy, setBusy] = useState(false);
  // Rutinas en orden (rotación A → B → C → A…), por defecto activado (part4o).
  const [strict, setStrict] = useState(true);
  useEffect(() => {
    supabase.from("programs").select("strict_order").eq("id", programId).maybeSingle().then(({ data }) => {
      if (data && (data as any).strict_order === false) setStrict(false);
    });
  }, [programId]);
  const [dragSort, setDragSort] = useState<number | null>(null);
  const [overSort, setOverSort] = useState<number | null>(null);
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

  const nextLetterName = () => {
    const used = new Set((slots ?? []).map((s) => s.name.trim().toLowerCase()));
    for (let i = 0; i < 26; i++) {
      const n = `Día ${String.fromCharCode(65 + i)}`;
      if (!used.has(n.toLowerCase())) return n;
    }
    return `Día ${(slots?.length ?? 0) + 1}`;
  };

  const openAdd = () => {
    setNewName(nextLetterName());
    setNewDay(0);
    setAdding(true);
  };

  /** Recarga y deja elegida la rutina de ese lugar. */
  const reloadAndSelect = async (sort: number | null) => {
    const ss = await listFixedSlots(programId);
    setSlots(ss);
    setActiveSort(sort !== null && ss.some((x) => x.sort_order === sort) ? sort : ss[0]?.sort_order ?? null);
  };

  const swap = async (a: number, b: number, keep: number) => {
    setBusy(true);
    try {
      await swapFixedDays(programId, a, b);
      await reloadAndSelect(keep);
    } catch (e: any) {
      notify(e.message);
    }
    setBusy(false);
  };

  /** Mueve la rutina de un lugar a otro: intercambia de a pares hasta llegar. */
  const moveTo = async (fromSort: number, toSort: number) => {
    if (!slots || fromSort === toSort) return;
    const order = slots.map((x) => x.sort_order);
    let i = order.indexOf(fromSort);
    const j = order.indexOf(toSort);
    if (i < 0 || j < 0) return;
    setBusy(true);
    try {
      while (i !== j) {
        const k = i < j ? i + 1 : i - 1;
        await swapFixedDays(programId, order[i], order[k]);
        i = k;
      }
      await reloadAndSelect(toSort);
    } catch (e: any) {
      notify(e.message);
    }
    setBusy(false);
  };

  const duplicate = async (s0: SessionRow) => {
    setBusy(true);
    try {
      const before = new Set((slots ?? []).map((x) => x.sort_order));
      await duplicateFixedDay(programId, s0, `${s0.name} (copia)`);
      const ss = await listFixedSlots(programId);
      setSlots(ss);
      setActiveSort(ss.find((x) => !before.has(x.sort_order))?.sort_order ?? activeSort);
      notify(`Copiaste ${s0.name}. Cámbiale el nombre en la rutina de abajo.`);
    } catch (e: any) {
      notify(e.message);
    }
    setBusy(false);
  };

  const active = slots?.find((s) => s.sort_order === activeSort) ?? null;

  if (!slots) return <Loading />;

  return (
    <>
      <div className="fixed-mode-bar">
        <span>
          🔁 <b>Rutinas fijas</b> — se repiten cada semana.{" "}
          {strict
            ? `${clientName.split(" ")[0]} las hace en orden: después de la última, vuelve a la primera.`
            : `${clientName.split(" ")[0]} las ve todas y elige cuál hacer (o asígnale un día a cada una).`}{" "}
          Lo que cambies aplica desde la próxima vez; lo ya entrenado queda en su historial.
        </span>
        <button className="link-btn" style={{ fontSize: 13.5 }} onClick={() => setSwitching(true)}>
          Pasar a plan por semanas
        </button>
        <label className="fixed-order">
            <input
              type="checkbox"
              checked={strict}
              onChange={async (e) => {
                const v = e.target.checked;
                setStrict(v);
                try {
                  await setStrictOrder(programId, v);
                } catch (err: any) {
                  notify(err.message);
                  setStrict(!v);
                }
              }}
            />
          Rutinas en orden: las hace una tras otra (después de la última, vuelve a la primera)
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        {slots.map((s, idx) => (
          <span
            key={s.id}
            className={`fixed-day${s.sort_order === activeSort ? " on" : ""}${overSort === s.sort_order ? " drag-over" : ""}`}
            draggable={!busy}
            onDragStart={(e) => {
              setDragSort(s.sort_order);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              if (dragSort === null) return;
              e.preventDefault();
              setOverSort(s.sort_order);
            }}
            onDragLeave={() => setOverSort((x) => (x === s.sort_order ? null : x))}
            onDrop={(e) => {
              e.preventDefault();
              const from = dragSort;
              setDragSort(null);
              setOverSort(null);
              if (from !== null) moveTo(from, s.sort_order);
            }}
            onDragEnd={() => {
              setDragSort(null);
              setOverSort(null);
            }}
            title="Arrastra para cambiarla de lugar"
          >
            {idx > 0 && (
              <button className="x" aria-label={`Mover ${s.name} a la izquierda`} disabled={busy} onClick={() => swap(slots[idx - 1].sort_order, s.sort_order, s.sort_order === activeSort ? slots[idx - 1].sort_order : activeSort ?? s.sort_order)}>
                <ChevronLeft size={14} />
              </button>
            )}
            <button onClick={() => setActiveSort(s.sort_order)}>
              {s.name}
              {s.day_of_week ? ` · ${DAY_OF_WEEK_LABEL[s.day_of_week].slice(0, 3)}` : ""}
            </button>
            {idx < slots.length - 1 && (
              <button className="x" aria-label={`Mover ${s.name} a la derecha`} disabled={busy} onClick={() => swap(s.sort_order, slots[idx + 1].sort_order, s.sort_order === activeSort ? slots[idx + 1].sort_order : activeSort ?? s.sort_order)}>
                <ChevronRight size={14} />
              </button>
            )}
            <button className="x" aria-label={`Copiar ${s.name}`} title="Copiar esta rutina" disabled={busy} onClick={() => duplicate(s)}>
              <Copy size={13} />
            </button>
            {slots.length > 1 && (
              <button aria-label={`Quitar ${s.name}`} title="Quitar esta rutina" className="x" disabled={busy} onClick={() => setToDelete(s)}>
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
              <option value={0}>Sin día fijo</option>
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
                  await addFixedDay(programId, newName.trim(), newDay || null);
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
