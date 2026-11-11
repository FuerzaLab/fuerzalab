import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { useToast } from "../../../contexts/ToastContext";
import Loading from "../../../components/ui/Loading";
import {
  METRIC_LABEL,
  PERF_TESTS,
  SPRINT_SPLITS,
  asymmetryPct,
  bestOf,
  compareWithPrevious,
  computeMetrics,
  effectiveDef,
  errorLabel,
  fmtNum,
  SECTION_OF_GROUP,
  SECTION_TITLE,
  type PerfSection,
  perfTest,
  type PerfTestDef,
} from "../../../lib/performanceTests";
import {
  addPerformanceTest,
  deletePerformanceTest,
  listClientPerformanceHistory,
  type PerformanceTestRow,
} from "../../../services/performanceTests";

/**
 * Evaluaciones → Rendimiento: potencia, velocidad y funcionales.
 * Elige la prueba, mira su protocolo, carga los intentos y ve el mejor
 * valor, lo calculado (potencia, RSI, velocidad, asimetrías, déficit de
 * cambio de dirección) y la comparación con la evaluación anterior.
 */
const num = (s: string, allowNonPositive = false) => {
  const t = String(s).trim().replace(",", ".").replace("−", "-");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && (allowNonPositive || n > 0) ? n : null;
};
const SIDE_LABEL = { left: "Izquierda", right: "Derecha" } as const;

