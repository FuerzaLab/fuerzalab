import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import Modal from "../../../components/ui/Modal";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import { listClients, getClientProfile, type ClientRow, type ClientProfileRow } from "../../../services/clients";
import { listExercises, type ExerciseRow } from "../../../services/exercises";
import {
  listAssessments,
  createAssessment,
  deleteAssessment,
  getBodyMeasurement,
  upsertBodyMeasurement,
  listCircumferences,
  addCircumference,
  deleteCircumference,
  listStrengthTests,
  addStrengthTest,
  deleteStrengthTest,
  listSkinfolds,
  addSkinfold,
  deleteSkinfold,
  listPowerTests,
  addPowerTest,
  deletePowerTest,
  listEnduranceTests,
  addEnduranceTest,
  deleteEnduranceTest,
  listMobilityTests,
  addMobilityTest,
  deleteMobilityTest,
  listFlexibilityTests,
  addFlexibilityTest,
  deleteFlexibilityTest,
  suggestAssessmentCategories,
  TYPE_LABEL,
  SITE_LABEL,
  SKINFOLD_SITES,
  POWER_TEST_LABEL,
  MOBILITY_JOINTS,
  CATEGORY_LABEL,
  type AssessmentRow,
  type AssessmentType,
  type AssessmentCategory,
  type BodyMeasurementRow,
  type CircumferenceRow,
  type CircumferenceSite,
  type StrengthTestRow,
  type SkinfoldRow,
  type PowerTestRow,
  type PowerTestType,
  type EnduranceTestRow,
  type MobilityTestRow,
  type FlexibilityTestRow,
} from "../../../services/assessments";

const CATEGORY_ORDER: AssessmentCategory[] = ["body", "circumferences", "skinfolds", "strength", "power", "endurance", "mobility", "flexibility"];

