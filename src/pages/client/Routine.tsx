import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ArrowLeft, Flame } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import Modal from "../../components/ui/Modal";
import Chip from "../../components/ui/Chip";
import { getMyClientId } from "../../services/clients";
import { listWeeks, type ProgramRow, type WeekRow } from "../../services/programs";
import {
  listSessions,
  listSessionBlocks,
  listWorkoutExercises,
  BLOCK_LABEL,
  BLOCK_ORDER,
  DAY_OF_WEEK_LABEL,
  todayDayOfWeek,
  computeWeekStatuses,
  WEEK_STATUS_COLOR,
  WEEK_STATUS_LABEL,
  listSetNotesForExercises,
  type SessionRow,
  type SessionBlockRow,
  type WorkoutExerciseRow,
  type WeekStatus,
  unlockedWeekNumber,
  nextAllowedSession,
} from "../../services/sessions";
import {
  getActiveProgramForClient,
  getOrCreateWorkoutLog,
  listSetLogs,
  upsertSetLog,
  completeWorkout,
  getSessionStatuses,
  getTodayCompletedSessionName,
  getLastPerformance,
  type WorkoutLogRow,
  type SetLogRow,
  type LastPerformance,
} from "../../services/training";
import WellnessForm from "../../components/WellnessForm";
import { getExerciseMediaUrl, listVariationsFor, RELATION_LABEL, type ExerciseVariationRow } from "../../services/exercises";
import Loading from "../../components/ui/Loading";
import { listRecordsForWorkout, describeRecord, type MyRecord } from "../../services/clientHome";
import { formatLoad, loadInputValue, parseLoadToKg, type LoadUnit } from "../../lib/units";
import { getEffectiveGymUnits, getEquipmentNames, makeUnitResolver } from "../../services/units";
import VideoEmbed from "../../components/VideoEmbed";
import { supabase } from "../../lib/supabase";
import SessionPreview from "./SessionPreview";
import { useSearchParams } from "react-router-dom";
import { playRestEnd, playRestTick, unlockRestSound } from "../../lib/restSound";
import RestSoundToggle from "../../components/RestSoundToggle";
import ExportRoutineButton from "../../components/ExportRoutineButton";

const STATUS_LABEL: Record<WorkoutLogRow["status"], string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completada",
  skipped: "Saltada",
};

