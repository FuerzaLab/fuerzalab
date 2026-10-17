import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X, Copy, FileUp, ChevronLeft, ChevronRight } from "lucide-react";
import ImportRoutineModal, { applyImportedRows } from "./ImportRoutineModal";
import Modal from "../../../components/ui/Modal";
import { useToast } from "../../../contexts/ToastContext";
import { listClients, type ClientRow } from "../../../services/clients";
import { listPrograms, listWeeks, listMesocycles, createWeek, type ProgramRow, type WeekRow, type MesocycleRow } from "../../../services/programs";
import {
  listExercises,
  listCatalog,
  bodyRegionOf,
  type ExerciseRow,
  type CatalogItem,
} from "../../../services/exercises";
import {
  listSessions,
  createSession,
  deleteSession,
  duplicateSession,
  reorderSessions,
  getAutoregulationPreview,
  type AutoregulationSuggestion,
  updateSessionName,
  updateSessionStrengthType,
  updateSessionDay,
  DAY_OF_WEEK_LABEL,
  listSessionBlocks,
  listWorkoutExercises,
  addWorkoutExercise,
  updateWorkoutExercise,
  deleteWorkoutExercise,
  groupAsSuperset,
  ungroupSuperset,
  applyStrengthSuggestion,
  copyWeek,
  BLOCK_LABEL,
  BLOCK_ORDER,
  STRENGTH_TYPES,
  HR_ZONES,
  type SessionRow,
  type SessionBlockRow,
  type WorkoutExerciseRow,
  type BlockKind,
  type StrengthType,
} from "../../../services/sessions";