export default function AssessmentsPage() {
  const { profile } = useAuth();
  const { notify } = useToast();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientId, setClientId] = useState("");
  const [clientProfile, setClientProfile] = useState<ClientProfileRow | null>(null);
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [toDelete, setToDelete] = useState<AssessmentRow | null>(null);

  useEffect(() => {
    listClients().then(setClients).catch((e) => notify(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAssessments = async (cId: string) => {
    const list = await listAssessments(cId);
    setAssessments(list);
    setSelectedId(list[0]?.id ?? "");
  };

  useEffect(() => {
    if (clientId) {
      loadAssessments(clientId);
      getClientProfile(clientId).then(setClientProfile).catch(() => setClientProfile(null));
    } else {
      setAssessments([]);
      setSelectedId("");
      setClientProfile(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const selected = assessments.find((a) => a.id === selectedId) ?? null;

  const suggestion =
    clientProfile?.submitted_at
      ? suggestAssessmentCategories({
          mainGoal: clientProfile.main_goal,
          secondaryGoals: clientProfile.secondary_goals,
          injuries: clientProfile.injuries,
          boneJointFlag: Boolean(clientProfile.par_q?.boneJoint),
        })
      : null;

  if (!profile) return null;

  return (
    <div className="page">
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Evaluaciones</h1>
          <p className="note">Elige un cliente para ver su historial o registrar una nueva.</p>
        </div>
        {clientId && (
          <button className="btn" onClick={() => setShowNew(true)}>
            <Plus size={16} /> Nueva evaluación
          </button>
        )}
      </div>

      <div style={{ marginBottom: 20, maxWidth: 320 }}>
        <label className="field-label">Cliente</label>
        <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Selecciona un cliente</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
      </div>

      {clientId && suggestion && (
        <div className="panel" style={{ marginBottom: 18, borderLeft: "4px solid var(--pri)" }}>
          <div className="bd">
            <b>Evaluaciones sugeridas para este cliente:</b>{" "}
            {suggestion.categories.map((c) => CATEGORY_LABEL[c]).join(", ")}.{" "}
            <span className="note">{suggestion.reason}</span>
          </div>
        </div>
      )}
      {clientId && !clientProfile?.submitted_at && (
        <p className="note" style={{ marginBottom: 18 }}>
          Este cliente todavía no completó su formulario de ingreso, así que no podemos sugerirle evaluaciones según su objetivo.
        </p>
      )}

      {clientId && assessments.length === 0 && <p className="note">Este cliente todavía no tiene evaluaciones.</p>}

      {assessments.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
          {assessments.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelectedId(a.id)}
              className="chip"
              style={{ cursor: "pointer", border: "1px solid var(--line)", background: a.id === selectedId ? "var(--pri)" : "#fff", color: a.id === selectedId ? "#fff" : "var(--muted)" }}
            >
              {new Date(a.assessed_at).toLocaleDateString("es")} · {TYPE_LABEL[a.type]}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <AssessmentDetail
          key={selected.id}
          assessment={selected}
          suggestedCategories={suggestion?.categories ?? null}
          onDelete={() => setToDelete(selected)}
        />
      )}

      {showNew && (
        <NewAssessmentModal
          organizationId={profile.organization_id!}
          trainerId={profile.id}
          clientId={clientId}
          onClose={() => setShowNew(false)}
          onCreated={async (a) => {
            setShowNew(false);
            await loadAssessments(clientId);
            setSelectedId(a.id);
            notify("Evaluación creada.");
          }}
        />
      )}

      {toDelete && (
        <ConfirmModal
          title="Eliminar evaluación"
          message={`¿Eliminar la evaluación del ${new Date(toDelete.assessed_at).toLocaleDateString("es")}? Se borran también sus medidas y pruebas. No se puede deshacer.`}
          confirmLabel="Eliminar"
          danger
          onClose={() => setToDelete(null)}
          onConfirm={async () => {
            await deleteAssessment(toDelete.id);
            await loadAssessments(clientId);
            setToDelete(null);
            notify("Evaluación eliminada.");
          }}
        />
      )}
    </div>
  );
}

function NewAssessmentModal({
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
  onCreated: (a: AssessmentRow) => void;
}) {
  const [assessedAt, setAssessedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<AssessmentType>("periodic");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError("");
    setSaving(true);
    try {
      onCreated(await createAssessment({ organizationId, trainerId, clientId, assessedAt, type, notes }));
    } catch (e: any) {
      setError(e.message ?? "No pudimos crear la evaluación.");
    }
    setSaving(false);
  };

  return (
    <Modal title="Nueva evaluación" onClose={onClose}>
      <label className="field-label">Fecha</label>
      <input type="date" className="input" style={{ marginBottom: 12 }} value={assessedAt} onChange={(e) => setAssessedAt(e.target.value)} />
      <label className="field-label">Tipo</label>
      <select className="input" style={{ marginBottom: 12 }} value={type} onChange={(e) => setType(e.target.value as AssessmentType)}>
        <option value="initial">Inicial</option>
        <option value="periodic">Periódica</option>
        <option value="ad_hoc">Puntual</option>
      </select>
      <label className="field-label">Notas (opcional)</label>
      <textarea className="input" style={{ minHeight: 60, marginBottom: 16 }} value={notes} onChange={(e) => setNotes(e.target.value)} />
      {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}
      <button className="btn" onClick={submit} disabled={saving}>{saving ? "Creando…" : "Crear evaluación"}</button>
    </Modal>
  );
}

function AssessmentDetail({
  assessment,
  suggestedCategories,
  onDelete,
}: {
  assessment: AssessmentRow;
  suggestedCategories: AssessmentCategory[] | null;
  onDelete: () => void;
}) {
  const { notify } = useToast();
  const [active, setActive] = useState<AssessmentCategory>(suggestedCategories?.[0] ?? "body");

  const [body, setBody] = useState<BodyMeasurementRow | null>(null);
  const [circs, setCircs] = useState<CircumferenceRow[]>([]);
  const [strength, setStrength] = useState<StrengthTestRow[]>([]);
  const [skinfolds, setSkinfolds] = useState<SkinfoldRow[]>([]);
  const [power, setPower] = useState<PowerTestRow[]>([]);
  const [endurance, setEndurance] = useState<EnduranceTestRow[]>([]);
  const [mobility, setMobility] = useState<MobilityTestRow[]>([]);
  const [flexibility, setFlexibility] = useState<FlexibilityTestRow[]>([]);
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getBodyMeasurement(assessment.id),
      listCircumferences(assessment.id),
      listStrengthTests(assessment.id),
      listSkinfolds(assessment.id),
      listPowerTests(assessment.id),
      listEnduranceTests(assessment.id),
      listMobilityTests(assessment.id),
      listFlexibilityTests(assessment.id),
      listExercises(),
    ])
      .then(([b, c, s, sf, pw, en, mo, fl, ex]) => {
        setBody(b);
        setCircs(c);
        setStrength(s);
        setSkinfolds(sf);
        setPower(pw);
        setEndurance(en);
        setMobility(mo);
        setFlexibility(fl);
        setExercises(ex);
      })
      .catch((e: any) => notify(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessment.id]);

  const counts: Record<AssessmentCategory, number> = {
    body: body ? 1 : 0,
    circumferences: circs.length,
    skinfolds: skinfolds.length,
    strength: strength.length,
    power: power.length,
    endurance: endurance.length,
    mobility: mobility.length,
    flexibility: flexibility.length,
  };

  if (loading) return <p className="note">Cargando…</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <label className="field-label">Qué evaluación querés registrar</label>
          <select className="input" style={{ minWidth: 240 }} value={active} onChange={(e) => setActive(e.target.value as AssessmentCategory)}>
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
                {counts[c] > 0 ? ` (${counts[c]})` : ""}
                {suggestedCategories?.includes(c) ? " — sugerida" : ""}
              </option>
            ))}
          </select>
        </div>
        <button className="btn ghost" style={{ color: "var(--bad)" }} onClick={onDelete}>
          <Trash2 size={14} /> Eliminar esta evaluación
        </button>
      </div>

      {active === "body" && <BodySection assessmentId={assessment.id} body={body} onSaved={setBody} />}
      {active === "circumferences" && <CircumferencesSection assessmentId={assessment.id} rows={circs} setRows={setCircs} />}
      {active === "skinfolds" && <SkinfoldsSection assessmentId={assessment.id} rows={skinfolds} setRows={setSkinfolds} />}
      {active === "strength" && <StrengthSection assessmentId={assessment.id} rows={strength} setRows={setStrength} exercises={exercises} />}
      {active === "power" && <PowerSection assessmentId={assessment.id} rows={power} setRows={setPower} />}
      {active === "endurance" && <EnduranceSection assessmentId={assessment.id} rows={endurance} setRows={setEndurance} />}
      {active === "mobility" && <MobilitySection assessmentId={assessment.id} rows={mobility} setRows={setMobility} />}
      {active === "flexibility" && <FlexibilitySection assessmentId={assessment.id} rows={flexibility} setRows={setFlexibility} />}
    </div>
  );
}

