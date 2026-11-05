import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import Loading from "../../components/ui/Loading";
import VideoEmbed from "../../components/VideoEmbed";
import {
  BLOCK_LABEL,
  DAY_OF_WEEK_LABEL,
  listSessionBlocks,
  listWorkoutExercises,
  type BlockKind,
  type SessionBlockRow,
  type SessionRow,
  type WorkoutExerciseRow,
} from "../../services/sessions";
import { formatLoad, type LoadUnit } from "../../lib/units";
import { getEffectiveGymUnits, getEquipmentNames, makeUnitResolver } from "../../services/units";
import { getLastPerformance, type LastPerformance } from "../../services/training";
import { supabase } from "../../lib/supabase";

const fmtRest = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `${s} s`);

/**
 * La rutina del día ANTES de empezar: el alumno ve qué le toca (ejercicios,
 * series, carga, descanso, video) sin registrar nada. "Empezar entrenamiento"
 * pide confirmación; recién ahí empieza la sesión.
 */
export default function SessionPreview({
  session,
  clientId,
  status,
  onBack,
  onStart,
}: {
  session: SessionRow;
  clientId: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
  onBack: () => void;
  onStart: () => void;
}) {
  const { profile } = useAuth();
  const [items, setItems] = useState<WorkoutExerciseRow[] | null>(null);
  const [blocks, setBlocks] = useState<SessionBlockRow[]>([]);
  const [unitFor, setUnitFor] = useState<{ fn: (ex: WorkoutExerciseRow) => LoadUnit }>({ fn: () => "kg" });
  const [videoOpen, setVideoOpen] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  // Rutinas fijas: la carga que se muestra es la que hizo la última vez (igual que al entrenar).
  const [lastPerf, setLastPerf] = useState<Record<string, LastPerformance | null> | null>(null);

  useEffect(() => {
    Promise.all([listWorkoutExercises(session.id), listSessionBlocks(session.id)])
      .then(async ([ex, bl]) => {
        setItems(ex);
        setBlocks(bl);
        const { data: prog } = await supabase.from("programs").select("*").eq("id", session.program_id).maybeSingle();
        if ((prog as any)?.plan_mode !== "fixed") return;
        const ids = [...new Set(ex.map((e) => e.exercise_id))];
        const pairs = await Promise.all(ids.map(async (id) => [id, await getLastPerformance(clientId, id, "00000000-0000-0000-0000-000000000000").catch(() => null)] as const));
        setLastPerf(Object.fromEntries(pairs));
      })
      .catch(() => setItems([]));
    Promise.all([getEffectiveGymUnits(clientId, profile?.organization_id ?? null), getEquipmentNames()])
      .then(([gym, eq]) => setUnitFor({ fn: makeUnitResolver(gym, eq) }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  if (!items) return <Loading />;

  // Agrupar por bloque, en el orden de los bloques.
  const blockOrder = new Map(blocks.map((b) => [b.id, b.sort_order]));
  const blockKind = new Map(blocks.map((b) => [b.id, b.kind as BlockKind]));
  const sorted = [...items].sort((a, b) => (blockOrder.get(a.block_id ?? "") ?? 0) - (blockOrder.get(b.block_id ?? "") ?? 0) || a.sort_order - b.sort_order);
  // Letras de biseries / series gigantes: A1, A2, B1…
  const letters = new Map<number, string>();
  const pos = new Map<number, number>();
  for (const it of sorted) if (it.superset_group != null && !letters.has(it.superset_group)) letters.set(it.superset_group, String.fromCharCode(65 + letters.size));
  const groupSize = (g: number) => sorted.filter((x) => x.superset_group === g).length;

  // Duración aproximada: series × (descanso + ~40 s de trabajo), redondeada a 5 minutos.
  const seconds = sorted.reduce((t, x) => t + (x.duration_min ? x.duration_min * 60 : (x.sets ?? 3) * ((x.rest_s ?? 60) + 40)), 0);
  const minutes = Math.max(5, Math.round(seconds / 60 / 5) * 5);

  let lastBlock: string | null = null;
  let n = 0;

  return (
    <div className="page" style={{ maxWidth: 620, paddingBottom: 110 }}>
      <button className="link-btn" onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 10 }}>
        <ArrowLeft size={15} /> Mi rutina
      </button>
      <div className="preview-hero">
        {session.day_of_week && <div className="note">{DAY_OF_WEEK_LABEL[session.day_of_week]}</div>}
        <h1>{session.name}</h1>
        <div className="note">
          {sorted.length} {sorted.length === 1 ? "ejercicio" : "ejercicios"}
          {sorted.length > 0 && ` · unos ${minutes} min`}
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="note">Esta rutina todavía no tiene ejercicios. Avisa a tu entrenador.</p>
      ) : (
        <>
          <p className="note" style={{ margin: "14px 2px 8px" }}>
            {status === "completed" ? "Esto fue lo que hiciste:" : "Esto es lo que vas a hacer hoy:"}
          </p>
          <div className="panel" style={{ overflow: "hidden" }}>
            {sorted.map((it) => {
              const kind = blockKind.get(it.block_id ?? "");
              const label = kind ? BLOCK_LABEL[kind] : null;
              const showBlock = label && label !== lastBlock;
              lastBlock = label ?? lastBlock;
              n += 1;
              let tag = "";
              if (it.superset_group != null && groupSize(it.superset_group) > 1) {
                const k = (pos.get(it.superset_group) ?? 0) + 1;
                pos.set(it.superset_group, k);
                tag = `${letters.get(it.superset_group)}${k}`;
              }
              const reps =
                it.reps_min != null && it.reps_max != null && it.reps_min !== it.reps_max ? `${it.reps_min}–${it.reps_max}` : it.reps_max ?? it.reps_min;
              const parts: string[] = [];
              if (it.duration_min) parts.push(`${it.duration_min} min`);
              else parts.push(`${it.sets ?? "—"} × ${reps ?? "—"}`);
              // En rutinas fijas, la última carga que usó (es con la que va a arrancar).
              const perf = lastPerf?.[it.exercise_id];
              const lastLoads = perf ? Object.values(perf.bySet).map((x) => x.loadKg).filter((v): v is number => v != null) : [];
              const shownLoad = lastLoads.length ? Math.max(...lastLoads) : it.load_value;
              if (shownLoad) parts.push(formatLoad(shownLoad, unitFor.fn(it)) + (lastLoads.length ? " (la última vez)" : ""));
              if (it.rest_s) parts.push(`desc. ${fmtRest(it.rest_s)}`);
              return (
                <div key={it.id}>
                  {showBlock && <div className="preview-block">{label}</div>}
                  <div className="preview-ex">
                    <span className="preview-n">{n}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div>
                        {tag && <span className="chip pri" style={{ fontSize: 11, marginRight: 6 }}>{tag}</span>}
                        <b>{it.exercise_name}</b>
                      </div>
                      <div className="note" style={{ fontSize: 13 }}>{parts.join(" · ")}</div>
                      {videoOpen === it.id && it.exercise_video_url && <VideoEmbed url={it.exercise_video_url} exerciseId={it.exercise_id} />}
                    </div>
                    {it.exercise_video_url && (
                      <button className="link-btn" style={{ fontSize: 13, fontWeight: 700, textDecoration: "none" }} onClick={() => setVideoOpen((v) => (v === it.id ? null : it.id))}>
                        {videoOpen === it.id ? "Ocultar" : "▶ Ver"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {status !== "completed" && sorted.length > 0 && (
        <div className="preview-sticky">
          <button className="btn" onClick={() => setConfirming(true)}>
            ▶ Empezar entrenamiento
          </button>
        </div>
      )}

      {confirming && (
        <div className="sheet-overlay" onClick={() => setConfirming(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="start-title" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 32 }}>💪</div>
            <h2 id="start-title" style={{ margin: "6px 0" }}>¿Empezamos a entrenar?</h2>
            <p className="note" style={{ margin: "0 0 6px", fontSize: 15 }}>
              Vas a empezar <b style={{ color: "var(--ink)" }}>{session.name}</b>.
            </p>
            <p className="note" style={{ margin: "0 0 18px", fontSize: 14 }}>
              Desde ahora se cuenta el tiempo de la sesión y tu entrenador va a ver que empezaste. Ten a mano agua y lo que necesites.
            </p>
            <button
              className="btn"
              style={{ width: "100%", justifyContent: "center", padding: 14, fontSize: 16 }}
              onClick={() => {
                setConfirming(false);
                onStart();
              }}
            >
              Sí, empezar ahora
            </button>
            <button className="btn ghost" style={{ width: "100%", justifyContent: "center", padding: 12, marginTop: 8 }} onClick={() => setConfirming(false)}>
              Todavía no
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