export default function BuilderPage() {
  const { notify } = useToast();

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientId, setClientId] = useState("");
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [programId, setProgramId] = useState("");
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [mesos, setMesos] = useState<MesocycleRow[]>([]);
  const [creatingWeek, setCreatingWeek] = useState(false);
  const plannedWeeks = mesos.reduce((t, m) => t + (m.duration_weeks ?? 0), 0);
  const [weekId, setWeekId] = useState("");

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionId, setSessionId] = useState("");

  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [muscles, setMuscles] = useState<CatalogItem[]>([]);

  const [autoRegPreview, setAutoRegPreview] = useState<AutoregulationSuggestion[] | null>(null);
  const [autoRegTarget, setAutoRegTarget] = useState<{ fromWeekId: string; toWeek: WeekRow } | null>(null);
  const [loadingAutoReg, setLoadingAutoReg] = useState(false);

  useEffect(() => {
    listClients().then(setClients).catch((e) => notify(e.message));
    listExercises().then(setExercises).catch((e) => notify(e.message));
    listCatalog("muscle_group").then(setMuscles).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!clientId) {
      setPrograms([]);
      setProgramId("");
      return;
    }
    listPrograms(clientId).then((ps) => {
      setPrograms(ps);
      setProgramId(ps[0]?.id ?? "");
    });
  }, [clientId]);

  useEffect(() => {
    if (!programId) {
      setWeeks([]);
      setWeekId("");
      return;
    }
    Promise.all([listWeeks(programId), listMesocycles(programId)]).then(([ws, ms]) => {
      setWeeks(ws);
      setMesos(ms);
      setWeekId(ws[0]?.id ?? "");
    });
  }, [programId]);

  const loadSessions = async (wId: string) => {
    const ss = await listSessions(wId);
    setSessions(ss);
    setSessionId(ss[0]?.id ?? "");
  };

  useEffect(() => {
    if (weekId) loadSessions(weekId);
    else {
      setSessions([]);
      setSessionId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekId]);

  const muscleById = useMemo(() => Object.fromEntries(muscles.map((m) => [m.id, m])), [muscles]);

  return (
    <div className="page">
      <h1 style={{ marginBottom: 4 }}>Constructor de rutinas</h1>
      <p className="note" style={{ marginBottom: 20 }}>Elige cliente, programa y semana para armar las sesiones.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginBottom: 18 }}>
        <div>
          <label className="field-label">Cliente</label>
          <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Selecciona</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.full_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Programa</label>
          <select className="input" value={programId} onChange={(e) => setProgramId(e.target.value)} disabled={!clientId}>
            <option value="">{programs.length ? "Selecciona" : "Sin programas"}</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {clientId && !programs.length && (
        <p className="note" style={{ marginBottom: 18 }}>
          Este cliente todavía no tiene un programa. Créalo primero en "Planificación".
        </p>
      )}

      {weeks.length > 0 && (
        <>
          <p className="note" style={{ marginBottom: 8 }}>
            Planificación tiene {plannedWeeks} semana{plannedWeeks === 1 ? "" : "s"} en total
            {weeks.length > plannedWeeks ? ` — las que aparecen en gris abajo (${weeks.length - plannedWeeks}) existen pero no pertenecen a ningún bloque actual; revisalas en Planificación.` : "."}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10, alignItems: "center" }}>
            {weeks.map((w) => {
              const beyondPlan = w.week_number > plannedWeeks;
              return (
                <button
                  key={w.id}
                  onClick={() => setWeekId(w.id)}
                  className="btn ghost"
                  style={{
                    padding: "6px 14px",
                    fontSize: 13,
                    background: w.id === weekId ? "var(--pri)" : "transparent",
                    color: w.id === weekId ? "#fff" : beyondPlan ? "var(--muted)" : "var(--pri)",
                    borderStyle: beyondPlan ? "dashed" : "solid",
                  }}
                >
                  Semana {w.week_number}
                </button>
              );
            })}
            {weeks.length < plannedWeeks && (
              <button
                className="btn ghost"
                style={{ padding: "6px 14px", fontSize: 13 }}
                disabled={creatingWeek}
                onClick={async () => {
                  setCreatingWeek(true);
                  try {
                    const created = await createWeek(programId, weeks.length + 1);
                    setWeeks((ws) => [...ws, created]);
                    setWeekId(created.id);
                    notify(`Semana ${created.week_number} creada.`);
                  } catch (e: any) {
                    notify(e.message);
                  }
                  setCreatingWeek(false);
                }}
              >
                <Plus size={14} /> {creatingWeek ? "Creando…" : "Crear semana"}
              </button>
            )}
          </div>
        </>
      )}

      {weekId && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 18 }}>
            {sessions.map((s, i) => (
              <span key={s.id} className="chip" style={{ background: s.id === sessionId ? "var(--pri)" : "#fff", color: s.id === sessionId ? "#fff" : "var(--muted)", border: "1px solid var(--line)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                {i > 0 && (
                  <button
                    aria-label={`Mover ${s.name} antes`}
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        const ids = sessions.map((x) => x.id);
                        [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                        await reorderSessions(ids);
                        await loadSessions(weekId);
                      } catch (err: any) {
                        notify(err.message ?? "No pudimos mover esta rutina.");
                      }
                    }}
                    style={{ border: 0, background: "none", color: "inherit", cursor: "pointer", display: "inline-flex", opacity: 0.8 }}
                  >
                    <ChevronLeft size={13} />
                  </button>
                )}
                <button onClick={() => setSessionId(s.id)} style={{ border: 0, background: "none", color: "inherit", cursor: "pointer", font: "inherit" }}>
                  {s.name}
                  {s.day_of_week && <span style={{ opacity: 0.75 }}> · {DAY_OF_WEEK_LABEL[s.day_of_week].slice(0, 3)}</span>}
                </button>
                {i < sessions.length - 1 && (
                  <button
                    aria-label={`Mover ${s.name} después`}
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        const ids = sessions.map((x) => x.id);
                        [ids[i], ids[i + 1]] = [ids[i + 1], ids[i]];
                        await reorderSessions(ids);
                        await loadSessions(weekId);
                      } catch (err: any) {
                        notify(err.message ?? "No pudimos mover esta rutina.");
                      }
                    }}
                    style={{ border: 0, background: "none", color: "inherit", cursor: "pointer", display: "inline-flex", opacity: 0.8 }}
                  >
                    <ChevronRight size={13} />
                  </button>
                )}
                <button
                  aria-label={`Duplicar ${s.name}`}
                  title="Duplicar en esta misma semana"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const nextOrder = Math.max(-1, ...sessions.map((x) => x.sort_order)) + 1;
                    const created = await duplicateSession(s, nextOrder);
                    await loadSessions(weekId);
                    setSessionId(created.id);
                    notify(`"${s.name}" duplicada.`);
                  }}
                  style={{ border: 0, background: "none", color: "inherit", cursor: "pointer", display: "inline-flex" }}
                >
                  <Copy size={12} />
                </button>
                {sessions.length > 1 && (
                  <button
                    aria-label={`Eliminar ${s.name}`}
                    onClick={async () => {
                      await deleteSession(s.id);
                      await loadSessions(weekId);
                      notify("Rutina eliminada");
                    }}
                    style={{ border: 0, background: "none", color: "inherit", cursor: "pointer", display: "inline-flex" }}
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            ))}
            <button
              className="btn ghost"
              style={{ padding: "5px 10px", fontSize: 13 }}
              onClick={async () => {
                const nextOrder = Math.max(-1, ...sessions.map((x) => x.sort_order)) + 1;
                const created = await createSession(weekId, `Rutina ${sessions.length + 1}`, nextOrder);
                await loadSessions(weekId);
                setSessionId(created.id);
              }}
            >
              <Plus size={14} /> Nueva rutina
            </button>
            {sessions.length > 0 && (
              <button
                className="btn ghost"
                style={{ padding: "5px 10px", fontSize: 13, marginLeft: "auto" }}
                onClick={async () => {
                  const idx = weeks.findIndex((w) => w.id === weekId);
                  const nextWeek = weeks[idx + 1];
                  if (!nextWeek) {
                    notify("Esta es la última semana del programa; no hay una siguiente para copiar.");
                    return;
                  }
                  setLoadingAutoReg(true);
                  try {
                    const preview = await getAutoregulationPreview(weekId, clientId);
                    setAutoRegPreview(preview);
                    setAutoRegTarget({ fromWeekId: weekId, toWeek: nextWeek });
                  } catch (e: any) {
                    notify(e.message);
                  }
                  setLoadingAutoReg(false);
                }}
                disabled={loadingAutoReg}
              >
                <Copy size={14} /> {loadingAutoReg ? "Calculando…" : "Copiar a la semana siguiente"}
              </button>
            )}
          </div>

          {sessionId && (
            <SessionEditor
              key={sessionId}
              sessionId={sessionId}
              initialSession={sessions.find((s) => s.id === sessionId)!}
              exercises={exercises}
              muscles={muscles}
              muscleById={muscleById}
              onRenamed={() => loadSessions(weekId)}
            />
          )}
        </>
      )}

      {autoRegPreview && autoRegTarget && (
        <AutoregulationModal
          preview={autoRegPreview}
          sourceWeekLabel={weeks.find((w) => w.id === autoRegTarget.fromWeekId)?.week_number}
          targetWeekLabel={autoRegTarget.toWeek.week_number}
          onClose={() => {
            setAutoRegPreview(null);
            setAutoRegTarget(null);
          }}
          onConfirm={async (overrides) => {
            await copyWeek(programId, autoRegTarget.fromWeekId, autoRegTarget.toWeek.id, 2.5, overrides);
            notify(`Semana ${autoRegTarget.toWeek.week_number} completada, con cargas ajustadas según el rendimiento real.`);
            setWeekId(autoRegTarget.toWeek.id);
            setAutoRegPreview(null);
            setAutoRegTarget(null);
          }}
        />
      )}
    </div>
  );
}

