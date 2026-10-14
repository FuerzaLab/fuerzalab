import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import Modal from "../../../components/ui/Modal";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import Chip from "../../../components/ui/Chip";
import { listClients, type ClientRow } from "../../../services/clients";
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
  TYPE_LABEL,
  SITE_LABEL,
  type AssessmentRow,
  type AssessmentType,
  type BodyMeasurementRow,
  type CircumferenceRow,
  type CircumferenceSite,
  type StrengthTestRow,
} from "../../../services/assessments";

export default function AssessmentsPage() {
  const { profile } = useAuth();
  const { notify } = useToast();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientId, setClientId] = useState("");
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
    if (clientId) loadAssessments(clientId);
    else {
      setAssessments([]);
      setSelectedId("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const selected = assessments.find((a) => a.id === selectedId) ?? null;

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

function AssessmentDetail({ assessment, onDelete }: { assessment: AssessmentRow; onDelete: () => void }) {
  const { notify } = useToast();
  const [body, setBody] = useState<BodyMeasurementRow | null>(null);
  const [circs, setCircs] = useState<CircumferenceRow[]>([]);
  const [strength, setStrength] = useState<StrengthTestRow[]>([]);
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [muscleMass, setMuscleMass] = useState("");
  const [savingBody, setSavingBody] = useState(false);

  const [circSite, setCircSite] = useState<CircumferenceSite>("waist");
  const [circCustomLabel, setCircCustomLabel] = useState("");
  const [circSide, setCircSide] = useState<CircumferenceRow["side"]>("none");
  const [circValue, setCircValue] = useState("");

  const [strExerciseId, setStrExerciseId] = useState("");
  const [strLoad, setStrLoad] = useState("");
  const [strReps, setStrReps] = useState("1");

  useEffect(() => {
    setLoading(true);
    Promise.all([getBodyMeasurement(assessment.id), listCircumferences(assessment.id), listStrengthTests(assessment.id), listExercises()])
      .then(([b, c, s, ex]) => {
        setBody(b);
        if (b) {
          setWeight(String(b.weight_kg));
          setHeight(b.height_cm != null ? String(b.height_cm) : "");
          setBodyFat(b.body_fat_pct != null ? String(b.body_fat_pct) : "");
          setMuscleMass(b.muscle_mass_kg != null ? String(b.muscle_mass_kg) : "");
        } else {
          setWeight("");
          setHeight("");
          setBodyFat("");
          setMuscleMass("");
        }
        setCircs(c);
        setStrength(s);
        setExercises(ex);
      })
      .catch((e: any) => notify(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessment.id]);

  const saveBody = async () => {
    if (!weight) {
      notify("El peso es obligatorio para guardar los datos corporales.");
      return;
    }
    setSavingBody(true);
    try {
      const saved = await upsertBodyMeasurement(assessment.id, body?.id, {
        weight_kg: Number(weight.replace(",", ".")),
        height_cm: height ? Number(height.replace(",", ".")) : null,
        body_fat_pct: bodyFat ? Number(bodyFat.replace(",", ".")) : null,
        muscle_mass_kg: muscleMass ? Number(muscleMass.replace(",", ".")) : null,
      });
      setBody(saved);
      notify("Datos corporales guardados.");
    } catch (e: any) {
      notify(e.message);
    }
    setSavingBody(false);
  };

  const addCirc = async () => {
    if (!circValue) {
      notify("Escribe el valor en centímetros.");
      return;
    }
    try {
      const created = await addCircumference({
        assessmentId: assessment.id,
        site: circSite,
        customLabel: circCustomLabel,
        side: circSide,
        valueCm: Number(circValue.replace(",", ".")),
      });
      setCircs((cs) => [...cs, created]);
      setCircValue("");
      setCircCustomLabel("");
    } catch (e: any) {
      notify(e.message);
    }
  };

  const addStrength = async () => {
    if (!strExerciseId || !strLoad) {
      notify("Elige el ejercicio y la carga usada.");
      return;
    }
    try {
      const created = await addStrengthTest({
        assessmentId: assessment.id,
        exerciseId: strExerciseId,
        loadKg: Number(strLoad.replace(",", ".")),
        reps: Number(strReps) || 1,
      });
      setStrength((ss) => [...ss, created]);
      setStrLoad("");
      setStrReps("1");
    } catch (e: any) {
      notify(e.message);
    }
  };

  if (loading) return <p className="note">Cargando…</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button className="btn ghost" style={{ color: "var(--bad)" }} onClick={onDelete}>
          <Trash2 size={14} /> Eliminar esta evaluación
        </button>
      </div>

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="hd"><h3>Datos corporales</h3></div>
        <div className="bd">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 14 }}>
            <div>
              <label className="field-label">Peso (kg)</label>
              <input className="input" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Estatura (cm)</label>
              <input className="input" value={height} onChange={(e) => setHeight(e.target.value)} />
            </div>
            <div>
              <label className="field-label">% grasa corporal</label>
              <input className="input" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Masa muscular (kg)</label>
              <input className="input" value={muscleMass} onChange={(e) => setMuscleMass(e.target.value)} />
            </div>
          </div>
          <button className="btn" onClick={saveBody} disabled={savingBody}>{savingBody ? "Guardando…" : "Guardar datos corporales"}</button>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="hd"><h3>Circunferencias</h3></div>
        <div className="bd">
          {circs.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginBottom: 14 }}>
              <tbody>
                {circs.map((c) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "6px 4px" }}>{c.site === "custom" ? c.custom_label : SITE_LABEL[c.site]}</td>
                    <td style={{ padding: "6px 4px" }}>{c.side !== "none" ? (c.side === "left" ? "Izquierda" : "Derecha") : ""}</td>
                    <td style={{ padding: "6px 4px" }}>{c.value_cm} cm</td>
                    <td style={{ padding: "6px 4px", textAlign: "right" }}>
                      <button
                        aria-label={`Quitar ${SITE_LABEL[c.site]}`}
                        onClick={async () => {
                          await deleteCircumference(c.id);
                          setCircs((cs) => cs.filter((x) => x.id !== c.id));
                        }}
                        style={{ border: 0, background: "none", color: "var(--muted)", cursor: "pointer" }}
                      >
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
              <select className="input" value={circSite} onChange={(e) => setCircSite(e.target.value as CircumferenceSite)}>
                {Object.entries(SITE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            {circSite === "custom" && (
              <div>
                <label className="field-label">Nombre de la zona</label>
                <input className="input" value={circCustomLabel} onChange={(e) => setCircCustomLabel(e.target.value)} />
              </div>
            )}
            <div>
              <label className="field-label">Lado</label>
              <select className="input" value={circSide} onChange={(e) => setCircSide(e.target.value as CircumferenceRow["side"])}>
                <option value="none">No aplica</option>
                <option value="left">Izquierda</option>
                <option value="right">Derecha</option>
              </select>
            </div>
            <div>
              <label className="field-label">Valor (cm)</label>
              <input className="input" style={{ maxWidth: 100 }} value={circValue} onChange={(e) => setCircValue(e.target.value)} />
            </div>
            <button className="btn ghost" onClick={addCirc}><Plus size={14} /> Añadir</button>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="hd"><h3>Pruebas de fuerza</h3></div>
        <div className="bd">
          <p className="note" style={{ marginBottom: 14 }}>
            Si hiciste un 1RM directo, pon 1 repetición. Si no, pon las repeticiones reales y estimamos el 1RM con la fórmula de Epley.
          </p>
          {strength.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginBottom: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12.5 }}>
                  <th style={{ padding: "4px" }}>Ejercicio</th>
                  <th style={{ padding: "4px" }}>Carga</th>
                  <th style={{ padding: "4px" }}>Reps</th>
                  <th style={{ padding: "4px" }}>1RM estimado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {strength.map((s) => (
                  <tr key={s.id} style={{ borderTop: "1px solid var(--line)" }}>
                    <td style={{ padding: "6px 4px" }}>{s.exercise_name}</td>
                    <td style={{ padding: "6px 4px" }}>{s.load_kg} kg</td>
                    <td style={{ padding: "6px 4px" }}>{s.reps}</td>
                    <td style={{ padding: "6px 4px" }}><b>{s.estimated_1rm} kg</b>{s.is_direct_1rm ? " (directo)" : ""}</td>
                    <td style={{ padding: "6px 4px", textAlign: "right" }}>
                      <button
                        aria-label={`Quitar ${s.exercise_name}`}
                        onClick={async () => {
                          await deleteStrengthTest(s.id);
                          setStrength((ss) => ss.filter((x) => x.id !== s.id));
                        }}
                        style={{ border: 0, background: "none", color: "var(--muted)", cursor: "pointer" }}
                      >
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
              <select className="input" value={strExerciseId} onChange={(e) => setStrExerciseId(e.target.value)}>
                <option value="">Elige uno</option>
                {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Carga (kg)</label>
              <input className="input" style={{ maxWidth: 100 }} value={strLoad} onChange={(e) => setStrLoad(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Repeticiones</label>
              <input className="input" style={{ maxWidth: 90 }} value={strReps} onChange={(e) => setStrReps(e.target.value)} />
            </div>
            <button className="btn ghost" onClick={addStrength}><Plus size={14} /> Añadir</button>
          </div>
        </div>
      </div>
    </div>
  );
}
