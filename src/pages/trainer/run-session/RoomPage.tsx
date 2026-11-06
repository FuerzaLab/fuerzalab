import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import Loading from "../../../components/ui/Loading";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import { listClients, type ClientRow } from "../../../services/clients";
import {
  getTodaysSessionForClient,
  listSessions,
  listSessionBlocks,
  listWorkoutExercises,
  type SessionRow,
  type WorkoutExerciseRow,
} from "../../../services/sessions";
import {
  completeWorkout,
  getActiveProgramForClient,
  getSessionStatuses,
  getLastPerformance,
  getOrCreateWorkoutLog,
  listSetLogs,
  upsertSetLog,
  type LastPerformance,
  type SetLogRow,
  type WorkoutLogRow,
} from "../../../services/training";
import { getTodayLog, wellnessScore, wellnessSemaforo, type WellnessLogRow } from "../../../services/wellness";
import { getEffectiveGymUnits, getEquipmentNames, makeUnitResolver } from "../../../services/units";
import { formatLoad, fromKg, toKg, type LoadUnit } from "../../../lib/units";
import { supabase } from "../../../lib/supabase";
import { listWeeks } from "../../../services/programs";
import { listTemplateSessions, listWorkoutTemplates } from "../../../services/templates";
import { createGroupSession, type GroupSource } from "../../../services/groupClass";
import { paths } from "../../../routes/paths";
import { playRestEnd, playRestTick, unlockRestSound } from "../../../lib/restSound";
import RestSoundToggle from "../../../components/RestSoundToggle";

/**
 * Sala: el entrenador acompaña a varios alumnos a la vez, cada uno con la
 * rutina que le toca hoy. Una tarjeta por alumno con su ejercicio y serie
 * actuales, su descanso y su bienestar. Registra exactamente lo mismo que
 * "Entrenar con cliente": al terminar, cada uno tiene su sesión, sus series y
 * sus récords. (Segunda entrega: "Misma rutina para todos".)
 */

interface Member {
  client: ClientRow;
  session: SessionRow;
  log: WorkoutLogRow;
  /** Clase grupal: la carga arranca con la que usó la última vez (cada uno la suya). */
  group?: boolean;
}
type Candidate = {
  client: ClientRow;
  today: { session: SessionRow; status: string } | null;
  /** Sin rutina hoy: las rutinas de esta semana que todavía no hizo, para elegir una. */
  options: SessionRow[];
};

/** Rutinas de "esta semana" que el alumno todavía no hizo (por fecha si el programa la tiene; si no, la primera semana con rutinas pendientes). */
async function pendingThisWeek(clientId: string): Promise<SessionRow[]> {
  const program = await getActiveProgramForClient(clientId);
  if (!program) return [];
  const weeks = (await listWeeks(program.id)).sort((a, b) => a.week_number - b.week_number);
  if (!weeks.length) return [];
  const pendingOf = async (weekId: string) => {
    const ss = await listSessions(weekId);
    const st = await getSessionStatuses(ss.map((x) => x.id));
    return ss.filter((x) => st[x.id] !== "completed" && st[x.id] !== "skipped");
  };
  const w1 = weeks.find((w) => w.week_number === 1);
  if (w1?.start_date) {
    const days = Math.floor((Date.now() - new Date(w1.start_date + "T00:00:00").getTime()) / 86400000);
    const cur = weeks.find((w) => w.week_number === Math.floor(days / 7) + 1);
    if (cur) return pendingOf(cur.id);
  }
  for (const w of weeks) {
    const p = await pendingOf(w.id);
    if (p.length) return p;
  }
  return [];
}

const storageKey = (uid: string) => `fl-room:${uid}`;
const firstName = (n: string) => n.split(" ")[0];