export default function ClientRoutine() {
  const { notify } = useToast();
  const [clientId, setClientId] = useState<string | null>(null);
  const [program, setProgram] = useState<ProgramRow | null>(null);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  // Plan por semanas: última semana habilitada (la siguiente se abre al terminar la anterior).
  const [unlocked, setUnlocked] = useState<number>(Infinity);
  const [hiddenWeeks, setHiddenWeeks] = useState(0);
  // Orden obligatorio (part4o): la única rutina que se puede empezar ahora.
  const [allowed, setAllowed] = useState<SessionRow | null>(null);
  const [weekStatus, setWeekStatus] = useState<Record<string, WeekStatus>>({});
  const [weekId, setWeekId] = useState("");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [statuses, setStatuses] = useState<Record<string, WorkoutLogRow["status"]>>({});
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [blockedByDailyLimit, setBlockedByDailyLimit] = useState<string | null>(null);
  const [pendingWarning, setPendingWarning] = useState<{ sessionId: string; weekLabel: string } | null>(null);
  // Vista previa de una rutina antes de empezar (y confirmación al empezar).
  const [previewSessionId, setPreviewSessionId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * No bloquea nada — solo avisa si la semana anterior quedó con rutinas sin
   * terminar, y deja que el cliente decida igual. Un aviso, no un candado:
   * la vida real (viajes, una semana saltada a propósito) no siempre sigue
   * el orden prolijo del plan.
   */
  const previousWeekIncompleteLabel = async (currentWeekId: string): Promise<string | null> => {
    const current = weeks.find((w) => w.id === currentWeekId);
    if (!current) return null;
    const prevWeek = weeks.find((w) => w.week_number === current.week_number - 1);
    if (!prevWeek) return null;
    try {
      const prevSessions = await listSessions(prevWeek.id);
      if (prevSessions.length === 0) return null;
      const prevStatuses = await getSessionStatuses(prevSessions.map((s) => s.id));
      const allDone = prevSessions.every((s) => {
        const st = prevStatuses[s.id] ?? "pending";
        return st === "completed" || st === "skipped";
      });
      return allDone ? null : `Semana ${prevWeek.week_number}`;
    } catch {
      return null;
    }
  };

  const startSession = async (sessionId: string) => {
    if (!clientId) return;
    if (!program?.allow_multiple_sessions_per_day) {
      try {
        const doneToday = await getTodayCompletedSessionName(clientId);
        if (doneToday) {
          setBlockedByDailyLimit(doneToday);
          return;
        }
      } catch (e: any) {
        notify(e.message);
        return;
      }
    }
    const incompleteWeek = await previousWeekIncompleteLabel(weekId);
    if (incompleteWeek) {
      setPendingWarning({ sessionId, weekLabel: incompleteWeek });
      return;
    }
    setPendingSessionId(sessionId);
  };

  const loadSessions = async (wId: string) => {
    const ss = await listSessions(wId);
    setSessions(ss);
    // Viene de "Entrenar ahora" del Inicio: abrir esa rutina (vista previa o, si ya estaba empezada, la sesión).
    const wanted = searchParams.get("s");
    if (wanted && ss.some((x) => x.id === wanted)) {
      setSearchParams({}, { replace: true });
      const st0 = await getSessionStatuses([wanted]);
      if ((st0[wanted] ?? "pending") === "in_progress") startSession(wanted);
      else setPreviewSessionId(wanted);
    }
    const st = await getSessionStatuses(ss.map((s) => s.id));
    setStatuses(st);
    const status: WeekStatus = ss.length === 0 ? "empty" : ss.some((s) => (st[s.id] ?? "pending") !== "pending") ? "started" : "planned";
    setWeekStatus((prev) => ({ ...prev, [wId]: status }));
  };

  const init = async () => {
    setLoading(true);
    try {
      const cId = await getMyClientId();
      setClientId(cId);
      if (!cId) {
        setLoading(false);
        return;
      }
      const prog = await getActiveProgramForClient(cId);
      setProgram(prog);
      if (prog) {
        const ws = (await listWeeks(prog.id)).sort((a, b) => a.week_number - b.week_number);
        const upTo = await unlockedWeekNumber(prog.id, (prog as any).plan_mode).catch(() => Infinity);
        setAllowed(await nextAllowedSession(prog as any).catch(() => null));
        setUnlocked(upTo);
        const visible = ws.filter((w) => w.week_number <= upTo);
        setWeeks(visible);
        computeWeekStatuses(visible.map((w) => w.id)).then(setWeekStatus).catch(() => {});
        // Se abre en la última semana habilitada (la que está en curso), no en la primera.
        const startWeek = visible[visible.length - 1]?.id ?? "";
        setWeekId(startWeek);
        if (startWeek) await loadSessions(startWeek);
        setHiddenWeeks(ws.length - visible.length);
      }
    } catch (e: any) {
      notify(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (weekId) loadSessions(weekId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekId]);

  if (pendingSessionId && clientId) {
    return (
      <div className="page" style={{ maxWidth: 520 }}>
        <h1 style={{ marginBottom: 4 }}>Antes de empezar</h1>
        <WellnessForm
          clientId={clientId}
          intro="Un check-in rápido antes de entrenar hoy. Tu entrenador lo va a ver."
          submitLabel="Enviar y empezar a entrenar"
          onSubmitted={() => {
            const sId = pendingSessionId;
            setPendingSessionId(null);
            setActiveSessionId(sId);
          }}
        />
      </div>
    );
  }

  if (previewSessionId && clientId) {
    const ps = sessions.find((x) => x.id === previewSessionId);
    if (ps) {
      const st = (statuses[ps.id] ?? "pending") as "pending" | "in_progress" | "completed" | "skipped";
      return (
        <SessionPreview
          session={ps}
          clientId={clientId}
          status={st}
          onBack={() => setPreviewSessionId(null)}
          onStart={() => {
            setPreviewSessionId(null);
            startSession(ps.id);
          }}
        />
      );
    }
  }

  if (activeSessionId) {
    return (
      <TrainSession
        sessionId={activeSessionId}
        onExit={async () => {
          setActiveSessionId(null);
          // Al terminar, puede habilitarse la semana siguiente: se recalcula todo.
          await init();
        }}
      />
    );
  }

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Mi rutina</h1>
        <ExportRoutineButton
          session={sessions[0] ?? null}
          fixedMode={(program as any)?.plan_mode === "fixed"}
          clientOnly
          label="Descargar en PDF"
        />
      </div>

      {loading ? (
        <Loading />
      ) : !program ? (
        <div className="panel"><div className="bd"><p className="note">Todavía no tienes un programa asignado. Avisa a tu entrenador.</p></div></div>
      ) : (
        <>
          <p className="note" style={{ marginBottom: 14 }}>{program.name}</p>
          {weeks.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
              {weeks.map((w) => {
                const status = weekStatus[w.id] ?? "empty";
                return (
                  <button
                    key={w.id}
                    onClick={() => setWeekId(w.id)}
                    className="btn ghost"
                    title={WEEK_STATUS_LABEL[status]}
                    style={{ padding: "6px 14px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 7, background: w.id === weekId ? "var(--pri)" : "transparent", color: w.id === weekId ? "#fff" : "var(--pri)" }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: WEEK_STATUS_COLOR[status], flex: "none", border: w.id === weekId ? "1px solid rgba(255,255,255,.6)" : "none" }} />
                    Semana {w.week_number}
                  </button>
                );
              })}
            </div>
          )}
          {hiddenWeeks > 0 && Number.isFinite(unlocked) && (
            <p className="note week-lock">
              🔒 La semana {unlocked + 1} se habilita cuando termines todas las rutinas de la semana {unlocked}.
            </p>
          )}

          <div style={{ display: "grid", gap: 12 }}>
            {sessions.map((s) => {
              const status = statuses[s.id] ?? "pending";
              const isToday = s.day_of_week === todayDayOfWeek();
              return (
                <div key={s.id} className="panel" style={isToday ? { borderLeft: "4px solid var(--pri)" } : undefined}>
                  <div className="bd" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <b>{s.name}</b>
                        {isToday && <Chip tone="pri">Hoy</Chip>}
                      </div>
                      <div className="note">
                        {STATUS_LABEL[status]}
                        {s.day_of_week ? ` · ${DAY_OF_WEEK_LABEL[s.day_of_week]}` : ""}
                      </div>
                    </div>
                    {status === "in_progress" ? (
                      <button className="btn" onClick={() => startSession(s.id)}>Continuar</button>
                    ) : status === "completed" ? (
                      <button className="btn ghost" onClick={() => setPreviewSessionId(s.id)}>Completada · Ver</button>
                    ) : status !== "skipped" && allowed && allowed.id !== s.id ? (
                      <span className="order-lock" title="Tu entrenador armó tus rutinas en un orden: hazlas una por una.">
                        🔒 Primero: {allowed.name}
                      </span>
                    ) : (
                      <button className="btn" onClick={() => setPreviewSessionId(s.id)}>Ver y entrenar</button>
                    )}
                  </div>
                </div>
              );
            })}
            {sessions.length === 0 && <p className="note">Esta semana todavía no tiene rutinas armadas.</p>}
          </div>
        </>
      )}

      {blockedByDailyLimit && (
        <Modal title="Ya entrenaste hoy" onClose={() => setBlockedByDailyLimit(null)}>
          <p>
            Ya completaste "{blockedByDailyLimit}" hoy. Tu entrenador no habilitó más de una rutina por día en este programa — si hoy te toca otra, avísale.
          </p>
        </Modal>
      )}

      {pendingWarning && (
        <Modal title="Tienes una semana sin terminar" onClose={() => setPendingWarning(null)}>
          <p style={{ marginBottom: 18 }}>
            Todavía te falta completar rutinas de la {pendingWarning.weekLabel}. ¿Igual quieres entrenar esta ahora?
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="btn ghost" onClick={() => setPendingWarning(null)}>Volver</button>
            <button
              className="btn"
              onClick={() => {
                setPendingSessionId(pendingWarning.sessionId);
                setPendingWarning(null);
              }}
            >
              Entrenar igual
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function TrainSession({ sessionId, onExit, backLabel = "Volver a mi rutina" }: { sessionId: string; onExit: () => void; backLabel?: string }) {
  const { notify } = useToast();
  const [log, setLog] = useState<WorkoutLogRow | null>(null);
  const [blocks, setBlocks] = useState<SessionBlockRow[]>([]);
  const [exercises, setExercises] = useState<WorkoutExerciseRow[]>([]);
  const [setLogs, setSetLogs] = useState<SetLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [rpe, setRpe] = useState("");
  const [comments, setComments] = useState("");
  const [celebration, setCelebration] = useState<MyRecord[] | null>(null);
  // Resumen al terminar: duración, series, reps, volumen y comparación con la última vez.
  const [summary, setSummary] = useState<null | {
    minutes: number;
    sets: number;
    reps: number;
    volumeKg: number;
    prevVolumeKg: number | null;
    exercises: number;
  }>(null);
  const [saving, setSaving] = useState(false);
  const [restTotal, setRestTotal] = useState(0);
  const [restRemaining, setRestRemaining] = useState(0);
  // Guarda el momento real en que termina el descanso, en vez de solo restar de a uno
  // cada segundo — así, si el celular se bloquea o cambias de app durante el descanso
  // (el navegador pausa los conteos en ese caso para ahorrar batería), al volver el
  // cronómetro muestra el tiempo real que pasó, no el tiempo que alcanzó a contar.
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restAnchor, setRestAnchor] = useState<string | null>(null);
  const [lastPerf, setLastPerf] = useState<Record<string, LastPerformance | null>>({});
  const [variations, setVariations] = useState<Record<string, ExerciseVariationRow[]>>({});
  const [setNotesByExercise, setSetNotesByExercise] = useState<Record<string, Record<number, string>>>({});
  // kg o lb para cada ejercicio, según el gimnasio del alumno (ver lib/units.ts).
  const [unitResolver, setUnitResolver] = useState<{ fn: (ex: WorkoutExerciseRow) => LoadUnit }>({ fn: () => "kg" });
  // Rutinas fijas (part4d): cada serie arranca con lo que hizo la última vez.
  const [fixedMode, setFixedMode] = useState(false);
  const { profile: authProfile } = useAuth();

  useEffect(() => {
    if (!restEndsAt) {
      setRestRemaining(0);
      return;
    }
    let last = -1;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((restEndsAt - Date.now()) / 1000));
      setRestRemaining(remaining);
      // Sonido: tic en los últimos 3 segundos y 3 bips al terminar.
      if (remaining !== last && remaining > 0 && remaining <= 3) playRestTick();
      last = remaining;
      if (remaining <= 0) {
        playRestEnd();
        setRestEndsAt(null);
      }
    };
    tick();
    const t = window.setInterval(tick, 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [restEndsAt]);

  const startRest = (seconds: number, anchor: string) => {
    if (!seconds || seconds <= 0) return;
    unlockRestSound(); // viene de un toque: deja listo el audio para cuando termine

    setRestTotal(seconds);
    setRestEndsAt(Date.now() + seconds * 1000);
    setRestAnchor(anchor);
  };

  const load = async () => {
    setLoading(true);
    try {
      const l = await getOrCreateWorkoutLog(sessionId);
      setLog(l);
      const [bl, ex, sl] = await Promise.all([listSessionBlocks(sessionId), listWorkoutExercises(sessionId), listSetLogs(l.id)]);
      setBlocks(bl);
      setExercises(ex);
      setSetLogs(sl);

      // Unidad de cada ejercicio (kg / lb), según dónde entrena el alumno.
      Promise.all([getEffectiveGymUnits(l.client_id, authProfile?.organization_id ?? null), getEquipmentNames()])
        .then(([gym, eq]) => setUnitResolver({ fn: makeUnitResolver(gym, eq) }))
        .catch(() => {});

      supabase
        .from("sessions")
        .select("program_id")
        .eq("id", l.session_id)
        .maybeSingle()
        .then(async ({ data }) => {
          if (!data?.program_id) return;
          const { data: prog } = await supabase.from("programs").select("*").eq("id", data.program_id).maybeSingle();
          setFixedMode((prog as any)?.plan_mode === "fixed");
        });

      const uniqueExerciseIds = [...new Set(ex.map((e) => e.exercise_id))];
      const perfEntries = await Promise.all(
        uniqueExerciseIds.map(async (exId) => [exId, await getLastPerformance(l.client_id, exId, l.id).catch(() => null)] as const)
      );
      setLastPerf(Object.fromEntries(perfEntries));

      const variationEntries = await Promise.all(
        uniqueExerciseIds.map(async (exId) => [exId, await listVariationsFor(exId).catch((e: any) => { notify(`No pudimos cargar las alternativas: ${e.message}`); return []; })] as const)
      );
      setVariations(Object.fromEntries(variationEntries));

      setSetNotesByExercise(await listSetNotesForExercises(ex.map((e) => e.id)).catch(() => ({})));
    } catch (e: any) {
      notify(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const blockByKind = useMemo(() => Object.fromEntries(blocks.map((b) => [b.kind, b])), [blocks]);

  const logFor = (exerciseWorkoutId: string, setNumber: number) => setLogs.find((l) => l.workout_exercise_id === exerciseWorkoutId && l.set_number === setNumber);

  const saveSet = async (ex: WorkoutExerciseRow, setNumber: number, fields: { reps: number; loadKg: number | null; rir: number | null; completed: boolean; loadUnit?: LoadUnit }, opts?: { skipRest?: boolean }) => {
    if (!log) return;
    const existing = logFor(ex.id, setNumber);
    const justCompleted = fields.completed && !existing?.completed;
    try {
      const saved = await upsertSetLog({
        existingId: existing?.id,
        workoutLogId: log.id,
        workoutExerciseId: ex.id,
        exerciseId: ex.exercise_id,
        setNumber,
        ...fields,
      });
      setSetLogs((sls) => (existing ? sls.map((s) => (s.id === saved.id ? saved : s)) : [...sls, saved]));
      if (justCompleted && ex.rest_s && !opts?.skipRest) startRest(ex.rest_s, `${ex.id}:${setNumber}`);
    } catch (e: any) {
      notify(e.message);
    }
  };

  const finish = async () => {
    if (!log) return;
    setSaving(true);
    try {
      await completeWorkout({ workoutLogId: log.id, sessionRpe: rpe ? Number(rpe) : null, comments, startedAt: log.started_at });
      // Resumen de la sesión (con los datos ya cargados en pantalla; por dentro las cargas están en kg).
      const done = setLogs.filter((x) => x.completed);
      const doneExercises = [...new Set(done.map((x) => x.exercise_id))];
      const volumeKg = done.reduce((t, x) => t + (Number(x.load_kg) || 0) * (x.reps || 0), 0);
      // La última vez, en los mismos ejercicios que hizo hoy (para comparar parejo).
      let prevVolumeKg: number | null = 0;
      let anyPrev = false;
      for (const exId of doneExercises) {
        const lp = lastPerf[exId];
        if (!lp) continue;
        anyPrev = true;
        for (const st of Object.values(lp.bySet)) prevVolumeKg += (Number(st.loadKg) || 0) * (st.reps || 0);
      }
      if (!anyPrev) prevVolumeKg = null;
      setSummary({
        minutes: log.started_at ? Math.max(1, Math.round((Date.now() - new Date(log.started_at).getTime()) / 60000)) : 0,
        sets: done.length,
        reps: done.reduce((t, x) => t + (x.reps || 0), 0),
        volumeKg,
        prevVolumeKg,
        exercises: doneExercises.length,
      });
      // ¿Batió algún récord en esta sesión? Se celebra en el mismo resumen.
      const recs = await listRecordsForWorkout(log.id).catch((): MyRecord[] => []);
      setCelebration(recs);
    } catch (e: any) {
      notify(e.message);
    }
    setSaving(false);
  };

  if (summary) {
    const recs = celebration ?? [];
    const fmt = (n: number) => Math.round(n).toLocaleString("es");
    const delta = summary.prevVolumeKg && summary.prevVolumeKg > 0 ? Math.round(((summary.volumeKg - summary.prevVolumeKg) / summary.prevVolumeKg) * 100) : null;
    return (
      <div className="page">
        <div className={`panel${recs.length ? " celebrate" : ""}`}>
          <div className="bd" style={{ padding: "26px 22px" }}>
            {recs.length > 0 && <div className="burst">🏆</div>}
            <h2 style={{ margin: "6px 0 4px" }}>
              {recs.length === 0 ? "¡Sesión completada!" : recs.length === 1 ? "¡Nuevo récord!" : `¡${recs.length} récords nuevos!`}
            </h2>
            <p className="note" style={{ marginTop: 0 }}>Así te fue hoy:</p>
            <div className="session-summary">
              {summary.minutes > 0 && <div><b>{summary.minutes}</b><span>minutos</span></div>}
              <div><b>{summary.sets}</b><span>{summary.sets === 1 ? "serie" : "series"}</span></div>
              <div><b>{fmt(summary.reps)}</b><span>repeticiones</span></div>
              <div>
                <b>{fmt(summary.volumeKg)} kg</b>
                <span>levantados en total</span>
                {delta !== null && (
                  <em className={delta >= 0 ? "up" : "down"}>
                    {delta === 0 ? "igual que la última vez" : `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta)}% vs la última vez`}
                  </em>
                )}
              </div>
            </div>
            {recs.length > 0 && <p className="note" style={{ margin: "14px 0 0" }}>Hoy superaste tu mejor marca en:</p>}
            <div style={{ display: "grid", gap: 10, textAlign: "left", margin: recs.length ? "10px 0 20px" : "18px 0 0" }}>
              {recs.map((r) => (
                <div key={r.id} style={{ background: "var(--ok-soft)", borderRadius: 9, padding: "10px 12px" }}>
                  <b>{r.exercise_name}</b>
                  <div className="note" style={{ fontSize: 13 }}>{describeRecord(r)}</div>
                </div>
              ))}
            </div>
            <button className="btn" style={{ width: "100%", marginTop: recs.length ? 0 : 18 }} onClick={onExit}>{recs.length ? "¡Genial!" : "Listo"}</button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <div className="page"><Loading /></div>;

  return (
    <div className="page">
      <button onClick={onExit} style={{ border: 0, background: "none", color: "var(--pri)", padding: 0, marginBottom: 14, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
        <ArrowLeft size={16} /> {backLabel}
      </button>

      {finishing ? (
        <div className="panel" style={{ maxWidth: 420 }}>
          <div className="hd"><h3>¿Cómo sentiste la sesión?</h3></div>
          <div className="bd">
            <label className="field-label">Esfuerzo percibido (0 a 10)</label>
            <select className="input" style={{ marginBottom: 14 }} value={rpe} onChange={(e) => setRpe(e.target.value)}>
              <option value="">Sin indicar</option>
              {Array.from({ length: 11 }, (_, i) => <option key={i} value={i}>{i}</option>)}
            </select>
            <label className="field-label">Comentarios (opcional)</label>
            <textarea className="input" style={{ minHeight: 70, marginBottom: 16 }} value={comments} onChange={(e) => setComments(e.target.value)} placeholder="¿Cómo te sentiste? ¿Alguna molestia?" />
            <button className="btn" onClick={finish} disabled={saving}>{saving ? "Guardando…" : "Finalizar sesión"}</button>
          </div>
        </div>
      ) : (
        <>
          {BLOCK_ORDER.map((kind) => {
            const block = blockByKind[kind];
            const rows = exercises.filter((e) => block && e.block_id === block.id);
            if (!rows.length) return null;
            const groups = groupBySuperset(rows);
            return (
              <div key={kind} style={{ marginBottom: 18 }}>
                <h3 style={{ marginBottom: 10 }}>{BLOCK_LABEL[kind]}</h3>
                {groups.map((g) =>
                  g.length > 1 && g.every((ex) => !isCardioExercise(ex)) ? (
                    <SupersetTrainer
                      key={g[0].superset_group}
                      exercises={g}
                      logFor={logFor}
                      onSaveSet={saveSet}
                      restAnchor={restAnchor}
                      restRemaining={restRemaining}
                      restTotal={restTotal}
                      onAddRestTime={() => setRestEndsAt((e) => (e ? e + 15000 : e))}
                      onSkipRest={() => setRestEndsAt(null)}
                      lastPerf={lastPerf}
                      variations={variations}
                      setNotesByExercise={setNotesByExercise}
                      unitFor={unitResolver.fn}
                      onStartRest={startRest}
                      fixedMode={fixedMode}
                    />
                  ) : (
                    g.map((ex) => (
                      <ExerciseTrainer
                        key={ex.id}
                        ex={ex}
                        logFor={logFor}
                        onSaveSet={saveSet}
                        restAnchor={restAnchor}
                        restRemaining={restRemaining}
                        restTotal={restTotal}
                        onAddRestTime={() => setRestEndsAt((e) => (e ? e + 15000 : e))}
                        onSkipRest={() => setRestEndsAt(null)}
                        lastPerf={lastPerf[ex.exercise_id] ?? null}
                        variations={variations[ex.exercise_id] ?? []}
                        setNotes={setNotesByExercise[ex.id] ?? {}}
                        unit={unitResolver.fn(ex)}
                        fixedMode={fixedMode}
                      />
                    ))
                  )
                )}
              </div>
            );
          })}
          {exercises.length === 0 && <p className="note" style={{ marginBottom: 18 }}>Esta rutina todavía no tiene ejercicios cargados.</p>}
          <button className="btn" style={{ width: "100%", justifyContent: "center" }} onClick={() => setFinishing(true)}>
            Terminar entrenamiento
          </button>
        </>
      )}
    </div>
  );
}

function RestTimer({ remaining, total, onAddTime, onSkip }: { remaining: number; total: number; onAddTime: () => void; onSkip: () => void }) {
  return (
    <div style={{ background: "var(--nav)", color: "#fff", borderRadius: 10, padding: "10px 14px", marginTop: 8, marginBottom: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 700 }}>
          Descanso: {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <RestSoundToggle />
          <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 12.5, color: "#fff", borderColor: "rgba(255,255,255,.4)" }} onClick={onAddTime}>
            +15 s
          </button>
          <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 12.5, color: "#fff", borderColor: "rgba(255,255,255,.4)" }} onClick={onSkip}>
            Saltar
          </button>
        </div>
      </div>
      <div style={{ height: 5, background: "rgba(255,255,255,.2)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(remaining / Math.max(1, total)) * 100}%`, background: "#8FA6F5", transition: "width 1s linear" }} />
      </div>
    </div>
  );
}

function ExerciseMedia({
  mediaPath,
  mediaType,
  label,
  videoUrl,
  exerciseId,
}: {
  mediaPath: string | null;
  mediaType: "image" | "video" | null;
  label?: string;
  /** Video de YouTube o Vimeo: tiene prioridad sobre la foto o video subido. */
  videoUrl?: string | null;
  exerciseId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  if (!mediaPath && !videoUrl) return null;

  const toggle = async () => {
    if (!open && !videoUrl && !url && mediaPath) {
      try {
        setUrl(await getExerciseMediaUrl(mediaPath));
      } catch {
        return;
      }
    }
    setOpen((o) => !o);
  };

  return (
    <div style={{ marginBottom: 8, width: open ? "100%" : undefined }}>
      <button type="button" className="btn ghost" style={{ padding: "4px 10px", fontSize: 12.5 }} onClick={toggle}>
        {open ? `Ocultar${label ? ` — ${label}` : ""}` : `▶ Ver cómo se hace${label ? ` — ${label}` : ""}`}
      </button>
      {open && videoUrl && <VideoEmbed url={videoUrl} exerciseId={exerciseId} />}
      {open && !videoUrl && url && (
        mediaType === "video" ? (
          <video src={url} controls playsInline style={{ width: "100%", maxHeight: 260, borderRadius: 8, background: "#000", marginTop: 8 }} />
        ) : (
          <img src={url} alt="" style={{ width: "100%", maxHeight: 260, objectFit: "contain", borderRadius: 8, marginTop: 8 }} />
        )
      )}
    </div>
  );
}

function VariationsNote({ items }: { items: ExerciseVariationRow[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <button type="button" className="btn ghost" style={{ padding: "4px 10px", fontSize: 12.5 }} onClick={() => setOpen((o) => !o)}>
        {open ? "Ocultar alternativas" : "Ver alternativas"}
      </button>
      {open && (
        <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
          {items.map((v) => (
            <p key={v.id} className="note" style={{ margin: 0 }}>
              <b style={{ color: "var(--text)" }}>{RELATION_LABEL[v.relation]}:</b> {v.related_exercise_name}
              {v.notes ? ` — ${v.notes}` : ""}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function LastPerformanceNote({ perf }: { perf: LastPerformance | null }) {
  if (!perf) return null;
  const sets = Object.entries(perf.bySet).sort(([a], [b]) => Number(a) - Number(b));
  return (
    <p className="note" style={{ marginBottom: 8 }}>
      Última vez ({new Date(perf.date).toLocaleDateString("es")}): {sets.map(([n, s]) => `S${n}: ${s.loadKg != null ? formatLoad(s.loadKg, s.unit) : "—"} × ${s.reps}`).join(" · ")}
    </p>
  );
}

function isCardioExercise(ex: WorkoutExerciseRow): boolean {
  return ex.duration_min != null || ex.distance_km != null || ex.steps_target != null;
}

/** Junta los ejercicios de un mismo bloque en grupos: los que comparten superset_group van juntos (biserie/triserie/serie gigante), el resto queda solo en su propio grupo. Conserva el orden original. */
function groupBySuperset(rows: WorkoutExerciseRow[]): WorkoutExerciseRow[][] {
  const groups: WorkoutExerciseRow[][] = [];
  const seen = new Set<number>();
  for (const ex of rows) {
    if (ex.superset_group != null) {
      if (seen.has(ex.superset_group)) continue;
      seen.add(ex.superset_group);
      groups.push(rows.filter((r) => r.superset_group === ex.superset_group));
    } else {
      groups.push([ex]);
    }
  }
  return groups;
}

const SUPERSET_LETTERS = "ABCDEFGH";

function SupersetTrainer({
  exercises,
  logFor,
  onSaveSet,
  restAnchor,
  restRemaining,
  restTotal,
  onAddRestTime,
  onSkipRest,
  lastPerf,
  variations,
  setNotesByExercise,
  unitFor,
  onStartRest,
  fixedMode = false,
}: {
  exercises: WorkoutExerciseRow[];
  logFor: (workoutExerciseId: string, setNumber: number) => SetLogRow | undefined;
  onSaveSet: (ex: WorkoutExerciseRow, setNumber: number, fields: { reps: number; loadKg: number | null; rir: number | null; completed: boolean; loadUnit?: LoadUnit }, opts?: { skipRest?: boolean }) => Promise<void> | void;
  restAnchor: string | null;
  restRemaining: number;
  restTotal: number;
  onAddRestTime: () => void;
  onSkipRest: () => void;
  lastPerf: Record<string, LastPerformance | null>;
  variations: Record<string, ExerciseVariationRow[]>;
  setNotesByExercise: Record<string, Record<number, string>>;
  unitFor: (ex: WorkoutExerciseRow) => LoadUnit;
  onStartRest: (seconds: number, anchor: string) => void;
  fixedMode?: boolean;
}) {
  // Lo que está escrito en cada ejercicio de cada ronda (reps, carga, RIR),
  // para guardarlo todo junto al tocar "Ronda realizada".
  const getters = useRef<Record<string, () => Omit<{ reps: number; loadKg: number | null; rir: number | null; completed: boolean; loadUnit?: LoadUnit }, "completed">>>({});
  const label = exercises.length === 2 ? "Biserie" : exercises.length === 3 ? "Triserie" : "Serie gigante";
  const maxSets = Math.max(...exercises.map((ex) => ex.sets ?? 3));
  const rounds = Array.from({ length: maxSets }, (_, i) => i + 1);

  return (
    <div className="panel" style={{ marginBottom: 10, borderLeft: "4px solid var(--pri)" }}>
      <div className="hd">
        <h3 style={{ fontSize: 16 }}>
          {label}: {exercises.map((ex) => ex.exercise_name).join(" + ")}
        </h3>
      </div>
      <div className="bd">
        {exercises.some((ex) => ex.media_path || ex.exercise_video_url) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {exercises.map((ex, i) => (
              <ExerciseMedia key={ex.id} mediaPath={ex.media_path} mediaType={ex.media_type} videoUrl={ex.exercise_video_url} exerciseId={ex.exercise_id} label={`${SUPERSET_LETTERS[i]} — ${ex.exercise_name}`} />
            ))}
          </div>
        )}
        {exercises.map((ex) => (
          <div key={ex.id}>
            <LastPerformanceNote perf={lastPerf[ex.exercise_id] ?? null} />
            <VariationsNote items={variations[ex.exercise_id] ?? []} />
          </div>
        ))}
        <p className="note" style={{ marginBottom: 14 }}>
          Haz una serie de cada ejercicio, en orden, sin descansar entre ellos. Al terminar los {exercises.length}, toca "Ronda
          realizada": el descanso empieza recién ahí.
        </p>
        {rounds.map((roundNumber) => {
          const showRestHere = restRemaining > 0 && exercises.some((ex) => restAnchor === `${ex.id}:${roundNumber}`);
          return (
            <div key={roundNumber} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: roundNumber < rounds.length ? "1px dashed var(--line)" : "none" }}>
              <div className="note" style={{ marginBottom: 8, fontWeight: 600 }}>Ronda {roundNumber}</div>
              <div style={{ display: "grid", gap: 8 }}>
                {exercises.map((ex, i) => {
                  if (roundNumber > (ex.sets ?? 3)) return null;
                  const existing = logFor(ex.id, roundNumber);
                  const repsTarget = ex.reps_min && ex.reps_max ? `${ex.reps_min}–${ex.reps_max}` : ex.reps_min ?? ex.reps_max ?? "—";
                  const note = setNotesByExercise[ex.id]?.[roundNumber];
                  return (
                    <div key={ex.id} style={{ display: "grid", gap: 6 }}>
                      {note && <SetNoteBanner note={note} />}
                      <div className="complete-transition" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: existing?.completed ? "var(--ok-soft)" : "var(--bg)", borderRadius: 8, padding: 8 }}>
                        <span style={{ minWidth: 26, fontWeight: 700, color: "var(--pri)" }}>{SUPERSET_LETTERS[i]}{roundNumber}</span>
                        <span style={{ flex: 1, minWidth: 120 }}>{ex.exercise_name}</span>
                        <span className="note" style={{ fontSize: 12.5 }}>Obj: {repsTarget}{ex.load_value ? ` @ ${formatLoad(ex.load_value, unitFor(ex))}` : ""}</span>
                        <MiniSetInputs
                          key={`${ex.id}-${roundNumber}-${unitFor(ex)}-${fixedMode && lastPerf[ex.exercise_id] ? "p" : "n"}`}
                          inRound
                          register={(fn) => {
                            getters.current[`${ex.id}:${roundNumber}`] = fn;
                          }}
                          exUnit={unitFor(ex)}
                          defaultReps={ex.reps_max ?? ex.reps_min ?? 0}
                          defaultLoad={prefillLoad(ex.load_value, lastPerf[ex.exercise_id], roundNumber, fixedMode)}
                          defaultRir={ex.rir}
                          existing={existing}
                          onSave={(fields) => onSaveSet(ex, roundNumber, fields)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {(() => {
                const inRound = exercises.filter((ex) => roundNumber <= (ex.sets ?? 3));
                const roundDone = inRound.length > 0 && inRound.every((ex) => logFor(ex.id, roundNumber)?.completed);
                const toggleRound = async () => {
                  const completed = !roundDone;
                  // Se guardan los ejercicios de la ronda juntos y el descanso arranca una sola vez.
                  for (const ex of inRound) {
                    const values = getters.current[`${ex.id}:${roundNumber}`]?.();
                    if (!values) continue;
                    await onSaveSet(ex, roundNumber, { ...values, completed }, { skipRest: true });
                  }
                  if (completed) {
                    const rest = Math.max(0, ...inRound.map((ex) => ex.rest_s ?? 0));
                    const last = inRound[inRound.length - 1];
                    if (rest > 0 && last) onStartRest(rest, `${last.id}:${roundNumber}`);
                  }
                };
                return (
                  <button
                    type="button"
                    className={`btn round-done complete-transition${roundDone ? " done" : ""}`}
                    onClick={toggleRound}
                  >
                    <Check size={16} className={roundDone ? "check-pop" : undefined} />
                    {roundDone ? `Ronda ${roundNumber} realizada` : `Marcar ronda ${roundNumber} como realizada`}
                  </button>
                );
              })()}
              {showRestHere && <RestTimer remaining={restRemaining} total={restTotal} onAddTime={onAddRestTime} onSkip={onSkipRest} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Carga con la que arranca una serie: en rutinas fijas, lo que el alumno hizo
 * la última vez en esa serie (o en la última serie que tenga); si no, la que
 * indicó el entrenador.
 */
function prefillLoad(prescribed: number | null, perf: LastPerformance | null | undefined, setNumber: number, fixedMode: boolean): number | null {
  if (!fixedMode || !perf) return prescribed;
  const same = perf.bySet[setNumber]?.loadKg;
  if (same != null) return same;
  const sets = Object.keys(perf.bySet).map(Number).sort((a, b) => b - a);
  for (const n of sets) {
    const v = perf.bySet[n]?.loadKg;
    if (v != null) return v;
  }
  return prescribed;
}

function MiniSetInputs({
  inRound,
  register,
  exUnit,
  defaultReps,
  defaultLoad,
  defaultRir,
  existing,
  onSave,
}: {
  exUnit: LoadUnit;
  defaultReps: number;
  defaultLoad: number | null;
  defaultRir: number | null;
  existing: SetLogRow | undefined;
  onSave: (fields: { reps: number; loadKg: number | null; rir: number | null; completed: boolean; loadUnit?: LoadUnit }) => void;
  /** Dentro de una biserie / serie gigante: sin botón ✓ propio (lo marca "Ronda realizada"). */
  inRound?: boolean;
  register?: (getValues: () => Omit<{ reps: number; loadKg: number | null; rir: number | null; completed: boolean; loadUnit?: LoadUnit }, "completed">) => void;
}) {
  const [unit, setUnit] = useState<LoadUnit>(existing?.load_unit ?? exUnit);
  const [reps, setReps] = useState(String(existing?.reps ?? defaultReps ?? ""));
  const [load, setLoad] = useState(loadInputValue(existing?.load_kg ?? defaultLoad, existing?.load_unit ?? exUnit));
  const [rir, setRir] = useState(existing?.rir != null ? String(existing.rir) : defaultRir != null ? String(defaultRir) : "");
  const completed = existing?.completed ?? false;

  // La ronda lee lo escrito acá al tocar "Ronda realizada".
  register?.(() => ({ reps: Number(reps) || 0, loadKg: parseLoadToKg(load, unit), rir: rir === "" ? null : Number(rir.replace(",", ".")) || 0, loadUnit: unit }));
  // En una ronda, la serie se guarda al tocar "Ronda realizada"; antes, solo
  // se guarda al salir de un campo si ya estaba guardada (para corregirla).
  const blurCommit = () => {
    if (!inRound || existing) commit();
  };

  const commit = (over?: Partial<{ completed: boolean; unit: LoadUnit; load: string }>) => {
    const u = over?.unit ?? unit;
    const l = over?.load ?? load;
    onSave({
      reps: Number(reps) || 0,
      loadKg: parseLoadToKg(l, u), // siempre se guarda en kg
      rir: rir === "" ? null : Number(rir.replace(",", ".")) || 0,
      completed: over?.completed ?? completed,
      loadUnit: u,
    });
  };

  // Cambiar kg ↔ lb convierte lo que está escrito (mismo peso, otra unidad).
  const toggleUnit = () => {
    const next: LoadUnit = unit === "kg" ? "lb" : "kg";
    const kg = parseLoadToKg(load, unit);
    const nextLoad = kg == null ? "" : loadInputValue(kg, next);
    setUnit(next);
    setLoad(nextLoad);
    if (existing) commit({ unit: next, load: nextLoad });
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <input className="input" style={{ width: 50, padding: "5px 4px", textAlign: "center" }} value={reps} onChange={(e) => setReps(e.target.value)} onBlur={blurCommit} aria-label="Reps" />
      <input className="input" inputMode="decimal" style={{ width: 55, padding: "5px 4px", textAlign: "center" }} value={load} onChange={(e) => setLoad(e.target.value)} onBlur={blurCommit} aria-label={`Carga en ${unit}`} />
      <button type="button" className="unit-toggle" onClick={toggleUnit} title="Cambiar entre kg y libras">{unit}</button>
      <input className="input" style={{ width: 45, padding: "5px 4px", textAlign: "center" }} value={rir} onChange={(e) => setRir(e.target.value)} onBlur={blurCommit} aria-label="RIR" />
      {!inRound && (
        <button
          className="btn ghost complete-transition"
          style={{ padding: "4px 8px", fontSize: 12.5, background: completed ? "var(--ok-soft)" : undefined }}
          onClick={() => commit({ completed: !completed })}
        >
          <Check size={13} className={completed ? "check-pop" : undefined} />
        </button>
      )}
    </div>
  );
}

function ExerciseTrainer({
  ex,
  logFor,
  onSaveSet,
  restAnchor,
  restRemaining,
  restTotal,
  onAddRestTime,
  onSkipRest,
  lastPerf,
  variations,
  setNotes,
  unit,
  fixedMode = false,
}: {
  ex: WorkoutExerciseRow;
  logFor: (workoutExerciseId: string, setNumber: number) => SetLogRow | undefined;
  onSaveSet: (ex: WorkoutExerciseRow, setNumber: number, fields: { reps: number; loadKg: number | null; rir: number | null; completed: boolean; loadUnit?: LoadUnit }) => void;
  restAnchor: string | null;
  restRemaining: number;
  restTotal: number;
  onAddRestTime: () => void;
  onSkipRest: () => void;
  lastPerf: LastPerformance | null;
  variations: ExerciseVariationRow[];
  setNotes: Record<number, string>;
  unit: LoadUnit;
  fixedMode?: boolean;
}) {
  const showRestHere = restRemaining > 0 && restAnchor != null && restAnchor.startsWith(`${ex.id}:`);
  const isCardio = ex.duration_min != null || ex.distance_km != null || ex.steps_target != null;

  if (isCardio) {
    const existing = logFor(ex.id, 1);
    return (
      <div className="panel" style={{ marginBottom: 10 }}>
        <div className="bd" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <b>{ex.exercise_name}</b>
            <div className="note">
              {ex.duration_min ? `${ex.duration_min} min` : null}
              {ex.distance_km ? ` · ${ex.distance_km} km` : null}
              {ex.steps_target ? ` · ${ex.steps_target} pasos` : null}
              {ex.hr_zone ? ` · ${ex.hr_zone}` : null}
            </div>
          </div>
          <button
            className="btn ghost complete-transition"
            style={{ background: existing?.completed ? "var(--ok-soft)" : undefined }}
            onClick={() => onSaveSet(ex, 1, { reps: 0, loadKg: null, rir: null, completed: !existing?.completed })}
          >
            <Check size={14} className={existing?.completed ? "check-pop" : undefined} /> {existing?.completed ? "Hecho" : "Marcar hecho"}
          </button>
        </div>
        <div className="bd" style={{ paddingTop: 0 }}>
          <ExerciseMedia mediaPath={ex.media_path} mediaType={ex.media_type} videoUrl={ex.exercise_video_url} exerciseId={ex.exercise_id} />
          <LastPerformanceNote perf={lastPerf} />
          <VariationsNote items={variations} />
        </div>
        {showRestHere && <RestTimer remaining={restRemaining} total={restTotal} onAddTime={onAddRestTime} onSkip={onSkipRest} />}
      </div>
    );
  }

  const sets = ex.sets ?? 3;
  const repsTarget = ex.reps_min && ex.reps_max ? `${ex.reps_min}–${ex.reps_max}` : ex.reps_min ?? ex.reps_max ?? "—";

  return (
    <div className="panel" style={{ marginBottom: 10 }}>
      <div className="hd">
        <h3 style={{ fontSize: 16 }}>{ex.exercise_name}</h3>
        <span className="note">
          Objetivo: {sets}×{repsTarget}{ex.load_value ? ` @ ${formatLoad(ex.load_value, unit)}` : ""}{ex.rir != null ? ` · RIR ${ex.rir}` : ""}
          {ex.rest_s ? ` · Descanso ${ex.rest_s}s` : ""}{ex.tempo ? ` · Tempo ${ex.tempo}` : ""}
        </span>
      </div>
      <div className="bd" style={{ paddingBottom: 0 }}>
        <ExerciseMedia mediaPath={ex.media_path} mediaType={ex.media_type} videoUrl={ex.exercise_video_url} exerciseId={ex.exercise_id} />
        <LastPerformanceNote perf={lastPerf} />
        <VariationsNote items={variations} />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12.5 }}>
              <th style={{ padding: "6px 10px" }}>Serie</th>
              <th style={{ padding: "6px 10px" }}>Reps</th>
              <th style={{ padding: "6px 10px" }}>Carga</th>
              <th style={{ padding: "6px 10px" }}>RIR</th>
              <th style={{ padding: "6px 10px" }} />
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: sets }, (_, i) => i + 1).map((setNumber) => {
              const existing = logFor(ex.id, setNumber);
              return (
                <SetRow
                  key={`${setNumber}-${unit}-${fixedMode && lastPerf ? "p" : "n"}`}
                  exUnit={unit}
                  setNumber={setNumber}
                  defaultReps={ex.reps_max ?? ex.reps_min ?? 0}
                  defaultLoad={prefillLoad(ex.load_value, lastPerf, setNumber, fixedMode)}
                  defaultRir={ex.rir}
                  existing={existing}
                  onSave={(fields) => onSaveSet(ex, setNumber, fields)}
                  note={setNotes?.[setNumber]}
                />
              );
            })}
          </tbody>
        </table>
      </div>
      {showRestHere && <RestTimer remaining={restRemaining} total={restTotal} onAddTime={onAddRestTime} onSkip={onSkipRest} />}
    </div>
  );
}

function SetNoteBanner({ note }: { note: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        background: "var(--warn-soft)",
        color: "var(--warn)",
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      <Flame size={15} style={{ flex: "none", marginTop: 1 }} />
      <span>{note}</span>
    </div>
  );
}

function SetRow({
  exUnit,
  setNumber,
  defaultReps,
  defaultLoad,
  defaultRir,
  existing,
  onSave,
  note,
}: {
  exUnit: LoadUnit;
  setNumber: number;
  defaultReps: number;
  defaultLoad: number | null;
  defaultRir: number | null;
  existing: SetLogRow | undefined;
  onSave: (fields: { reps: number; loadKg: number | null; rir: number | null; completed: boolean; loadUnit?: LoadUnit }) => void;
  note?: string;
}) {
  const [unit, setUnit] = useState<LoadUnit>(existing?.load_unit ?? exUnit);
  const [reps, setReps] = useState(String(existing?.reps ?? defaultReps ?? ""));
  const [load, setLoad] = useState(loadInputValue(existing?.load_kg ?? defaultLoad, existing?.load_unit ?? exUnit));
  const [rir, setRir] = useState(existing?.rir != null ? String(existing.rir) : defaultRir != null ? String(defaultRir) : "");
  const completed = existing?.completed ?? false;

  const commit = (over?: Partial<{ completed: boolean; unit: LoadUnit; load: string }>) => {
    const u = over?.unit ?? unit;
    const l = over?.load ?? load;
    onSave({
      reps: Number(reps) || 0,
      loadKg: parseLoadToKg(l, u), // siempre se guarda en kg
      rir: rir === "" ? null : Number(rir.replace(",", ".")) || 0,
      completed: over?.completed ?? completed,
      loadUnit: u,
    });
  };

  // Cambiar kg ↔ lb convierte lo que está escrito (mismo peso, otra unidad).
  const toggleUnit = () => {
    const next: LoadUnit = unit === "kg" ? "lb" : "kg";
    const kg = parseLoadToKg(load, unit);
    const nextLoad = kg == null ? "" : loadInputValue(kg, next);
    setUnit(next);
    setLoad(nextLoad);
    if (existing) commit({ unit: next, load: nextLoad });
  };

  return (
    <>
      {note && (
        <tr>
          <td colSpan={5} style={{ padding: "4px 10px" }}>
            <SetNoteBanner note={note} />
          </td>
        </tr>
      )}
      <tr className="complete-transition" style={{ borderTop: "1px solid var(--line)", background: completed ? "var(--ok-soft)" : undefined }}>
      <td style={{ padding: "6px 10px" }}>{setNumber}</td>
      <td style={{ padding: "6px" }}>
        <input className="input" style={{ width: 60, padding: "6px 4px", textAlign: "center" }} value={reps} onChange={(e) => setReps(e.target.value)} onBlur={() => commit()} />
      </td>
      <td style={{ padding: "6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input className="input" inputMode="decimal" style={{ width: 70, padding: "6px 4px", textAlign: "center" }} value={load} onChange={(e) => setLoad(e.target.value)} onBlur={() => commit()} aria-label={`Carga en ${unit}`} />
          <button type="button" className="unit-toggle" onClick={toggleUnit} title="Cambiar entre kg y libras">{unit}</button>
        </div>
      </td>
      <td style={{ padding: "6px" }}>
        <input className="input" style={{ width: 50, padding: "6px 4px", textAlign: "center" }} value={rir} onChange={(e) => setRir(e.target.value)} onBlur={() => commit()} />
      </td>
      <td style={{ padding: "6px 10px" }}>
        <button
          className="btn ghost complete-transition"
          style={{ padding: "5px 10px", fontSize: 13, background: completed ? "var(--ok-soft)" : undefined }}
          onClick={() => commit({ completed: !completed })}
        >
          <Check size={13} className={completed ? "check-pop" : undefined} /> {completed ? "Hecha" : "Marcar"}
        </button>
      </td>
      </tr>
    </>
  );
}