function BodySection({ assessmentId, body, onSaved }: { assessmentId: string; body: BodyMeasurementRow | null; onSaved: (b: BodyMeasurementRow) => void }) {
  const { notify } = useToast();
  const [weight, setWeight] = useState(body?.weight_kg != null ? String(body.weight_kg) : "");
  const [height, setHeight] = useState(body?.height_cm != null ? String(body.height_cm) : "");
  const [bodyFat, setBodyFat] = useState(body?.body_fat_pct != null ? String(body.body_fat_pct) : "");
  const [muscleMass, setMuscleMass] = useState(body?.muscle_mass_kg != null ? String(body.muscle_mass_kg) : "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!weight) {
      notify("El peso es obligatorio para guardar los datos corporales.");
      return;
    }
    setSaving(true);
    try {
      const saved = await upsertBodyMeasurement(assessmentId, body?.id, {
        weight_kg: Number(weight.replace(",", ".")),
        height_cm: height ? Number(height.replace(",", ".")) : null,
        body_fat_pct: bodyFat ? Number(bodyFat.replace(",", ".")) : null,
        muscle_mass_kg: muscleMass ? Number(muscleMass.replace(",", ".")) : null,
      });
      onSaved(saved);
      notify("Datos corporales guardados.");
    } catch (e: any) {
      notify(e.message);
    }
    setSaving(false);
  };

  return (
    <div className="panel">
      <div className="hd"><h3>Datos corporales</h3></div>
      <div className="bd">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 14 }}>
          <div><label className="field-label">Peso (kg)</label><input className="input" value={weight} onChange={(e) => setWeight(e.target.value)} /></div>
          <div><label className="field-label">Estatura (cm)</label><input className="input" value={height} onChange={(e) => setHeight(e.target.value)} /></div>
          <div><label className="field-label">% grasa corporal</label><input className="input" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} /></div>
          <div><label className="field-label">Masa muscular (kg)</label><input className="input" value={muscleMass} onChange={(e) => setMuscleMass(e.target.value)} /></div>
        </div>
        <button className="btn" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar datos corporales"}</button>
      </div>
    </div>
  );
}