export default function RoomPage() {
  const { profile, actingTrainerId } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const uid = actingTrainerId ?? profile?.id ?? "";
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // Rutina elegida para los alumnos que no tienen una para hoy.
  const [chosen, setChosen] = useState<Record<string, string>>({});
  // "Misma rutina para todos" (clase grupal).
  const [mode, setMode] = useState<"own" | "group">("own");
  const [sourceKind, setSourceKind] = useState<"template" | "client">("template");
  const [tplDays, setTplDays] = useState<{ id: string; label: string; name: string }[] | null>(null);
  const [tplDayId, setTplDayId] = useState("");
  const [srcClientId, setSrcClientId] = useState("");
  const [className, setClassName] = useState("");
  const [members, setMembers] = useState<Member[] | null>(null);
  const [opening, setOpening] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [summary, setSummary] = useState<{ name: string; sets: number; volumeKg: number }[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState<{ clientId: string; sessionId: string; group?: boolean }[]>([]);

  // Candidatos: alumnos activos con su rutina de hoy (primero los que tienen).
  useEffect(() => {
    (async () => {
      // Como en "Entrenar con cliente": no hace falta que el alumno tenga cuenta
      // (sus series las registra el entrenador). Quedan afuera los en pausa, los
      // dados de baja y los que esperan el pago de su cupo.
      const cs = (await listClients()).filter((c) => (c.status === "active" || c.status === "prospect") && !c.seat_pending);
      const withToday = await Promise.all(
        cs.map(async (c) => {
          const t = await getTodaysSessionForClient(c.id).catch(() => null);
          const usable = t && t.status !== "completed" && t.status !== "skipped" ? { session: t.session, status: t.status } : null;
          const options = usable ? [] : await pendingThisWeek(c.id).catch((): SessionRow[] => []);
          return { client: c, today: usable, options };
        }),
      );
      const rank = (x: Candidate) => (x.today ? 2 : x.options.length ? 1 : 0);
      withToday.sort((a, b) => rank(b) - rank(a) || a.client.full_name.localeCompare(b.client.full_name));
      setCandidates(withToday);
    })().catch((e) => {
      notify(e.message);
      setCandidates([]);
    });
    try {
      setSaved(JSON.parse(localStorage.getItem(storageKey(uid)) ?? "[]"));
    } catch {
      setSaved([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  useEffect(() => {
    if (mode !== "group" || tplDays) return;
    (async () => {
      const tpls = await listWorkoutTemplates();
      const rows: { id: string; label: string; name: string }[] = [];
      for (const t of tpls) for (const d of await listTemplateSessions(t.id)) rows.push({ id: d.id, label: `${t.name} — ${d.name}`, name: d.name });
      setTplDays(rows);
      if (rows[0]) setTplDayId(rows[0].id);
      if (!rows.length) setSourceKind("client");
    })().catch(() => setTplDays([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const openGroup = async () => {
    if (!profile || !candidates) return;
    const src = candidates.find((c) => c.client.id === srcClientId);
    const srcSession = src ? src.today?.session ?? src.options[0] ?? null : null;
    const tpl = tplDays?.find((d) => d.id === tplDayId);
    const source: GroupSource | null =
      sourceKind === "template" && tpl
        ? { kind: "template", templateSessionId: tpl.id, name: tpl.name }
        : sourceKind === "client" && srcSession
          ? { kind: "session", sessionId: srcSession.id, name: srcSession.name }
          : null;
    if (!source) return notify(sourceKind === "template" ? "Elige una rutina de tus Plantillas." : "Elige de qué alumno copiar la rutina.");
    const name = className.trim() || `Clase: ${source.name}`;
    setOpening(true);
    try {
      const entries: { client: ClientRow; session: SessionRow; group: boolean }[] = [];
      for (const c of candidates.filter((x) => picked.has(x.client.id))) {
        const session = await createGroupSession({
          clientId: c.client.id,
          organizationId: profile.organization_id!,
          trainerId: actingTrainerId ?? profile.id,
          source,
          name,
        });
        entries.push({ client: c.client, session, group: true });
      }
      setOpening(false);
      await open(entries);
    } catch (e: any) {
      notify(e.message);
      setOpening(false);
    }
  };

  const persist = (ms: Member[]) => {
    try {
      localStorage.setItem(storageKey(uid), JSON.stringify(ms.map((m) => ({ clientId: m.client.id, sessionId: m.session.id, group: !!m.group }))));
    } catch {
      /* sin almacenamiento: la sala no se recupera al recargar */
    }
  };

  const open = async (entries: { client: ClientRow; session: SessionRow; group?: boolean }[], keep: Member[] = []) => {
    setOpening(true);
    try {
      const ms = await Promise.all(entries.map(async (e) => ({ client: e.client, session: e.session, group: e.group, log: await getOrCreateWorkoutLog(e.session.id) })));
      const all = [...keep, ...ms];
      setMembers(all);
      persist(all);
    } catch (e: any) {
      notify(e.message);
    }
    setOpening(false);
  };

  const resume = async () => {
    if (!candidates) return;
    const entries = (
      await Promise.all(
        saved.map(async (s) => {
          const c = candidates.find((x) => x.client.id === s.clientId);
          if (!c) return null;
          let session = c.today?.session.id === s.sessionId ? c.today.session : c.options.find((o) => o.id === s.sessionId);
          if (!session) {
            const { data } = await supabase.from("sessions").select("*").eq("id", s.sessionId).maybeSingle();
            session = (data as SessionRow) ?? undefined;
          }
          if (!session) return null;
          const st = await getSessionStatuses([session.id]).catch(() => ({} as Record<string, string>));
          if (st[session.id] === "completed" || st[session.id] === "skipped") return null;
          return { client: c.client, session, group: !!s.group };
        }),
      )
    ).filter((x): x is { client: ClientRow; session: SessionRow; group: boolean } => !!x);
    if (!entries.length) {
      notify("Esa sala ya no está abierta (las sesiones terminaron o cambió el día).");
      localStorage.removeItem(storageKey(uid));
      setSaved([]);
      return;
    }
    await open(entries);
  };

  const finishAll = async () => {
    if (!members) return;
    setFinishing(true);
    const rows: { name: string; sets: number; volumeKg: number }[] = [];
    for (const m of members) {
      const logs = await listSetLogs(m.log.id).catch((): SetLogRow[] => []);
      const done = logs.filter((l) => l.completed);
      rows.push({ name: m.client.full_name, sets: done.length, volumeKg: done.reduce((t, l) => t + (Number(l.load_kg) || 0) * (l.reps || 0), 0) });
      // Solo se cierra la sesión de quien registró algo; el resto queda para otro momento.
      if (done.length) await completeWorkout({ workoutLogId: m.log.id, sessionRpe: null, comments: "", startedAt: m.log.started_at }).catch((e) => notify(e.message));
    }
    localStorage.removeItem(storageKey(uid));
    setSaved([]);
    setSummary(rows);
    setFinishing(false);
  };

  // ---------- Resumen final ----------
  if (summary) {
    return (
      <div className="page" style={{ maxWidth: 640 }}>
        <h1 style={{ marginBottom: 6 }}>¡Sala terminada!</h1>
        <p className="note">Cada alumno ya tiene su sesión, sus series y sus récords en su historial.</p>
        <div className="panel" style={{ overflow: "hidden", margin: "16px 0" }}>
          {summary.map((r) => (
            <div key={r.name} className="room-sum-row">
              <b>{r.name}</b>
              <span className="note">
                {r.sets ? `${r.sets} ${r.sets === 1 ? "serie" : "series"} · ${Math.round(r.volumeKg).toLocaleString("es")} kg levantados` : "No registró series: su sesión quedó sin terminar"}
              </span>
            </div>
          ))}
        </div>
        <button className="btn" onClick={() => navigate(paths.trainerDashboard)}>Volver al Inicio</button>
      </div>
    );
  }

  // ---------- Sala en acción ----------
  if (members) {
    const notIn = (candidates ?? []).filter((c) => (c.today || c.options.length) && !members.some((m) => m.client.id === c.client.id));
    return (
      <div className="page">
        <div className="room-top">
          <h1 style={{ margin: 0 }}>Sala · {members.length} {members.length === 1 ? "alumno" : "alumnos"}</h1>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {notIn.length > 0 && <button className="btn ghost" onClick={() => setAdding(true)}>+ Sumar alumno</button>}
            <button className="btn" onClick={() => setFinishing(true)} disabled={finishing}>Terminar la sala</button>
          </div>
        </div>

        {/* En el celular: pestañas con los nombres para saltar a cada tarjeta. */}
        <div className="room-tabs">
          {members.map((m) => (
            <a key={m.client.id} href={`#room-${m.client.id}`}>{firstName(m.client.full_name)}</a>
          ))}
        </div>

        <div className="room-cards">
          {members.map((m) => (
            <RoomCard key={m.log.id} member={m} organizationId={profile?.organization_id ?? null} />
          ))}
        </div>

        {adding && (
          <ConfirmModal
            title="Sumar a la sala"
            message={`Se suman a la sala: ${notIn.map((c) => `${firstName(c.client.full_name)} (${(c.today?.session ?? c.options[0]).name})`).join(", ")}. A quien no le toca hoy, entra con su primera rutina pendiente de esta semana.`}
            confirmLabel={`Sumar ${notIn.length}`}
            onClose={() => setAdding(false)}
            onConfirm={async () => {
              setAdding(false);
              await open(notIn.map((c) => ({ client: c.client, session: (c.today?.session ?? c.options[0])! })), members);
            }}
          />
        )}
        {finishing && !summary && (
          <ConfirmModal
            title="Terminar la sala"
            message="Se cierra la sesión de cada alumno que registró al menos una serie, con su resumen. Quien no registró nada queda con su sesión pendiente."
            confirmLabel="Terminar"
            onClose={() => setFinishing(false)}
            onConfirm={finishAll}
          />
        )}
      </div>
    );
  }

  // ---------- Armar la sala ----------
  if (!candidates) return <div className="page"><Loading text="Buscando las rutinas de hoy…" /></div>;
  const sessionFor = (c: Candidate): SessionRow | null =>
    c.today?.session ?? c.options.find((o) => o.id === chosen[c.client.id]) ?? c.options[0] ?? null;
  const pickable = candidates.filter((c) => c.today || c.options.length);
  const toggle = (id: string) => setPicked((p) => {
    const n = new Set(p);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  return (
    <div className="page">
      <h1 style={{ marginBottom: 4 }}>Entrenar con cliente · Sala</h1>
      <p className="note" style={{ marginBottom: 16 }}>Para acompañar a varios alumnos a la vez. Elige quiénes están contigo ahora.</p>

      {saved.length > 0 && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="bd" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span>Tienes una sala abierta con {saved.length} {saved.length === 1 ? "alumno" : "alumnos"}.</span>
            <button className="btn" onClick={resume} disabled={opening}>Retomar la sala</button>
          </div>
        </div>
      )}

      <div className="room-setup">
        <div className="panel" style={{ overflow: "hidden" }}>
          <div className="hd"><h3>Alumnos</h3><span className="note">Primero, los que tienen rutina hoy</span></div>
          {candidates.length === 0 && <p className="note" style={{ padding: 14 }}>No tienes alumnos activos.</p>}
          {candidates.map((c) => (
            <label key={c.client.id} className={`room-pick${mode === "group" || c.today || c.options.length ? "" : " off"}`}>
              <input type="checkbox" disabled={mode !== "group" && !c.today && !c.options.length} checked={picked.has(c.client.id)} onChange={() => toggle(c.client.id)} />
              <b style={{ flex: 1 }}>{c.client.full_name}</b>
              {mode === "group" ? null : c.today ? (
                <span className="chip ok">{c.today.session.name} · hoy{c.today.status === "in_progress" ? " · empezada" : ""}</span>
              ) : c.options.length ? (
                <select
                  className="input room-choose"
                  value={chosen[c.client.id] ?? c.options[0].id}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    setChosen((m) => ({ ...m, [c.client.id]: e.target.value }));
                    setPicked((p) => new Set(p).add(c.client.id));
                  }}
                  aria-label={`Rutina para ${c.client.full_name}`}
                >
                  {c.options.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              ) : (
                <span className="note">Sin programa activo</span>
              )}
            </label>
          ))}
        </div>
        <div className="panel">
          <div className="bd">
            <h3 className="room-q">¿Qué entrenan?</h3>
            <div className="room-seg">
              <button type="button" className={mode === "own" ? "on" : ""} onClick={() => setMode("own")}>Cada uno su rutina</button>
              <button type="button" className={mode === "group" ? "on" : ""} onClick={() => setMode("group")}>Misma rutina para todos</button>
            </div>
            {mode === "own" ? (
              <p className="note" style={{ margin: "0 0 16px" }}>
                Cada alumno hace la rutina que le toca hoy. Tú los vas acompañando y registrando a todos en una sola pantalla.
              </p>
            ) : (
              <div className="room-group">
                <p className="note" style={{ margin: 0 }}>
                  Todos hacen la misma rutina hoy, y cada uno registra sus propias cargas (arranca con las que usó la última vez).
                </p>
                <div className="room-seg small">
                  <button type="button" className={sourceKind === "template" ? "on" : ""} onClick={() => setSourceKind("template")}>De mis Plantillas</button>
                  <button type="button" className={sourceKind === "client" ? "on" : ""} onClick={() => setSourceKind("client")}>La rutina de un alumno</button>
                </div>
                {sourceKind === "template" ? (
                  tplDays === null ? (
                    <Loading />
                  ) : tplDays.length ? (
                    <select className="input" value={tplDayId} onChange={(e) => setTplDayId(e.target.value)}>
                      {tplDays.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                    </select>
                  ) : (
                    <p className="note" style={{ margin: 0 }}>Todavía no tienes Plantillas. Usa la rutina de un alumno, o crea una plantilla en Plantillas.</p>
                  )
                ) : (
                  <select className="input" value={srcClientId} onChange={(e) => setSrcClientId(e.target.value)}>
                    <option value="">Elige un alumno…</option>
                    {candidates.filter((c) => c.today || c.options.length).map((c) => (
                      <option key={c.client.id} value={c.client.id}>{c.client.full_name} — {(c.today?.session ?? c.options[0]).name}</option>
                    ))}
                  </select>
                )}
                <label className="field-label" style={{ marginTop: 4 }}>Nombre de la clase (opcional)</label>
                <input className="input" placeholder="Ej. Clase de fuerza del jueves" value={className} onChange={(e) => setClassName(e.target.value)} />
              </div>
            )}
            {mode === "own" && pickable.length === 0 && <p className="note">Ningún alumno tiene un programa activo con rutinas pendientes.</p>}
            {mode === "own" && (
              <p className="note" style={{ margin: "0 0 14px", fontSize: 13 }}>
                Si a un alumno no le toca hoy, elige cuál de sus rutinas pendientes de esta semana va a hacer.
              </p>
            )}
            <button
              className="btn"
              style={{ width: "100%", justifyContent: "center", padding: 12 }}
              disabled={picked.size === 0 || opening}
              onClick={() =>
                mode === "group"
                  ? openGroup()
                  : open(pickable.filter((c) => picked.has(c.client.id) && sessionFor(c)).map((c) => ({ client: c.client, session: sessionFor(c)! })))
              }
            >
              {opening ? "Abriendo…" : picked.size ? `Abrir la sala con ${picked.size} ${picked.size === 1 ? "alumno" : "alumnos"}` : "Elige al menos un alumno"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ======================================================================
// Tarjeta de un alumno en la sala
// ======================================================================

type Step = { ex: WorkoutExerciseRow; setNumber: number; total: number; label: string | null };

/** Orden de las series: ejercicio por ejercicio; las biseries, alternando por ronda (A1, A2, A1, A2…). */
function buildSteps(items: WorkoutExerciseRow[], blockOrder: Map<string, number>): Step[] {
  const sorted = [...items].sort((a, b) => (blockOrder.get(a.block_id ?? "") ?? 0) - (blockOrder.get(b.block_id ?? "") ?? 0) || a.sort_order - b.sort_order);
  const steps: Step[] = [];
  const letters = new Map<number, string>();
  let i = 0;
  while (i < sorted.length) {
    const ex = sorted[i];
    const setsOf = (e: WorkoutExerciseRow) => (e.duration_min != null && !e.sets ? 1 : Math.max(1, e.sets ?? 1));
    if (ex.superset_group != null) {
      const group: WorkoutExerciseRow[] = [];
      while (i < sorted.length && sorted[i].superset_group === ex.superset_group && sorted[i].block_id === ex.block_id) group.push(sorted[i++]);
      if (!letters.has(ex.superset_group)) letters.set(ex.superset_group, String.fromCharCode(65 + letters.size));
      const L = letters.get(ex.superset_group)!;
      const rounds = Math.max(...group.map(setsOf));
      for (let r = 1; r <= rounds; r++) group.forEach((g, gi) => r <= setsOf(g) && steps.push({ ex: g, setNumber: r, total: setsOf(g), label: `${L}${gi + 1}` }));
    } else {
      for (let n = 1; n <= setsOf(ex); n++) steps.push({ ex, setNumber: n, total: setsOf(ex), label: null });
      i++;
    }
  }
  return steps;
}

function RoomCard({ member, organizationId }: { member: Member; organizationId: string | null }) {
  const { notify } = useToast();
  const { client, session, log } = member;
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [logs, setLogs] = useState<SetLogRow[]>([]);
  const [lastPerf, setLastPerf] = useState<Record<string, LastPerformance | null>>({});
  const [unitFor, setUnitFor] = useState<{ fn: (ex: WorkoutExerciseRow) => LoadUnit }>({ fn: () => "kg" });
  const [fixedMode, setFixedMode] = useState(false);
  const [wellness, setWellness] = useState<WellnessLogRow | null>(null);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [reps, setReps] = useState("");
  const [load, setLoad] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [items, blocks, sl, wl, prog] = await Promise.all([
        listWorkoutExercises(session.id),
        listSessionBlocks(session.id),
        listSetLogs(log.id),
        getTodayLog(client.id).catch(() => null),
        supabase.from("programs").select("*").eq("id", session.program_id).maybeSingle(),
      ]);
      setSteps(buildSteps(items, new Map(blocks.map((b) => [b.id, b.sort_order]))));
      setLogs(sl);
      setWellness(wl);
      setFixedMode((prog.data as any)?.plan_mode === "fixed");
      const ids = [...new Set(items.map((e) => e.exercise_id))];
      const pairs = await Promise.all(ids.map(async (id) => [id, await getLastPerformance(client.id, id, log.id).catch(() => null)] as const));
      setLastPerf(Object.fromEntries(pairs));
      const [gym, eq] = await Promise.all([getEffectiveGymUnits(client.id, organizationId), getEquipmentNames()]);
      setUnitFor({ fn: makeUnitResolver(gym, eq) });
    })().catch((e) => notify(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log.id]);

  // Reloj del descanso.
  useEffect(() => {
    if (!restUntil) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [restUntil]);
  const restLeft = restUntil ? Math.max(0, Math.ceil((restUntil - now) / 1000)) : 0;
  useEffect(() => {
    if (!restUntil) return;
    if (restLeft === 0) {
      playRestEnd();
      setRestUntil(null);
    } else if (restLeft <= 3) playRestTick();
  }, [restLeft, restUntil]);

  const isDone = (s: Step) => logs.some((l) => l.workout_exercise_id === s.ex.id && l.set_number === s.setNumber && l.completed);
  const keyOf = (s: Step) => `${s.ex.id}:${s.setNumber}`;
  const current = useMemo(() => steps?.find((s) => !isDone(s) && !skipped.has(keyOf(s))) ?? null, [steps, logs, skipped]); // eslint-disable-line react-hooks/exhaustive-deps
  const doneCount = steps ? steps.filter(isDone).length : 0;
  const unit: LoadUnit = current ? unitFor.fn(current.ex) : "kg";
  const isTime = !!current && current.ex.duration_min != null && !current.ex.sets;

  // Valores con los que arranca cada serie: lo que indicó el entrenador o, en
  // rutinas fijas (o si no indicó carga), lo que hizo la última vez.
  useEffect(() => {
    if (!current) return;
    const perf = lastPerf[current.ex.exercise_id];
    const lastSet = perf?.bySet[current.setNumber] ?? (perf ? Object.values(perf.bySet).slice(-1)[0] : undefined);
    const kg = (fixedMode || member.group || current.ex.load_value == null) && lastSet?.loadKg != null ? lastSet.loadKg : current.ex.load_value;
    setReps(String(current.ex.reps_max ?? current.ex.reps_min ?? lastSet?.reps ?? ""));
    setLoad(kg != null ? String(fromKg(Number(kg), unit)).replace(".", ",") : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.ex.id, current?.setNumber, fixedMode, lastPerf, unit]);

  const markDone = async () => {
    if (!current) return;
    unlockRestSound(); // viene de un toque: deja listo el audio para el fin del descanso
    setSaving(true);
    try {
      const loadNum = load.trim() ? Number(load.replace(",", ".")) : null;
      const saved = await upsertSetLog({
        workoutLogId: log.id,
        workoutExerciseId: current.ex.id,
        exerciseId: current.ex.exercise_id,
        setNumber: current.setNumber,
        reps: isTime ? 0 : Number(reps) || 0,
        loadKg: loadNum != null && !Number.isNaN(loadNum) ? toKg(loadNum, unit) : null,
        rir: current.ex.rir ?? null,
        completed: true,
        loadUnit: unit,
      });
      setLogs((ls) => [...ls.filter((l) => l.id !== saved.id), saved]);
      // Descanso: en una biserie, recién al terminar la ronda.
      const idx = steps!.indexOf(current);
      const next = steps![idx + 1];
      const inSameRound = next && current.ex.superset_group != null && next.ex.superset_group === current.ex.superset_group && next.setNumber === current.setNumber;
      if (current.ex.rest_s && next && !inSameRound) {
        setNow(Date.now());
        setRestUntil(Date.now() + current.ex.rest_s * 1000);
      }
    } catch (e: any) {
      notify(e.message);
    }
    setSaving(false);
  };

  const score = wellness ? wellnessScore(wellness) : null;
  const sem = score != null ? wellnessSemaforo(score) : null;
  const alert = sem && (sem.tone !== "ok" || wellness?.pain_location);
  const perf = current ? lastPerf[current.ex.exercise_id] : null;
  const lastLine = perf
    ? Object.values(perf.bySet)
        .slice(0, 1)
        .map((x) => `${x.loadKg != null ? formatLoad(x.loadKg, unit) + " × " : ""}${x.reps}`)[0]
    : null;

  return (
    <div id={`room-${client.id}`} className={`room-card${alert ? ` tone-${sem!.tone}` : ""}`}>
      <div className="room-card-h">
        <b>
          {sem && <span className={`room-dot ${sem.tone}`} title={`Bienestar ${score}/100`} />}
          {firstName(client.full_name)}
        </b>
        <span className="note">{session.name}{steps ? ` · ${doneCount} de ${steps.length} series` : ""}</span>
      </div>
      {alert && (
        <div className={`room-alert ${sem!.tone}`}>
          Bienestar {score}/100{wellness?.pain_location ? ` · dolor: ${wellness.pain_location}` : ""} · {sem!.recommendation}
        </div>
      )}
      {!wellness && <div className="room-alert none">No respondió el bienestar de hoy.</div>}

      {!steps ? (
        <div style={{ padding: 14 }}><Loading /></div>
      ) : !current ? (
        <div style={{ padding: 16, textAlign: "center" }}>
          <div style={{ fontSize: 28 }}>✅</div>
          <b>Terminó su rutina</b>
          <div className="note" style={{ fontSize: 13 }}>{doneCount} series registradas. Se cierra al terminar la sala.</div>
        </div>
      ) : (
        <>
          <div className="room-ex">
            <b style={{ fontSize: 16 }}>
              {current.label && <span className="chip pri" style={{ fontSize: 11, marginRight: 6 }}>{current.label}</span>}
              {current.ex.exercise_name}
            </b>
            <div className="note" style={{ fontSize: 13, margin: "2px 0 10px" }}>
              {isTime ? `${current.ex.duration_min} min` : `Serie ${current.setNumber} de ${current.total}`}
              {current.ex.reps_min && !isTime ? ` · objetivo ${current.ex.reps_min}${current.ex.reps_max && current.ex.reps_max !== current.ex.reps_min ? `–${current.ex.reps_max}` : ""}` : ""}
              {lastLine ? ` · última vez: ${lastLine}` : ""}
            </div>
            {!isTime && (
              <div className="room-inputs">
                <label>
                  <input className="input" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value.replace(/\D/g, ""))} aria-label="Repeticiones" />
                  <span>reps</span>
                </label>
                <label>
                  <input className="input" inputMode="decimal" value={load} onChange={(e) => setLoad(e.target.value)} aria-label="Carga" />
                  <span>{unit}</span>
                </label>
              </div>
            )}
          </div>
          {restUntil && restLeft > 0 ? (
            <div className="room-rest">
              <span>Descansando</span>
              <b>{Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, "0")}</b>
              <RestSoundToggle style={{ padding: "6px 10px", fontSize: 13 }} />
              <button onClick={() => setRestUntil(null)}>Saltar</button>
            </div>
          ) : (
            <button className="btn room-done" onClick={markDone} disabled={saving}>
              {saving ? "Guardando…" : isTime ? "✓ Hecho" : "✓ Serie hecha"}
            </button>
          )}
          <button className="link-btn room-skip" onClick={() => setSkipped((s) => new Set(s).add(keyOf(current)))}>
            Saltar esta serie
          </button>
        </>
      )}
    </div>
  );
}
