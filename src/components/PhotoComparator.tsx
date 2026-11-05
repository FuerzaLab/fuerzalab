import { useEffect, useMemo, useState } from "react";
import Loading from "./ui/Loading";
import {
  ANGLE_LABEL,
  ANGLE_ORDER,
  getPhotoUrl,
  groupPhotosBySession,
  listProgressPhotos,
  type PhotoAngle,
  type ProgressPhotoRow,
} from "../services/progressPhotos";
import { getBodyMeasurement, listAssessments, listCircumferences } from "../services/assessments";

/**
 * Comparador de fotos de progreso: el alumno o el entrenador eligen "Antes" y
 * "Después" (por defecto, la primera y la última sesión) y las fotos se
 * emparejan por ángulo — frente con frente, perfil con perfil. Arriba, los
 * días entre las dos fechas y, si hay evaluaciones cerca de esas fechas, el
 * cambio de peso y de cintura.
 */
type Session = { key: string; date: string | null; photos: ProgressPhotoRow[] };

const fmtDate = (d: string | null) => (d ? new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" }) : "Sin fecha");
const dayOf = (s: Session) => (s.date ?? s.photos[0]?.created_at ?? "").slice(0, 10);
const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));

export default function PhotoComparator({ clientId, restrictToShared }: { clientId: string; restrictToShared: boolean }) {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [beforeKey, setBeforeKey] = useState("");
  const [afterKey, setAfterKey] = useState("");
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [metrics, setMetrics] = useState<{ before: { weight?: number; waist?: number }; after: { weight?: number; waist?: number } } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSessions(null);
    listProgressPhotos(clientId)
      .then((photos) => {
        if (cancelled) return;
        const visible = restrictToShared ? photos.filter((p) => p.visibility === "client_and_trainer") : photos;
        const grouped = groupPhotosBySession(visible); // de la más nueva a la más vieja
        setSessions(grouped);
        setAfterKey(grouped[0]?.key ?? "");
        setBeforeKey(grouped[grouped.length - 1]?.key ?? "");
      })
      .catch(() => setSessions([]));
    return () => {
      cancelled = true;
    };
  }, [clientId, restrictToShared]);

  const before = sessions?.find((s) => s.key === beforeKey) ?? null;
  const after = sessions?.find((s) => s.key === afterKey) ?? null;

  // Enlaces de las fotos elegidas (vencen: se piden justo para mostrarlas).
  useEffect(() => {
    const photos = [...(before?.photos ?? []), ...(after?.photos ?? [])].filter((p) => !urls[p.id]);
    if (!photos.length) return;
    let cancelled = false;
    Promise.all(photos.map(async (p) => [p.id, await getPhotoUrl(p.storage_path).catch(() => "")] as const)).then((entries) => {
      if (!cancelled) setUrls((u) => ({ ...u, ...Object.fromEntries(entries) }));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beforeKey, afterKey, sessions]);

  // Peso y cintura de las evaluaciones más cercanas (hasta 7 días) a cada fecha.
  useEffect(() => {
    setMetrics(null);
    if (!before || !after || before.key === after.key) return;
    let cancelled = false;
    (async () => {
      const list = await listAssessments(clientId);
      const near = (day: string) => {
        const t = new Date(day + "T12:00:00").getTime();
        let best: { id: string; diff: number } | null = null;
        for (const a of list) {
          const diff = Math.abs(new Date(a.assessed_at + "T12:00:00").getTime() - t) / 86400000;
          if (diff <= 7 && (!best || diff < best.diff)) best = { id: a.id, diff };
        }
        return best?.id ?? null;
      };
      const read = async (id: string | null) => {
        if (!id) return {};
        const [body, circs] = await Promise.all([getBodyMeasurement(id).catch(() => null), listCircumferences(id).catch(() => [])]);
        const waist = circs.find((c: any) => c.site === "waist" && (c.side ?? "none") === "none")?.value_cm;
        return { weight: body?.weight_kg ?? undefined, waist: waist ?? undefined };
      };
      const [b, a] = await Promise.all([read(near(dayOf(before))), read(near(dayOf(after)))]);
      if (!cancelled) setMetrics({ before: b, after: a });
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [clientId, before?.key, after?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const angles = useMemo(() => {
    const have = new Set<PhotoAngle>();
    for (const s of [before, after]) for (const p of s?.photos ?? []) have.add((p.angle ?? "front") as PhotoAngle);
    return ANGLE_ORDER.filter((a) => have.has(a));
  }, [before, after]);

  if (sessions === null) return <Loading text="Cargando fotos…" />;
  if (sessions.length === 0) return <p className="note">Todavía no hay fotos de progreso cargadas.</p>;

  const photoFor = (s: Session | null, angle: PhotoAngle) => s?.photos.find((p) => (p.angle ?? "front") === angle) ?? null;
  const days = before && after ? Math.round(Math.abs(new Date(dayOf(after) + "T12:00:00").getTime() - new Date(dayOf(before) + "T12:00:00").getTime()) / 86400000) : 0;

  const delta = (label: string, b?: number, a?: number, unit = "") => {
    if (b == null || a == null) return null;
    const d = Math.round((a - b) * 10) / 10;
    return (
      <span className="pc-metric">
        {label}: <b>{fmtNum(b)} → {fmtNum(a)} {unit}</b>{" "}
        <span style={{ color: d < 0 ? "var(--ok)" : d > 0 ? "var(--warn)" : "var(--muted)" }}>
          ({d === 0 ? "igual" : `${d > 0 ? "▲" : "▼"} ${fmtNum(Math.abs(d))}`})
        </span>
      </span>
    );
  };

  const cell = (s: Session | null, angle: PhotoAngle) => {
    const p = photoFor(s, angle);
    if (!p) return <div className="pc-missing">Sin foto de este ángulo</div>;
    return urls[p.id] ? <img src={urls[p.id]} alt={ANGLE_LABEL[angle]} className="pc-img" /> : <div className="pc-missing" />;
  };

  if (sessions.length === 1) {
    return (
      <div>
        <p className="note" style={{ marginTop: 0 }}>Única sesión de fotos hasta ahora ({fmtDate(sessions[0].date)}). Con una segunda fecha vas a poder compararlas.</p>
        <div className="pc-grid single">
          {angles.map((a) => (
            <div key={a}>
              {cell(sessions[0], a)}
              <div className="pc-angle">{ANGLE_LABEL[a]}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const option = (s: Session) => <option key={s.key} value={s.key}>{fmtDate(s.date)}</option>;

  return (
    <div>
      <div className="pc-selectors">
        <label>
          <span className="field-label">Antes</span>
          <select className="input" value={beforeKey} onChange={(e) => setBeforeKey(e.target.value)}>
            {[...sessions].reverse().map(option)}
          </select>
        </label>
        <label>
          <span className="field-label">Después</span>
          <select className="input" value={afterKey} onChange={(e) => setAfterKey(e.target.value)}>
            {sessions.map(option)}
          </select>
        </label>
      </div>

      {before && after && before.key !== after.key && (
        <div className="pc-summary">
          <span className="pc-metric"><b>{days}</b> {days === 1 ? "día" : "días"} entre las dos fotos</span>
          {metrics && delta("Peso", metrics.before.weight, metrics.after.weight, "kg")}
          {metrics && delta("Cintura", metrics.before.waist, metrics.after.waist, "cm")}
        </div>
      )}
      {before && after && before.key === after.key && <p className="note">Elegiste la misma fecha en los dos lados.</p>}

      <div className="pc-grid">
        <div className="pc-head">Antes · {fmtDate(before?.date ?? null)}</div>
        <div className="pc-head">Después · {fmtDate(after?.date ?? null)}</div>
        {angles.map((a) => (
          <div key={a} className="pc-row">
            <div className="pc-angle-row">{ANGLE_LABEL[a]}</div>
            <div>{cell(before, a)}</div>
            <div>{cell(after, a)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