function CircumferencesSection({ assessmentId, rows, setRows }: { assessmentId: string; rows: CircumferenceRow[]; setRows: Dispatch<SetStateAction<CircumferenceRow[]>> }) {
  const { notify } = useToast();
  const [site, setSite] = useState<CircumferenceSite>("waist");
  const [customLabel, setCustomLabel] = useState("");
  const [side, setSide] = useState<CircumferenceRow["side"]>("none");
  const [value, setValue] = useState("");

  const add = async () => {
    if (!value) return notify("Escribe el valor en centímetros.");
    try {
      const created = await addCircumference({ assessmentId, site, customLabel, side, valueCm: Number(value.replace(",", ".")) });
      setRows((rs) => [...rs, created]);
      setValue("");
      setCustomLabel("");
    } catch (e: any) {
      notify(e.message);
    }
  };

  return (
    <div className="panel">
      <div className="hd"><h3>Circunferencias</h3></div>
      <div className="bd">
        {rows.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginBottom: 14 }}>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "6px 4px" }}>{c.site === "custom" ? c.custom_label : SITE_LABEL[c.site]}</td>
                  <td style={{ padding: "6px 4px" }}>{c.side !== "none" ? (c.side === "left" ? "Izquierda" : "Derecha") : ""}</td>
                  <td style={{ padding: "6px 4px" }}>{c.value_cm} cm</td>
                  <td style={{ padding: "6px 4px", textAlign: "right" }}>
                    <button aria-label={`Quitar ${c.site}`} onClick={async () => { await deleteCircumference(c.id); setRows((rs) => rs.filter((x) => x.id !== c.id)); }} style={{ border: 0, background: "none", color: "var(--muted)", cursor: "pointer" }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <div>
            <label className="field-label">Zona</label>
            <select className="input" value={site} onChange={(e) => setSite(e.target.value as CircumferenceSite)}>
              {Object.entries(SITE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          {site === "custom" && (
            <div><label className="field-label">Nombre de la zona</label><input className="input" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} /></div>
          )}
          <div>
            <label className="field-label">Lado</label>
            <select className="input" value={side} onChange={(e) => setSide(e.target.value as CircumferenceRow["side"])}>
              <option value="none">No aplica</option>
              <option value="left">Izquierda</option>
              <option value="right">Derecha</option>
            </select>
          </div>
          <div><label className="field-label">Valor (cm)</label><input className="input" style={{ maxWidth: 100 }} value={value} onChange={(e) => setValue(e.target.value)} /></div>
          <button className="btn ghost" onClick={add}><Plus size={14} /> Añadir</button>
        </div>
      </div>
    </div>
  );
}