function SessionEditor({
  sessionId,
  initialSession,
  exercises,
  muscles,
  muscleById,
  onRenamed,
}: {
  sessionId: string;
  initialSession: SessionRow;
  exercises: ExerciseRow[];
  muscles: CatalogItem[];
  muscleById: Record<string, CatalogItem>;
  onRenamed: () => void;
}) {
  const { notify } = useToast();
  const [session, setSession] = useState<SessionRow>(initialSession);
  const [blocks, setBlocks] = useState<SessionBlockRow[]>([]);
  const [items, setItems] = useState<WorkoutExerciseRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [bodyFilter, setBodyFilter] = useState<"all" | "Superior" | "Inferior" | "Full body">("all");
  const [muscleFilter, setMuscleFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [pickExercise, setPickExercise] = useState("");
  const [pickBlock, setPickBlock] = useState<BlockKind>("main");

  const load = async () => {
    const [bl, ex] = await Promise.all([listSessionBlocks(sessionId), listWorkoutExercises(sessionId)]);
    setBlocks(bl);
    setItems(ex);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const filteredExercises = useMemo(() => {
    return exercises.filter((e) => {
      const region = bodyRegionOf(muscleById[e.primary_muscle_id ?? ""]?.key ?? null);
      const okBody = bodyFilter === "all" || region === bodyFilter;
      const okMuscle = muscleFilter === "all" || e.primary_muscle_id === muscleFilter;
      const okSearch = e.name.toLowerCase().includes(search.toLowerCase());
      return okBody && okMuscle && okSearch;
    });
  }, [exercises, bodyFilter, muscleFilter, search, muscleById]);

  const blockByKind = Object.fromEntries(blocks.map((b) => [b.kind, b]));

  const toggleSelect = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const groupLabels = (rows: WorkoutExerciseRow[]) => {
    const letters: Record<number, string> = {};
    let li = 0;
    rows.forEach((r) => {
      if (r.superset_group != null && !(r.superset_group in letters)) letters[r.superset_group] = String.fromCharCode(65 + li++);
    });
    const counters: Record<number, number> = {};
    const labels: Record<string, string> = {};
    rows.forEach((r) => {
      if (r.superset_group != null) {
        counters[r.superset_group] = (counters[r.superset_group] ?? 0) + 1;
        labels[r.id] = `${letters[r.superset_group]}${counters[r.superset_group]}`;
      }
    });
    return labels;
  };

  const patchItem = (id: string, field: keyof WorkoutExerciseRow, value: any) => {
    setItems((its) => its.map((it) => (it.id === id ? { ...it, [field]: value } : it)));
    updateWorkoutExercise(id, { [field]: value } as any).catch((e) => notify(e.message));
  };

  const removeItem = async (id: string) => {
    await deleteWorkoutExercise(id);
    setItems((its) => its.filter((it) => it.id !== id));
  };

  const addExercise = async () => {
    if (!pickExercise) {
      notify("Elige un ejercicio de la lista.");
      return;
    }
    const block = blockByKind[pickBlock];
    if (!block) return;
    const created = await addWorkoutExercise({
      sessionId,
      blockId: block.id,
      exerciseId: pickExercise,
      sortOrder: items.length,
      isCardio: pickBlock === "cardio",
    });
    setItems((its) => [...its, created]);
    setPickExercise("");
    notify(`"${created.exercise_name}" añadido a ${BLOCK_LABEL[pickBlock]}.`);
  };

  return (
    <div>
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="bd">
          <label className="field-label">Nombre de la rutina</label>
          <input
            className="input"
            style={{ marginBottom: 14, maxWidth: 360 }}
            value={session.name}
            placeholder="Nombre de la rutina"
            onChange={(e) => setSession((s) => ({ ...s, name: e.target.value }))}
            onBlur={async (e) => {
              if (!e.target.value.trim()) return;
              await updateSessionName(sessionId, e.target.value.trim());
              onRenamed();
            }}
          />

          <label className="field-label">Día de la semana (opcional)</label>
          <select
            className="input"
            style={{ marginBottom: 10, maxWidth: 260 }}
            value={session.day_of_week ?? ""}
            onChange={async (e) => {
              const day = e.target.value ? Number(e.target.value) : null;
              await updateSessionDay(sessionId, day);
              setSession((s) => (s ? { ...s, day_of_week: day } : s));
            }}
          >
            <option value="">Sin día asignado</option>
            {Object.entries(DAY_OF_WEEK_LABEL).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
          <p className="note" style={{ marginBottom: 14 }}>Si le asignás un día, el cliente la ve marcada como "Hoy" cuando corresponda, en vez de tener que adivinar cuál le toca.</p>

          <label className="field-label">Tipo de fuerza a trabajar</label>
          <select
            className="input"
            style={{ marginBottom: 10, maxWidth: 260 }}
            value={session.strength_type ?? ""}
            onChange={async (e) => {
              const st = e.target.value as StrengthType;
              await updateSessionStrengthType(sessionId, st);
              setSession((s) => (s ? { ...s, strength_type: st } : s));
            }}
          >
            <option value="">Sin definir</option>
            {Object.entries(STRENGTH_TYPES).map(([k, t]) => (
              <option key={k} value={k}>{t.label}</option>
            ))}
          </select>

          {session.strength_type && (
            <>
              <div style={{ overflowX: "auto", marginBottom: 10 }}>
                <table style={{ borderCollapse: "collapse", fontSize: 13.5, width: "100%" }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--muted)" }}>
                      <th style={{ padding: "4px 10px" }}>Objetivo</th>
                      <th style={{ padding: "4px 10px" }}>Intensidad</th>
                      <th style={{ padding: "4px 10px" }}>Reps</th>
                      <th style={{ padding: "4px 10px" }}>Series</th>
                      <th style={{ padding: "4px 10px" }}>Descanso</th>
                      <th style={{ padding: "4px 10px" }}>RIR</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: "4px 10px" }}>{STRENGTH_TYPES[session.strength_type].obj}</td>
                      <td style={{ padding: "4px 10px" }}>{STRENGTH_TYPES[session.strength_type].load}</td>
                      <td style={{ padding: "4px 10px" }}>{STRENGTH_TYPES[session.strength_type].reps}</td>
                      <td style={{ padding: "4px 10px" }}>{STRENGTH_TYPES[session.strength_type].sets}</td>
                      <td style={{ padding: "4px 10px" }}>{STRENGTH_TYPES[session.strength_type].rest}</td>
                      <td style={{ padding: "4px 10px" }}>{STRENGTH_TYPES[session.strength_type].rir}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <button
                className="btn ghost"
                style={{ fontSize: 13 }}
                onClick={async () => {
                  const n = await applyStrengthSuggestion(sessionId, session.strength_type!);
                  await load();
                  notify(`Series, repeticiones y descanso sugeridos aplicados a ${n} ejercicios de fuerza.`);
                }}
              >
                Sugerir series, repeticiones y descanso
              </button>
            </>
          )}
        </div>
      </div>

      {selected.length > 0 && (
        <div className="panel" style={{ marginBottom: 14, padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <span className="note">{selected.length} seleccionados</span>
          <div style={{ display: "flex", gap: 8 }}>
            {selected.length >= 2 && (
              <button
                className="btn"
                style={{ padding: "6px 12px", fontSize: 13 }}
                onClick={async () => {
                  if (selected.length >= 3) {
                    const order = items.map((it) => it.id);
                    const positions = selected.map((id) => order.indexOf(id)).sort((a, b) => a - b);
                    const isContiguous = positions.every((pos, i) => i === 0 || pos === positions[i - 1] + 1);
                    if (!isContiguous) {
                      notify("Para armar una serie gigante (3 o más ejercicios), tienen que estar uno justo después del otro en la lista, sin ningún otro ejercicio en el medio. Para una biserie (2 ejercicios) no hace falta que estén seguidos.");
                      return;
                    }
                  }
                  await groupAsSuperset(selected);
                  setSelected([]);
                  await load();
                  notify(selected.length === 2 ? "Biserie creada" : "Superserie creada");
                }}
              >
                Agrupar como superserie
              </button>
            )}
            <button className="btn ghost" style={{ padding: "6px 12px", fontSize: 13 }} onClick={() => setSelected([])}>
              Cancelar selección
            </button>
          </div>
        </div>
      )}

      {BLOCK_ORDER.map((kind) => {
        const rows = items.filter((it) => blockByKind[kind] && it.block_id === blockByKind[kind].id);
        if (!rows.length) return null;
        const labels = groupLabels(rows);
        const isCardio = kind === "cardio";
        return (
          <div className="panel" key={kind} style={{ marginBottom: 14 }}>
            <div className="hd"><h3>{BLOCK_LABEL[kind]}</h3></div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12.5 }}>
                    <th style={{ padding: "8px 10px" }} />
                    <th style={{ padding: "8px 10px" }}>Grupo</th>
                    <th style={{ padding: "8px 10px" }}>Ejercicio</th>
                    {isCardio ? (
                      <>
                        <th style={{ padding: "8px 10px" }}>Duración (min)</th>
                        <th style={{ padding: "8px 10px" }}>Distancia (km)</th>
                        <th style={{ padding: "8px 10px" }}>Pasos diarios</th>
                        <th style={{ padding: "8px 10px" }}>Zona de FC</th>
                        <th style={{ padding: "8px 10px" }}>Descanso (s)</th>
                      </>
                    ) : (
                      <>
                        <th style={{ padding: "8px 10px" }}>Series</th>
                        <th style={{ padding: "8px 10px" }}>Reps</th>
                        <th style={{ padding: "8px 10px" }}>Carga (kg)</th>
                        <th style={{ padding: "8px 10px" }}>RIR</th>
                        <th style={{ padding: "8px 10px" }}>Descanso (s)</th>
                        <th style={{ padding: "8px 10px" }}>Tempo</th>
                      </>
                    )}
                    <th style={{ padding: "8px 10px" }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((it) => (
                    <tr key={it.id} style={{ borderTop: "1px solid var(--line)" }}>
                      <td style={{ padding: "8px 10px" }}>
                        <input type="checkbox" checked={selected.includes(it.id)} onChange={() => toggleSelect(it.id)} />
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        {labels[it.id] ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                            <span className="chip pri">{labels[it.id]}</span>
                            <button
                              aria-label="Desagrupar"
                              onClick={async () => {
                                await ungroupSuperset(sessionId, it.superset_group!);
                                await load();
                              }}
                              style={{ border: 0, background: "none", color: "var(--muted)", cursor: "pointer" }}
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ) : (
                          <span className="note">—</span>
                        )}
                      </td>
                      <td style={{ padding: "8px 10px", minWidth: 160 }}><b>{it.exercise_name}</b></td>
                      {isCardio ? (
                        <>
                          <td style={{ padding: "6px" }}><NumCell value={it.duration_min} onChange={(v) => patchItem(it.id, "duration_min", v)} /></td>
                          <td style={{ padding: "6px" }}><NumCell value={it.distance_km} onChange={(v) => patchItem(it.id, "distance_km", v)} /></td>
                          <td style={{ padding: "6px" }}><NumCell value={it.steps_target} onChange={(v) => patchItem(it.id, "steps_target", v)} /></td>
                          <td style={{ padding: "6px", minWidth: 160 }}>
                            <select className="input" style={{ padding: "6px 8px" }} value={it.hr_zone ?? ""} onChange={(e) => patchItem(it.id, "hr_zone", e.target.value)}>
                              {HR_ZONES.map((z) => <option key={z}>{z}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: "6px" }}><NumCell value={it.rest_s} onChange={(v) => patchItem(it.id, "rest_s", v)} /></td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: "6px" }}><NumCell value={it.sets} onChange={(v) => patchItem(it.id, "sets", v)} /></td>
                          <td style={{ padding: "6px", minWidth: 90 }}>
                            <div style={{ display: "flex", gap: 3 }}>
                              <NumCell value={it.reps_min} onChange={(v) => patchItem(it.id, "reps_min", v)} small />
                              <NumCell value={it.reps_max} onChange={(v) => patchItem(it.id, "reps_max", v)} small />
                            </div>
                          </td>
                          <td style={{ padding: "6px" }}><NumCell value={it.load_value} onChange={(v) => patchItem(it.id, "load_value", v)} /></td>
                          <td style={{ padding: "6px" }}><NumCell value={it.rir} onChange={(v) => patchItem(it.id, "rir", v)} /></td>
                          <td style={{ padding: "6px" }}><NumCell value={it.rest_s} onChange={(v) => patchItem(it.id, "rest_s", v)} /></td>
                          <td style={{ padding: "6px" }}>
                            <input className="input" style={{ width: 80, padding: "6px 8px", textAlign: "center" }} value={it.tempo ?? ""} onChange={(e) => patchItem(it.id, "tempo", e.target.value)} />
                          </td>
                        </>
                      )}
                      <td style={{ padding: "8px 10px" }}>
                        <button aria-label="Quitar ejercicio" onClick={() => removeItem(it.id)} style={{ border: 0, background: "none", color: "var(--muted)", cursor: "pointer" }}>
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <div className="panel">
        <div className="hd">
          <h3>Añadir ejercicio</h3>
          <button className="btn ghost" onClick={() => setShowImport(true)}>
            <FileUp size={15} /> Importar rutina
          </button>
        </div>
        <div className="bd">
          <label className="field-label">Tren del cuerpo a entrenar</label>
          <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            {(["all", "Superior", "Inferior", "Full body"] as const).map((b) => (
              <button
                key={b}
                onClick={() => { setBodyFilter(b); setMuscleFilter("all"); }}
                className="btn ghost"
                style={{ padding: "6px 12px", fontSize: 13, background: bodyFilter === b ? "var(--pri)" : "transparent", color: bodyFilter === b ? "#fff" : "var(--pri)" }}
              >
                {b === "all" ? "Todos" : b}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
            <div style={{ flex: "0 1 180px" }}>
              <label className="field-label">Músculo</label>
              <select className="input" value={muscleFilter} onChange={(e) => setMuscleFilter(e.target.value)}>
                <option value="all">Todos</option>
                {muscles
                  .filter((m) => bodyFilter === "all" || bodyRegionOf(m.key) === bodyFilter)
                  .map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
            <div style={{ flex: "1 1 220px" }}>
              <label className="field-label">Buscar ejercicio ({filteredExercises.length} disponibles)</label>
              <input className="input" style={{ marginBottom: 6 }} placeholder="Escribe para buscar" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="input" value={pickExercise} onChange={(e) => setPickExercise(e.target.value)}>
                <option value="">Elige un ejercicio</option>
                {filteredExercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div style={{ flex: "0 1 170px" }}>
              <label className="field-label">Bloque</label>
              <select className="input" value={pickBlock} onChange={(e) => setPickBlock(e.target.value as BlockKind)}>
                {BLOCK_ORDER.map((k) => <option key={k} value={k}>{BLOCK_LABEL[k]}</option>)}
              </select>
            </div>
            <button className="btn" onClick={addExercise}>
              <Plus size={16} /> Añadir a la sesión
            </button>
          </div>
        </div>
      </div>

      {showImport && (
        <ImportRoutineModal
          blocks={blocks}
          exercises={exercises}
          existingCount={items.length}
          onClose={() => setShowImport(false)}
          onImport={async (rows) => {
            const count = await applyImportedRows({ rows, sessionId, blocks, startSortOrder: items.length });
            await load();
            setShowImport(false);
            notify(`${count} ejercicios importados a la rutina. Revísalos y ajusta lo que haga falta.`);
          }}
        />
      )}
    </div>
  );
}

function AutoregulationModal({
  preview,
  sourceWeekLabel,
  targetWeekLabel,
  onClose,
  onConfirm,
}: {
  preview: AutoregulationSuggestion[];
  sourceWeekLabel: number | undefined;
  targetWeekLabel: number;
  onClose: () => void;
  onConfirm: (overrides: Record<string, number>) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(preview.map((p) => [p.workoutExerciseId, String(p.suggestedLoad ?? p.currentLoad ?? "")]))
  );
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    setSaving(true);
    const overrides: Record<string, number> = {};
    for (const p of preview) {
      const v = values[p.workoutExerciseId];
      if (v !== "" && v != null) overrides[p.workoutExerciseId] = Number(v.replace(",", "."));
    }
    await onConfirm(overrides);
    setSaving(false);
  };

  return (
    <Modal title={`Copiar semana ${sourceWeekLabel ?? "?"} → semana ${targetWeekLabel}`} onClose={onClose}>
      <p className="note" style={{ marginBottom: 14 }}>
        Carga sugerida según el RIR real que logró el cliente contra el que prescribiste. Revisá y ajustá lo que haga falta antes de confirmar — los ejercicios sin series registradas usan el incremento estándar de +2,5 kg.
      </p>
      {preview.length === 0 ? (
        <p className="note" style={{ marginBottom: 16 }}>Esta semana no tiene ejercicios con carga para progresar.</p>
      ) : (
        <div style={{ maxHeight: 360, overflowY: "auto", marginBottom: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12 }}>
                <th style={{ padding: "4px 6px" }}>Ejercicio</th>
                <th style={{ padding: "4px 6px" }}>Actual</th>
                <th style={{ padding: "4px 6px" }}>Nueva carga</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((p) => (
                <tr key={p.workoutExerciseId} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "6px" }}>
                    {p.exerciseName}
                    <div className="note" style={{ fontSize: 11.5 }}>{p.reason}</div>
                  </td>
                  <td style={{ padding: "6px" }}>{p.currentLoad ?? "—"} kg</td>
                  <td style={{ padding: "6px" }}>
                    <input
                      className="input"
                      style={{ width: 80, padding: "4px 6px" }}
                      value={values[p.workoutExerciseId] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [p.workoutExerciseId]: e.target.value }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button className="btn" onClick={confirm} disabled={saving}>{saving ? "Copiando…" : `Confirmar y crear semana ${targetWeekLabel}`}</button>
    </Modal>
  );
}

function NumCell({ value, onChange, small }: { value: number | null; onChange: (v: number | null) => void; small?: boolean }) {
  const [text, setText] = useState(value != null ? String(value) : "");
  useEffect(() => setText(value != null ? String(value) : ""), [value]);
  return (
    <input
      className="input"
      style={{ width: small ? 44 : 64, padding: "6px 4px", textAlign: "center" }}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onChange(text === "" ? null : Number(text.replace(",", ".")) || null)}
    />
  );
}