export default function PerformanceSection({
  assessmentId,
  assessedAt,
  clientId,
  bodyKg,
  section = "performance",
}: {
  assessmentId: string;
  assessedAt: string;
  clientId: string;
  bodyKg: number | null;
  /** Rendimiento deportivo, o Salud y funcionalidad. */
  section?: PerfSection;
}) {
  const { notify } = useToast();
  const [history, setHistory] = useState<PerformanceTestRow[] | null>(null);
  const [testKey, setTestKey] = useState("");
  const [error, setError] = useState("");

  const load = () =>
    listClientPerformanceHistory(clientId)
      .then(setHistory)
      .catch((e) => {
        setError(e.message);
        setHistory([]);
      });
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, assessmentId]);

  const inSection = (key: string) => {
    const d = perfTest(key);
    return !!d && SECTION_OF_GROUP[d.group] === section;
  };
  const rows = useMemo(
    () => (history ?? []).filter((r) => r.assessment_id === assessmentId && inSection(r.test_key)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history, assessmentId, section],
  );
  /** El valor de la evaluación anterior más cercana, de la misma prueba y lado. */
  const previous = (r: PerformanceTestRow) =>
    (history ?? [])
      .filter(
        (h) =>
          h.test_key === r.test_key &&
          h.side === r.side &&
          (perfTest(r.test_key)?.kind !== "custom" || String(h.details?.name ?? "").trim().toLowerCase() === String(r.details?.name ?? "").trim().toLowerCase()) &&
          h.assessment_id !== assessmentId &&
          (h.assessed_at ?? "") < assessedAt &&
          h.value != null,
      )
      .sort((a, b) => (b.assessed_at ?? "").localeCompare(a.assessed_at ?? ""))[0];

  if (history === null) return <Loading />;

  const groups = [...new Set(PERF_TESTS.filter((t) => SECTION_OF_GROUP[t.group] === section).map((t) => t.group))];
  const def = testKey ? perfTest(testKey) : undefined;
  const sprint10 = rows.find((r) => r.test_key === "sprint")?.computed?.best_10;

  return (
    <div className="panel">
      <div className="hd"><h3>{SECTION_TITLE[section]}</h3></div>
      <div className="bd" style={{ display: "grid", gap: 14 }}>
        {error && <p className="error-text" style={{ margin: 0 }}>{error}</p>}

        {rows.length === 0 && (
          <p className="note" style={{ margin: 0 }}>
            Todavía no cargaste pruebas de {section === "health" ? "salud y funcionalidad" : "rendimiento"} en esta evaluación.
          </p>
        )}

        {rows.map((r) => {
          const d = effectiveDef(r.test_key, r.details);
          if (!d) return null;
          const prev = previous(r);
          const cmp = prev && r.value != null && prev.value ? compareWithPrevious(d, r.value, prev.value) : null;
          const other = d.sides ? rows.find((x) => x.test_key === r.test_key && x.side && x.side !== r.side) : undefined;
          return (
            <div key={r.id} className="perf-card">
              <div className="perf-card-h">
                <b>{d.name}{r.side ? ` · ${SIDE_LABEL[r.side]}` : ""}</b>
                <button
                  className="link-btn"
                  style={{ color: "var(--bad)" }}
                  aria-label="Borrar esta prueba"
                  onClick={async () => {
                    try {
                      await deletePerformanceTest(r.id);
                      load();
                    } catch (e: any) {
                      notify(e.message);
                    }
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="perf-best">
                {r.value != null && Number.isFinite(r.value) ? (
                  <>
                    <b>{fmtNum(r.value)} {d.unit}</b> <span className="note">{d.kind === "sprint" ? "en el tramo más largo" : "mejor intento"}</span>
                  </>
                ) : (
                  <span className="note">Sin valor</span>
                )}
                {r.trials.length > 1 && <span className="note"> · intentos: {r.trials.map(fmtNum).join(" / ")}</span>}
              </div>
              {Object.keys(r.computed).length > 0 && (
                <div className="perf-metrics">
                  {Object.entries(r.computed).map(([k, v]) =>
                    METRIC_LABEL[k] ? (
                      <span key={k}>
                        {METRIC_LABEL[k].label}: <b>{fmtNum(v)} {METRIC_LABEL[k].unit}</b>
                      </span>
                    ) : null,
                  )}
                </div>
              )}
              {r.test_key === "cod505" && sprint10 && r.value != null && (
                <div className="perf-metrics">
                  <span>
                    Déficit de cambio de dirección: <b>{fmtNum(Math.round((r.value - sprint10) * 100) / 100)} s</b>
                    <span className="note"> (505 − sprint 10 m)</span>
                  </span>
                </div>
              )}
              {other && r.side === "left" && r.value != null && other.value != null && (
                <div className="perf-metrics">
                  <span>
                    Asimetría entre lados: <b>{fmtNum(asymmetryPct(r.value, other.value, d.better))} %</b>
                    {asymmetryPct(r.value, other.value, d.better) > 10 && <span style={{ color: "var(--warn)" }}> · mayor al 10 %</span>}
                  </span>
                </div>
              )}
              {cmp && prev && (
                <div className={`perf-cmp ${cmp.real ? (cmp.improved ? "up" : "down") : ""}`}>
                  Antes ({new Date((prev.assessed_at ?? "") + "T12:00:00").toLocaleDateString("es")}): {fmtNum(prev.value!)} {d.unit} →{" "}
                  <b>
                    {cmp.diff > 0 ? "+" : ""}
                    {fmtNum(cmp.diff)} {d.unit}
                    {cmp.pct != null && d.typicalErrorAbs == null ? ` (${cmp.pct > 0 ? "+" : ""}${fmtNum(cmp.pct)} %)` : ""}
                  </b>
                  {" · "}
                  {cmp.real
                    ? cmp.improved
                      ? "mejora real"
                      : "empeoró de verdad"
                    : `dentro del error del test (${errorLabel(d)}): puede ser variación normal`}
                </div>
              )}
              {r.notes && <div className="note" style={{ fontSize: 13 }}>{r.notes}</div>}
            </div>
          );
        })}

        <div className="perf-add">
          <label className="field-label">Agregar una prueba</label>
          <select className="input" value={testKey} onChange={(e) => setTestKey(e.target.value)}>
            <option value="">Elige una prueba…</option>
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {PERF_TESTS.filter((t) => t.group === g).map((t) => (
                  <option key={t.key} value={t.key}>{t.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {def && (
            <PerfForm
              key={def.key}
              def={def}
              bodyKg={bodyKg}
              onSave={async (payloads) => {
                try {
                  for (const p of payloads) await addPerformanceTest({ assessmentId, ...p });
                  setTestKey("");
                  load();
                  notify("Prueba guardada.");
                } catch (e: any) {
                  notify(e.message);
                }
              }}
              onCancel={() => setTestKey("")}
            />
          )}
        </div>
        <p className="note" style={{ margin: 0, fontSize: 12.5 }}>
          Para comparar en el tiempo: {section === "health" ? "misma silla, mismo recorrido, mismo horario y mismo calzado" : "mismo calentamiento, horario, calzado y superficie"}. El error de cada test es una referencia
          aproximada; un cambio menor a ese error puede ser solo variación normal.
          {!bodyKg && (section === "health" ? " Para calcular la fuerza de prensión relativa al peso, carga el peso en Datos corporales de esta evaluación." : " Para calcular la potencia, carga el peso en Datos corporales de esta evaluación.")}
        </p>
      </div>
    </div>
  );
}

type Payload = {
  testKey: string;
  side: "left" | "right" | null;
  trials: number[];
  value: number | null;
  details: Record<string, any>;
  computed: Record<string, number>;
  notes?: string;
};

function PerfForm({ def, bodyKg, onSave, onCancel }: { def: PerfTestDef; bodyKg: number | null; onSave: (p: Payload[]) => Promise<void>; onCancel: () => void }) {
  const sides: ("left" | "right" | null)[] = def.sides ? ["left", "right"] : [null];
  const blank = () => Array.from({ length: def.trials }, () => "");
  const [vals, setVals] = useState<Record<string, string[]>>(() => Object.fromEntries(sides.map((s) => [s ?? "x", blank()])));
  const [contact, setContact] = useState<string[]>(blank());
  const [splits, setSplits] = useState<Record<string, string[]>>(() => Object.fromEntries(SPRINT_SPLITS.map((d) => [String(d), blank()])));
  const [extra, setExtra] = useState(""); // peso del balón o altura del cajón
  const [cName, setCName] = useState("");
  const [cUnit, setCUnit] = useState("");
  const [cBetter, setCBetter] = useState<"higher" | "lower">("higher");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const build = (): Payload[] | string => {
    if (def.kind === "sprint") {
      const sp: Record<string, number[]> = {};
      for (const d of SPRINT_SPLITS) sp[String(d)] = splits[String(d)].map((x) => num(x) ?? 0).filter((x) => x > 0);
      const longest = [...SPRINT_SPLITS].reverse().find((d) => sp[String(d)].length);
      if (!longest) return "Carga al menos un parcial.";
      const trials = sp[String(longest)];
      const value = bestOf(trials, "lower");
      const computed = computeMetrics(def, value, { splits: sp }, bodyKg);
      return [{ testKey: def.key, side: null, trials, value, details: { splits: sp, longest_m: longest }, computed, notes }];
    }
    if (def.kind === "custom" && !cName.trim()) return "Escribe el nombre de la prueba.";
    const out: Payload[] = [];
    for (const s of sides) {
      const raw = vals[s ?? "x"];
      const np = !!def.allowNonPositive;
      const parsed = raw.map((x) => num(x, np));
      const valid = parsed.filter((x): x is number => x != null);
      const trials = parsed.map((x) => x ?? 0);
      if (!valid.length) continue;
      const value = bestOf(valid, def.kind === "custom" ? cBetter : def.better, np);
      const details: Record<string, any> = {};
      if (def.kind === "custom") Object.assign(details, { name: cName.trim(), unit: cUnit.trim(), better: cBetter });
      if (def.kind === "dropjump") {
        details.contact_ms = contact.map((x) => num(x) ?? 0);
        if (num(extra)) details.box_cm = num(extra);
      }
      if (def.kind === "throw" && num(extra)) details.ball_kg = num(extra);
      const computed = computeMetrics(def, value, { trials, contactMs: details.contact_ms, ballKg: details.ball_kg }, bodyKg);
      out.push({ testKey: def.key, side: s, trials: valid, value, details, computed, notes });
    }
    return out.length ? out : "Carga al menos un intento.";
  };

  return (
    <div className="perf-form">
      <p className="note" style={{ margin: 0 }}>{def.protocol}</p>

      {def.kind === "custom" && (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.4fr", gap: 8 }}>
          <div>
            <label className="field-label">Nombre de la prueba</label>
            <input className="input" value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Ej. Potencia en sentadilla (encóder)" />
          </div>
          <div>
            <label className="field-label">Unidad</label>
            <input className="input" value={cUnit} onChange={(e) => setCUnit(e.target.value)} placeholder="W, cm, s…" />
          </div>
          <div>
            <label className="field-label">Es mejor un valor…</label>
            <select className="input" value={cBetter} onChange={(e) => setCBetter(e.target.value as "higher" | "lower")}>
              <option value="higher">más alto</option>
              <option value="lower">más bajo (tiempos)</option>
            </select>
          </div>
        </div>
      )}

      {def.kind === "sprint" ? (
        <div className="perf-grid" style={{ ["--n" as any]: def.trials }}>
          <span />
          {Array.from({ length: def.trials }, (_, i) => <span key={i} className="note">Intento {i + 1}</span>)}
          {SPRINT_SPLITS.map((d) => (
            <FragmentRow key={d} label={`${d} m (s)`}>
              {splits[String(d)].map((v, i) => (
                <input key={i} className="input" inputMode="decimal" value={v} placeholder={d === 40 ? "opcional" : ""} onChange={(e) => setSplits((m) => ({ ...m, [String(d)]: m[String(d)].map((x, j) => (j === i ? e.target.value : x)) }))} />
              ))}
            </FragmentRow>
          ))}
        </div>
      ) : (
        sides.map((s) => (
          <div key={s ?? "x"} className="perf-grid" style={{ ["--n" as any]: def.trials }}>
            <span className="note" style={{ alignSelf: "center" }}>{s ? SIDE_LABEL[s] : def.kind === "custom" ? `Valor${cUnit ? ` (${cUnit})` : ""}` : `${def.unit === "rep" ? "Repeticiones" : `Valor (${def.unit})`}`}</span>
            {vals[s ?? "x"].map((v, i) => (
              <input
                key={i}
                className="input"
                inputMode={def.allowNonPositive ? "text" : "decimal"}
                placeholder={def.allowNonPositive ? `Intento ${i + 1} (ej. −5)` : `Intento ${i + 1}`}
                value={v}
                onChange={(e) => setVals((m) => ({ ...m, [s ?? "x"]: m[s ?? "x"].map((x, j) => (j === i ? e.target.value : x)) }))}
              />
            ))}
            {def.kind === "dropjump" && (
              <>
                <span className="note" style={{ alignSelf: "center" }}>Contacto (ms)</span>
                {contact.map((v, i) => (
                  <input key={i} className="input" inputMode="numeric" placeholder={`Intento ${i + 1}`} value={v} onChange={(e) => setContact((c) => c.map((x, j) => (j === i ? e.target.value : x)))} />
                ))}
              </>
            )}
          </div>
        ))
      )}

      {(def.kind === "dropjump" || def.kind === "throw") && (
        <div>
          <label className="field-label">{def.kind === "throw" ? "Peso del balón (kg)" : "Altura del cajón (cm)"}</label>
          <input className="input" style={{ maxWidth: 140 }} inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} />
        </div>
      )}
      <div>
        <label className="field-label">Notas (opcional)</label>
        <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. superficie, calzado, molestias" />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          className="btn"
          disabled={saving}
          onClick={async () => {
            const p = build();
            if (typeof p === "string") return alert(p);
            setSaving(true);
            await onSave(p);
            setSaving(false);
          }}
        >
          {saving ? "Guardando…" : "Guardar prueba"}
        </button>
        <button className="btn ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

function FragmentRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <span className="note" style={{ alignSelf: "center" }}>{label}</span>
      {children}
    </>
  );
}