function SkinfoldsSection({ assessmentId, rows, setRows }: { assessmentId: string; rows: SkinfoldRow[]; setRows: Dispatch<SetStateAction<SkinfoldRow[]>> }) {
  const { notify } = useToast();
  const [site, setSite] = useState(SKINFOLD_SITES[0]);
  const [side, setSide] = useState<SkinfoldRow["side"]>(null);
  const [value, setValue] = useState("");
  const [protocol, setProtocol] = useState("");

  const add = async () => {
    if (!value) return notify("Escribe el valor en milímetros.");
    try {
      const created = await addSkinfold({ assessmentId, site, side, valueMm: Number(value.replace(",", ".")), protocol });
      setRows((rs) => [...rs, created]);
      setValue("");
    } catch (e: any) {
      notify(e.message);
    }
  };

  return (
    <div className="panel">
      <div className="hd"><h3>Pliegues cutáneos</h3></div>
      <div className="bd">
        {rows.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginBottom: 14 }}>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "6px 4px" }}>{s.site}</td>
                  <td style={{ padding: "6px 4px" }}>{s.side ? (s.side === "left" ? "Izquierda" : "Derecha") : ""}</td>
                  <td style={{ padding: "6px 4px" }}>{s.value_mm} mm</td>
                  <td style={{ padding: "6px 4px", textAlign: "right" }}>
                    <button aria-label={`Quitar ${s.site}`} onClick={async () => { await deleteSkinfold(s.id); setRows((rs) => rs.filter((x) => x.id !== s.id)); }} style={{ border: 0, background: "none", color: "var(--muted)", cursor: "pointer" }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <div>
            <label className="field-label">Zona</label>
            <select className="input" value={site} onChange={(e) => setSite(e.target.value)}>
              {SKINFOLD_SITES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Lado</label>
            <select className="input" value={side ?? ""} onChange={(e) => setSide((e.target.value || null) as SkinfoldRow["side"])}>
              <option value="">No aplica</option>
              <option value="left">Izquierda</option>
              <option value="right">Derecha</option>
            </select>
          </div>
          <div><label className="field-label">Valor (mm)</label><input className="input" style={{ maxWidth: 100 }} value={value} onChange={(e) => setValue(e.target.value)} /></div>
          <div><label className="field-label">Protocolo (opcional)</label><input className="input" placeholder="Ej. Jackson-Pollock 3" value={protocol} onChange={(e) => setProtocol(e.target.value)} /></div>
          <button className="btn ghost" onClick={add}><Plus size={14} /> Añadir</button>
        </div>
      </div>
    </div>
  );
}

function StrengthSection({ assessmentId, rows, setRows, exercises }: { assessmentId: string; rows: StrengthTestRow[]; setRows: Dispatch<SetStateAction<StrengthTestRow[]>>; exercises: ExerciseRow[] }) {
  const { notify } = useToast();
  const [exerciseId, setExerciseId] = useState("");
  const [load, setLoad] = useState("");
  const [reps, setReps] = useState("1");

  const add = async () => {
    if (!exerciseId || !load) return notify("Elige el ejercicio y la carga usada.");
    try {
      const created = await addStrengthTest({ assessmentId, exerciseId, loadKg: Number(load.replace(",", ".")), reps: Number(reps) || 1 });
      setRows((rs) => [...rs, created]);
      setLoad("");
      setReps("1");
    } catch (e: any) {
      notify(e.message);
    }
  };

  return (
    <div className="panel">
      <div className="hd"><h3>Pruebas de fuerza</h3></div>
      <div className="bd">
        <p className="note" style={{ marginBottom: 14 }}>Si hiciste un 1RM directo, pon 1 repetición. Si no, estimamos el 1RM con la fórmula de Epley.</p>
        {rows.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginBottom: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12.5 }}>
                <th style={{ padding: "4px" }}>Ejercicio</th><th style={{ padding: "4px" }}>Carga</th><th style={{ padding: "4px" }}>Reps</th><th style={{ padding: "4px" }}>1RM estimado</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "6px 4px" }}>{s.exercise_name}</td>
                  <td style={{ padding: "6px 4px" }}>{s.load_kg} kg</td>
                  <td style={{ padding: "6px 4px" }}>{s.reps}</td>
                  <td style={{ padding: "6px 4px" }}><b>{s.estimated_1rm} kg</b>{s.is_direct_1rm ? " (directo)" : ""}</td>
                  <td style={{ padding: "6px 4px", textAlign: "right" }}>
                    <button aria-label={`Quitar ${s.exercise_name}`} onClick={async () => { await deleteStrengthTest(s.id); setRows((rs) => rs.filter((x) => x.id !== s.id)); }} style={{ border: 0, background: "none", color: "var(--muted)", cursor: "pointer" }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <div style={{ minWidth: 200 }}>
            <label className="field-label">Ejercicio</label>
            <select className="input" value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
              <option value="">Elige uno</option>
              {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div><label className="field-label">Carga (kg)</label><input className="input" style={{ maxWidth: 100 }} value={load} onChange={(e) => setLoad(e.target.value)} /></div>
          <div><label className="field-label">Repeticiones</label><input className="input" style={{ maxWidth: 90 }} value={reps} onChange={(e) => setReps(e.target.value)} /></div>
          <button className="btn ghost" onClick={add}><Plus size={14} /> Añadir</button>
        </div>
      </div>
    </div>
  );
}

