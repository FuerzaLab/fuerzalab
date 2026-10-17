import { useEffect, useMemo, useState } from "react";
import { Plus, Copy, X } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import Modal from "../../../components/ui/Modal";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import Chip from "../../../components/ui/Chip";
import { listClients, type ClientRow } from "../../../services/clients";
import {
  listPrograms,
  listMesocycles,
  listWeeks,
  updateWeekStartDate,
  createProgram,
  updateProgramName,
  setAllowMultipleSessionsPerDay,
  updateMesocycle,
  addMesocycle,
  removeMesocycle,
  duplicateMesocycle,
  deleteProgram,
  extendProgramWeeks,
  syncWeekBlocks,
  METHOD_LABEL,
  type ProgramRow,
  type ProgramMethod,
  type MesocycleRow,
  type WeekRow,
} from "../../../services/programs";

const PHASE_COLOR: Record<string, string> = {
  accumulation: "#2E8B6E",
  transformation: "#D98E04",
  realization: "#C2412D",
};
const BLOCK_COLORS = ["#3B4F8F", "#4F6BB8", "#6C86D1", "#8AA0DE", "#A9BCEA", "#C6D2F0"];

export default function ProgramsPage() {
  const { profile } = useAuth();
  const { notify } = useToast();

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientId, setClientId] = useState("");
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [programId, setProgramId] = useState("");
  const [mesos, setMesos] = useState<MesocycleRow[]>([]);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [selMeso, setSelMeso] = useState(0);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProgramRow | null>(null);

  useEffect(() => {
    listClients().then(setClients).catch((e) => notify(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPrograms = async (cId: string) => {
    const ps = await listPrograms(cId);
    setPrograms(ps);
    setProgramId(ps[0]?.id ?? "");
  };

  useEffect(() => {
    if (clientId) loadPrograms(clientId);
    else {
      setPrograms([]);
      setProgramId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const loadProgramDetail = async (pId: string) => {
    setLoading(true);
    try {
      const [m, w] = await Promise.all([listMesocycles(pId), listWeeks(pId)]);
      setMesos(m);
      setWeeks(w);
      setSelMeso(0);
    } catch (e: any) {
      notify(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (programId) loadProgramDetail(programId);
    else {
      setMesos([]);
      setWeeks([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId]);

  const program = programs.find((p) => p.id === programId) ?? null;
  const meso = mesos[selMeso];
  const assignedWeeks = mesos.reduce((t, m) => t + (m.duration_weeks ?? 0), 0);

  const weekSeries = useMemo(() => buildWeekSeries(mesos), [mesos]);

  const patchMeso = async (field: keyof MesocycleRow, value: any) => {
    if (!meso) return;
    if (field === "duration_weeks") value = Math.max(1, value);
    setMesos((ms) => ms.map((m, i) => (i === selMeso ? { ...m, [field]: value } : m)));
    try {
      await updateMesocycle(meso.id, { [field]: value });
      if (field === "duration_weeks") {
        const newTotal = mesos.reduce((t, m, i) => t + (i === selMeso ? value : m.duration_weeks ?? 0), 0);
        await extendProgramWeeks(programId, newTotal);
        await syncWeekBlocks(programId);
        await loadProgramDetail(programId);
      }
    } catch (e: any) {
      notify(e.message);
    }
  };

  if (!profile) return null;

  return (
    <div className="page">
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Planificación</h1>
          <p className="note">Elige un cliente para ver o crear su programa.</p>
        </div>
        {clientId && (
          <button className="btn" onClick={() => setShowNew(true)}>
            <Plus size={16} /> Nuevo programa
          </button>
        )}
      </div>

      <div style={{ marginBottom: 20, maxWidth: 320 }}>
        <label className="field-label">Cliente</label>
        <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Selecciona un cliente</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.full_name}</option>
          ))}
        </select>
      </div>

      {clientId && programs.length === 0 && !loading && (
        <p className="note">Este cliente todavía no tiene un programa. Crea uno con "Nuevo programa".</p>
      )}

      {programs.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {programs.map((p) => (
            <span
              key={p.id}
              className="chip"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                border: "1px solid var(--line)",
                background: p.id === programId ? "var(--pri)" : "#fff",
                color: p.id === programId ? "#fff" : "var(--muted)",
                paddingRight: 6,
              }}
            >
              <button onClick={() => setProgramId(p.id)} style={{ border: 0, background: "none", color: "inherit", cursor: "pointer", font: "inherit" }}>
                {p.name}
              </button>
              <button
                aria-label={`Eliminar ${p.name}`}
                onClick={() => setDeleteTarget(p)}
                style={{ border: 0, background: "none", color: "inherit", opacity: 0.75, cursor: "pointer", display: "inline-flex" }}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {program && (
        <>
          <div className="panel" style={{ marginBottom: 18 }}>
            <div className="hd"><h3>Datos del programa</h3></div>
            <div className="bd">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, marginBottom: 14 }}>
                <div>
                  <label className="field-label">Nombre del programa</label>
                  <input
                    className="input"
                    value={program.name}
                    onChange={(e) => setPrograms((ps) => ps.map((p) => (p.id === program.id ? { ...p, name: e.target.value } : p)))}
                    onBlur={async (e) => {
                      if (!e.target.value.trim()) return;
                      await updateProgramName(program.id, e.target.value.trim());
                    }}
                  />
                </div>
                <div>
                  <label className="field-label">Cliente</label>
                  <div className="input" style={{ background: "var(--bg)", color: "var(--muted)" }}>
                    {clients.find((c) => c.id === clientId)?.full_name ?? ""}
                  </div>
                </div>
              </div>
              <label className="field-label">Duración total: {assignedWeeks} semana{assignedWeeks === 1 ? "" : "s"}</label>
              <p className="note" style={{ marginBottom: 14 }}>
                Es la suma de los bloques de abajo — crece sola a medida que añades bloques o alargas uno existente. Si acortás un bloque, las semanas ya creadas no se borran (podrían tener rutinas armadas en el Constructor).
              </p>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={program.allow_multiple_sessions_per_day}
                  onChange={async (e) => {
                    const allow = e.target.checked;
                    setPrograms((ps) => ps.map((p) => (p.id === program.id ? { ...p, allow_multiple_sessions_per_day: allow } : p)));
                    await setAllowMultipleSessionsPerDay(program.id, allow);
                  }}
                />
                <span>Permitir más de una rutina por día (ej. doble turno)</span>
              </label>
              <p className="note" style={{ marginBottom: 14 }}>Por defecto, el cliente solo puede completar una rutina por día en este programa.</p>

              <label className="field-label">Fecha de inicio real (opcional)</label>
              <input
                type="date"
                className="input"
                style={{ maxWidth: 180, marginBottom: 8 }}
                value={weeks[0]?.start_date ?? ""}
                onChange={async (e) => {
                  const date = e.target.value || null;
                  if (!weeks[0]) return;
                  await updateWeekStartDate(weeks[0].id, date);
                  setWeeks((ws) => ws.map((w, i) => (i === 0 ? { ...w, start_date: date } : w)));
                }}
              />
              <p className="note">
                Con esto fijado, el panel de Inicio puede mostrarte qué rutina le toca a cada cliente hoy. Las demás semanas se calculan solas a partir de esta fecha — no hace falta ponerla en cada una.
              </p>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 18 }}>
            <div className="hd">
              <h3>Método de periodización</h3>
              <Chip tone="pri">{METHOD_LABEL[program.method]}</Chip>
            </div>
            <div className="bd">
              <p className="note" style={{ marginBottom: 14 }}>
                El método se eligió al crear este programa y no se puede cambiar después, porque las fases o bloques
                dependen de él. Si necesitas otro método, crea un programa nuevo.
              </p>

              {loading ? (
                <p className="note">Cargando…</p>
              ) : (
                <>
                  <div style={{ display: "flex", height: 64, borderRadius: 8, overflow: "hidden", gap: 3 }}>
                    {mesos.map((m, i) => (
                      <button
                        key={m.id}
                        onClick={() => setSelMeso(i)}
                        style={{
                          flex: m.duration_weeks || 1,
                          border: 0,
                          color: "#fff",
                          textAlign: "left",
                          padding: "8px 10px",
                          cursor: "pointer",
                          opacity: i === selMeso ? 1 : 0.65,
                          background:
                            program.method === "atr" ? PHASE_COLOR[m.phase] ?? "#1E3FA8" : BLOCK_COLORS[i % BLOCK_COLORS.length],
                        }}
                      >
                        <b style={{ display: "block", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20 }}>
                          {program.method === "atr" ? m.phase[0].toUpperCase() : m.name}
                        </b>
                        <span style={{ fontSize: 12 }}>Duración: {m.duration_weeks ?? 0} semana{(m.duration_weeks ?? 0) === 1 ? "" : "s"}</span>
                      </button>
                    ))}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${weekSeries.length || 1},minmax(0,1fr))`, gap: 6, marginTop: 14 }}>
                    {weekSeries.map((w) => (
                      <div key={w.n} style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 3, height: 60, alignItems: "flex-end", justifyContent: "center" }}>
                          <div title={`Volumen ${w.vol}%`} style={{ width: 8, height: `${w.vol * 0.6}px`, background: "#9FB0E6", borderRadius: 2 }} />
                          <div
                            title={`Intensidad ${w.int}%`}
                            style={{
                              width: 8,
                              height: `${w.int * 0.6}px`,
                              borderRadius: 2,
                              background: program.method === "atr" ? PHASE_COLOR[mesos[w.segIndex]?.phase] ?? "#1E3FA8" : BLOCK_COLORS[w.segIndex % BLOCK_COLORS.length],
                            }}
                          />
                        </div>
                        <div className="note" style={{ marginTop: 4, fontSize: 11 }}>S{w.n}</div>
                      </div>
                    ))}
                  </div>

                  <p className="note" style={{ marginTop: 10 }}>
                    {assignedWeeks} semana{assignedWeeks === 1 ? "" : "s"} en total.
                  </p>

                  {program.method !== "atr" && (
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button
                        className="btn ghost"
                        onClick={async () => {
                          const macro = mesos[0];
                          const defaultDuration = 2;
                          const created = await addMesocycle(program.id, macro.macrocycle_id, mesos.length, defaultDuration);
                          await extendProgramWeeks(program.id, assignedWeeks + defaultDuration);
                          await syncWeekBlocks(program.id);
                          setMesos((ms) => [...ms, created]);
                          setSelMeso(mesos.length);
                          notify("Bloque añadido. Complétalo abajo.");
                        }}
                      >
                        <Plus size={14} /> Añadir bloque
                      </button>
                      <button
                        className="btn ghost"
                        style={{ color: "var(--bad)" }}
                        disabled={mesos.length <= 1}
                        onClick={async () => {
                          if (mesos.length <= 1) return;
                          await removeMesocycle(program.id, meso.id);
                          const rest = mesos.filter((_, i) => i !== selMeso);
                          setMesos(rest);
                          setSelMeso(Math.max(0, selMeso - 1));
                          notify("Bloque eliminado");
                        }}
                      >
                        Eliminar este bloque
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {meso && (
            <div className="panel">
              <div className="hd">
                <h3>{program.method === "atr" ? `${meso.phase[0].toUpperCase()}: ${meso.name}` : meso.name}</h3>
                {program.method !== "atr" && (
                  <button
                    className="btn ghost"
                    onClick={async () => {
                      const created = await duplicateMesocycle(program.id, meso, mesos.length);
                      await extendProgramWeeks(program.id, assignedWeeks + (created.duration_weeks ?? 0));
                      await syncWeekBlocks(program.id);
                      setMesos((ms) => [...ms, created]);
                      notify("Bloque duplicado. Ajusta lo que cambie.");
                    }}
                  >
                    <Copy size={14} /> Duplicar bloque
                  </button>
                )}
              </div>
              <div className="bd">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 14 }}>
                  <div>
                    <label className="field-label">{program.method === "atr" ? "Duración de la fase (semanas)" : "Duración (semanas)"}</label>
                    <input
                      className="input"
                      style={{ maxWidth: 100 }}
                      inputMode="numeric"
                      value={meso.duration_weeks ?? ""}
                      onChange={(e) => patchMeso("duration_weeks", Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1))}
                    />
                  </div>
                  <div>
                    <label className="field-label">Objetivo</label>
                    <input className="input" value={meso.objective ?? ""} onChange={(e) => patchMeso("objective", e.target.value)} />
                  </div>
                  {program.method === "atr" && (
                    <div>
                      <label className="field-label">Frecuencia (días/semana)</label>
                      <input className="input" style={{ maxWidth: 100 }} inputMode="numeric" value={meso.frequency ?? ""} onChange={(e) => patchMeso("frequency", Number(e.target.value.replace(/\D/g, "")) || null)} />
                    </div>
                  )}
                  <div>
                    <label className="field-label">Volumen</label>
                    <input className="input" value={meso.volume_focus ?? ""} onChange={(e) => patchMeso("volume_focus", e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">Intensidad</label>
                    <input className="input" value={meso.intensity_focus ?? ""} onChange={(e) => patchMeso("intensity_focus", e.target.value)} />
                  </div>
                </div>
                <label className="field-label">Criterio de progresión</label>
                <textarea
                  className="input"
                  style={{ minHeight: 70 }}
                  value={meso.progression_criteria ?? ""}
                  onChange={(e) => patchMeso("progression_criteria", e.target.value)}
                  placeholder={program.method === "atr" ? undefined : "Ej. +2,5 kg por semana mientras se mantenga el RIR objetivo."}
                />
              </div>
            </div>
          )}
        </>
      )}

      {showNew && (
        <NewProgramModal
          organizationId={profile.organization_id!}
          trainerId={profile.id}
          clientId={clientId}
          onClose={() => setShowNew(false)}
          onCreated={async (p) => {
            setShowNew(false);
            await loadPrograms(clientId);
            setProgramId(p.id);
            notify(`Programa "${p.name}" creado.`);
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Eliminar programa"
          message={`¿Eliminar "${deleteTarget.name}"? Se borran también sus fases o bloques y, si ya armaste rutinas para alguna de sus semanas en el Constructor, se pierden con él. Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar programa"
          danger
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await deleteProgram(deleteTarget.id);
            const rest = programs.filter((p) => p.id !== deleteTarget.id);
            setPrograms(rest);
            if (programId === deleteTarget.id) setProgramId(rest[0]?.id ?? "");
            setDeleteTarget(null);
            notify(`Programa "${deleteTarget.name}" eliminado.`);
          }}
        />
      )}
    </div>
  );
}

function NewProgramModal({
  organizationId,
  trainerId,
  clientId,
  onClose,
  onCreated,
}: {
  organizationId: string;
  trainerId: string;
  clientId: string;
  onClose: () => void;
  onCreated: (p: ProgramRow) => void;
}) {
  const [name, setName] = useState("");
  const [method, setMethod] = useState<ProgramMethod>("atr");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      setError("Escribe un nombre para poder crear el programa.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const p = await createProgram({
        organizationId,
        trainerId,
        clientId,
        name: name.trim(),
        method,
      });
      onCreated(p);
    } catch (e: any) {
      setError(e.message ?? "No pudimos crear el programa.");
    }
    setSaving(false);
  };

  return (
    <Modal title="Nuevo programa" onClose={onClose}>
      <label className="field-label">Nombre del programa</label>
      <input className="input" style={{ marginBottom: 12 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Fuerza máxima, bloque 1" autoFocus />

      <label className="field-label">Método de periodización</label>
      <select className="input" style={{ marginBottom: 12 }} value={method} onChange={(e) => setMethod(e.target.value as ProgramMethod)}>
        {Object.entries(METHOD_LABEL).map(([k, l]) => (
          <option key={k} value={k}>{l}</option>
        ))}
      </select>
      <p className="note" style={{ marginBottom: 18 }}>
        El método no se podrá cambiar después de crear el programa. La duración no se pide ahora — va a ser la suma de los bloques que armes después, dentro del programa.
      </p>

      {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}
      <button className="btn" onClick={submit} disabled={saving}>
        {saving ? "Creando…" : "Crear programa"}
      </button>
    </Modal>
  );
}

function buildWeekSeries(segments: MesocycleRow[]) {
  const total = segments.reduce((t, s) => t + (s.duration_weeks ?? 0), 0);
  const out: { n: number; segIndex: number; vol: number; int: number }[] = [];
  let wn = 0;
  segments.forEach((seg, si) => {
    const span = Math.max(0, seg.duration_weeks ?? 0);
    for (let i = 0; i < span; i++) {
      wn++;
      const progress = total > 1 ? (wn - 1) / (total - 1) : 0;
      out.push({ n: wn, segIndex: si, vol: Math.round(85 - progress * 50), int: Math.round(55 + progress * 40) });
    }
  });
  return out;
}