function PowerSection({ assessmentId, rows, setRows }: { assessmentId: string; rows: PowerTestRow[]; setRows: Dispatch<SetStateAction<PowerTestRow[]>> }) {
  const { notify } = useToast();
  const [testType, setTestType] = useState<PowerTestType>("vertical_jump");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("cm");
  const [implementWeight, setImplementWeight] = useState("");

  const add = async () => {
    if (!value) return notify("Escribe el resultado de la prueba.");
    try {
      const created = await addPowerTest({ assessmentId, testType, value: Number(value.replace(",", ".")), unit, implementWeightKg: implementWeight ? Number(implementWeight.replace(",", ".")) : null });
      setRows((rs) => [...rs, created]);
      setValue("");
    } catch (e: any) {
      notify(e.message);
    }
  };

  return (
    <div className="panel">
      <div className="hd"><h3>Pruebas de potencia</h3></div>
      <div className="bd">
        {rows.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginBottom: 14 }}>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "6px 4px" }}>{POWER_TEST_LABEL[p.test_type]}</td>
                  <td style={{ padding: "6px 4px" }}><b>{p.value} {p.unit}</b></td>
                  <td style={{ padding: "6px 4px", textAlign: "right" }}>
                    <button aria-label="Quitar prueba" onClick={async () => { await deletePowerTest(p.id); setRows((rs) => rs.filter((x) => x.id !== p.id)); }} style={{ border: 0, background: "none", color: "var(--muted)", cursor: "pointer" }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <div>
            <label className="field-label">Tipo de prueba</label>
            <select className="input" value={testType} onChange={(e) => setTestType(e.target.value as PowerTestType)}>
              {Object.entries(POWER_TEST_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div><label className="field-label">Resultado</label><input className="input" style={{ maxWidth: 100 }} value={value} onChange={(e) => setValue(e.target.value)} /></div>
          <div><label className="field-label">Unidad</label><input className="input" style={{ maxWidth: 80 }} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="cm, W, m…" /></div>
          <div><label className="field-label">Peso del implemento (kg, opcional)</label><input className="input" style={{ maxWidth: 120 }} value={implementWeight} onChange={(e) => setImplementWeight(e.target.value)} /></div>
          <button className="btn ghost" onClick={add}><Plus size={14} /> Añadir</button>
        </div>
      </div>
    </div>
  );
}

function EnduranceSection({ assessmentId, rows, setRows }: { assessmentId: string; rows: EnduranceTestRow[]; setRows: Dispatch<SetStateAction<EnduranceTestRow[]>> }) {
  const { notify } = useToast();
  const [testType, setTestType] = useState("");
  const [distance, setDistance] = useState("");
  const [time, setTime] = useState("");
  const [hrAvg, setHrAvg] = useState("");
  const [hrMax, setHrMax] = useState("");

  const add = async () => {
    if (!testType.trim()) return notify("Escribe el nombre de la prueba.");
    try {
      const created = await addEnduranceTest({
        assessmentId,
        testType: testType.trim(),
        distanceM: distance ? Number(distance.replace(",", ".")) : null,
        timeS: time ? Number(time.replace(",", ".")) : null,
        hrAvg: hrAvg ? Number(hrAvg) : null,
        hrMax: hrMax ? Number(hrMax) : null,
      });
      setRows((rs) => [...rs, created]);
      setTestType("");
      setDistance("");
      setTime("");
    } catch (e: any) {
      notify(e.message);
    }
  };

  return (
    <div className="panel">
      <div className="hd"><h3>Pruebas de resistencia</h3></div>
      <div className="bd">
        {rows.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginBottom: 14 }}>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "6px 4px" }}>{t.test_type}</td>
                  <td style={{ padding: "6px 4px" }}>{t.distance_m ? `${t.distance_m} m` : ""}{t.time_s ? ` · ${t.time_s} s` : ""}</td>
                  <td style={{ padding: "6px 4px" }}>{t.hr_avg ? `FC prom. ${t.hr_avg}` : ""}{t.hr_max ? ` · FC máx ${t.hr_max}` : ""}</td>
                  <td style={{ padding: "6px 4px", textAlign: "right" }}>
                    <button aria-label="Quitar prueba" onClick={async () => { await deleteEnduranceTest(t.id); setRows((rs) => rs.filter((x) => x.id !== t.id)); }} style={{ border: 0, background: "none", color: "var(--muted)", cursor: "pointer" }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <div><label className="field-label">Nombre de la prueba</label><input className="input" placeholder="Ej. Test de Cooper" value={testType} onChange={(e) => setTestType(e.target.value)} /></div>
          <div><label className="field-label">Distancia (m)</label><input className="input" style={{ maxWidth: 100 }} value={distance} onChange={(e) => setDistance(e.target.value)} /></div>
          <div><label className="field-label">Tiempo (s)</label><input className="input" style={{ maxWidth: 100 }} value={time} onChange={(e) => setTime(e.target.value)} /></div>
          <div><label className="field-label">FC promedio</label><input className="input" style={{ maxWidth: 90 }} value={hrAvg} onChange={(e) => setHrAvg(e.target.value)} /></div>
          <div><label className="field-label">FC máxima</label><input className="input" style={{ maxWidth: 90 }} value={hrMax} onChange={(e) => setHrMax(e.target.value)} /></div>
          <button className="btn ghost" onClick={add}><Plus size={14} /> Añadir</button>
        </div>
      </div>
    </div>
  );
}

function MobilitySection({ assessmentId, rows, setRows }: { assessmentId: string; rows: MobilityTestRow[]; setRows: Dispatch<SetStateAction<MobilityTestRow[]>> }) {
  const { notify } = useToast();
  const [joint, setJoint] = useState(MOBILITY_JOINTS[0]);
  const [movement, setMovement] = useState("");
  const [side, setSide] = useState<MobilityTestRow["side"]>(null);
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState<MobilityTestRow["unit"]>("degrees");

  const add = async () => {
    if (!movement.trim() || !value) return notify("Completa el movimiento y el valor.");
    try {
      const created = await addMobilityTest({ assessmentId, joint, movement: movement.trim(), side, value: Number(value.replace(",", ".")), unit });
      setRows((rs) => [...rs, created]);
      setMovement("");
      setValue("");
    } catch (e: any) {
      notify(e.message);
    }
  };

  return (
    <div className="panel">
      <div className="hd"><h3>Movilidad</h3></div>
      <div className="bd">
        {rows.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginBottom: 14 }}>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "6px 4px" }}>{m.joint} — {m.movement}</td>
                  <td style={{ padding: "6px 4px" }}>{m.side ? (m.side === "both" ? "Ambos lados" : m.side === "left" ? "Izquierda" : "Derecha") : ""}</td>
                  <td style={{ padding: "6px 4px" }}><b>{m.value} {m.unit === "degrees" ? "°" : m.unit}</b></td>
                  <td style={{ padding: "6px 4px", textAlign: "right" }}>
                    <button aria-label="Quitar prueba" onClick={async () => { await deleteMobilityTest(m.id); setRows((rs) => rs.filter((x) => x.id !== m.id)); }} style={{ border: 0, background: "none", color: "var(--muted)", cursor: "pointer" }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <div>
            <label className="field-label">Articulación</label>
            <select className="input" value={joint} onChange={(e) => setJoint(e.target.value)}>
              {MOBILITY_JOINTS.map((j) => <option key={j}>{j}</option>)}
            </select>
          </div>
          <div><label className="field-label">Movimiento</label><input className="input" placeholder="Ej. Flexión, rotación externa" value={movement} onChange={(e) => setMovement(e.target.value)} /></div>
          <div>
            <label className="field-label">Lado</label>
            <select className="input" value={side ?? ""} onChange={(e) => setSide((e.target.value || null) as MobilityTestRow["side"])}>
              <option value="">No aplica</option>
              <option value="left">Izquierda</option>
              <option value="right">Derecha</option>
              <option value="both">Ambos lados</option>
            </select>
          </div>
          <div><label className="field-label">Valor</label><input className="input" style={{ maxWidth: 90 }} value={value} onChange={(e) => setValue(e.target.value)} /></div>
          <div>
            <label className="field-label">Unidad</label>
            <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as MobilityTestRow["unit"])}>
              <option value="degrees">Grados</option>
              <option value="cm">Centímetros</option>
              <option value="score">Puntaje</option>
            </select>
          </div>
          <button className="btn ghost" onClick={add}><Plus size={14} /> Añadir</button>
        </div>
      </div>
    </div>
  );
}

function FlexibilitySection({ assessmentId, rows, setRows }: { assessmentId: string; rows: FlexibilityTestRow[]; setRows: Dispatch<SetStateAction<FlexibilityTestRow[]>> }) {
  const { notify } = useToast();
  const [testName, setTestName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [side, setSide] = useState<FlexibilityTestRow["side"]>(null);
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState<FlexibilityTestRow["unit"]>("cm");

  const add = async () => {
    if (!testName.trim() || !value) return notify("Completa el nombre de la prueba y el valor.");
    try {
      const created = await addFlexibilityTest({ assessmentId, testName: testName.trim(), muscleGroup, side, value: Number(value.replace(",", ".")), unit });
      setRows((rs) => [...rs, created]);
      setTestName("");
      setValue("");
    } catch (e: any) {
      notify(e.message);
    }
  };

  return (
    <div className="panel">
      <div className="hd"><h3>Flexibilidad</h3></div>
      <div className="bd">
        {rows.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginBottom: 14 }}>
            <tbody>
              {rows.map((f) => (
                <tr key={f.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "6px 4px" }}>{f.test_name}{f.muscle_group ? ` (${f.muscle_group})` : ""}</td>
                  <td style={{ padding: "6px 4px" }}>{f.side ? (f.side === "both" ? "Ambos lados" : f.side === "left" ? "Izquierda" : "Derecha") : ""}</td>
                  <td style={{ padding: "6px 4px" }}><b>{f.value} {f.unit === "degrees" ? "°" : f.unit}</b></td>
                  <td style={{ padding: "6px 4px", textAlign: "right" }}>
                    <button aria-label="Quitar prueba" onClick={async () => { await deleteFlexibilityTest(f.id); setRows((rs) => rs.filter((x) => x.id !== f.id)); }} style={{ border: 0, background: "none", color: "var(--muted)", cursor: "pointer" }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <div><label className="field-label">Nombre de la prueba</label><input className="input" placeholder="Ej. Sit and reach" value={testName} onChange={(e) => setTestName(e.target.value)} /></div>
          <div><label className="field-label">Grupo muscular (opcional)</label><input className="input" value={muscleGroup} onChange={(e) => setMuscleGroup(e.target.value)} /></div>
          <div>
            <label className="field-label">Lado</label>
            <select className="input" value={side ?? ""} onChange={(e) => setSide((e.target.value || null) as FlexibilityTestRow["side"])}>
              <option value="">No aplica</option>
              <option value="left">Izquierda</option>
              <option value="right">Derecha</option>
              <option value="both">Ambos lados</option>
            </select>
          </div>
          <div><label className="field-label">Valor</label><input className="input" style={{ maxWidth: 90 }} value={value} onChange={(e) => setValue(e.target.value)} /></div>
          <div>
            <label className="field-label">Unidad</label>
            <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as FlexibilityTestRow["unit"])}>
              <option value="cm">Centímetros</option>
              <option value="degrees">Grados</option>
              <option value="score">Puntaje</option>
            </select>
          </div>
          <button className="btn ghost" onClick={add}><Plus size={14} /> Añadir</button>
        </div>
      </div>
    </div>
  );
}
