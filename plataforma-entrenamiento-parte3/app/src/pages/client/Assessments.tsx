import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useToast } from "../../contexts/ToastContext";
import Chip from "../../components/ui/Chip";
import Modal from "../../components/ui/Modal";
import { getMyClientId, getClient } from "../../services/clients";
import {
  listAssessments,
  getBodyMeasurement,
  listCircumferences,
  listStrengthTests,
  listSkinfolds,
  sumSkinfolds8,
  createAssessment,
  upsertBodyMeasurement,
  addCircumference,
  TYPE_LABEL,
  SITE_LABEL,
  type AssessmentRow,
  type BodyMeasurementRow,
  type CircumferenceRow,
  type StrengthTestRow,
  type SkinfoldRow,
  type CircumferenceSite,
} from "../../services/assessments";
import Loading from "../../components/ui/Loading";

const SELF_REPORT_SITES: CircumferenceSite[] = ["neck", "waist", "hip", "arm", "forearm", "thigh", "chest"];

export default function ClientAssessments() {
  const { notify } = useToast();
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [body, setBody] = useState<BodyMeasurementRow | null>(null);
  const [circs, setCircs] = useState<CircumferenceRow[]>([]);
  const [strength, setStrength] = useState<StrengthTestRow[]>([]);
  const [skinfolds, setSkinfolds] = useState<SkinfoldRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [clientId, setClientId] = useState("");
  const [showSelfReport, setShowSelfReport] = useState(false);

  const reload = async (cId: string) => {
    const list = await listAssessments(cId);
    setAssessments(list);
    setSelectedId(list[0]?.id ?? "");
  };

  useEffect(() => {
    (async () => {
      try {
        const cId = await getMyClientId();
        if (!cId) {
          setLoading(false);
          return;
        }
        setClientId(cId);
        await reload(cId);
      } catch (e: any) {
        notify(e.message);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoadingDetail(true);
    Promise.all([getBodyMeasurement(selectedId), listCircumferences(selectedId), listStrengthTests(selectedId), listSkinfolds(selectedId)])
      .then(([b, c, s, sf]) => {
        setBody(b);
        setCircs(c);
        setStrength(s);
        setSkinfolds(sf);
      })
      .catch((e: any) => notify(e.message))
      .finally(() => setLoadingDetail(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>Mis evaluaciones</h1>
        {clientId && (
          <button className="btn" onClick={() => setShowSelfReport(true)}>
            <Plus size={16} /> Registrar mis medidas
          </button>
        )}
      </div>

      {loading ? (
        <Loading />
      ) : assessments.length === 0 ? (
        <p className="note">Todavía no tienes evaluaciones registradas.</p>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
            {assessments.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                className="chip"
                style={{ cursor: "pointer", border: "1px solid var(--line)", background: a.id === selectedId ? "var(--pri)" : "#fff", color: a.id === selectedId ? "#fff" : "var(--muted)" }}
              >
                {new Date(a.assessed_at).toLocaleDateString("es")}
              </button>
            ))}
          </div>

          {loadingDetail ? (
            <Loading />
          ) : (
            <>
              <div className="panel" style={{ marginBottom: 16 }}>
                <div className="hd">
                  <h3>Datos corporales</h3>
                  <Chip tone="pri">{TYPE_LABEL[assessments.find((a) => a.id === selectedId)?.type ?? "periodic"]}</Chip>
                </div>
                <div className="bd">
                  {body ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
                      <div><span className="note">Peso</span><div>{body.weight_kg} kg</div></div>
                      {body.height_cm != null && <div><span className="note">Estatura</span><div>{body.height_cm} cm</div></div>}
                      {body.body_fat_pct != null && <div><span className="note">% grasa corporal</span><div>{body.body_fat_pct}%</div></div>}
                      {body.muscle_mass_kg != null && <div><span className="note">Masa muscular</span><div>{body.muscle_mass_kg} kg</div></div>}
                    </div>
                  ) : (
                    <p className="note">Sin datos corporales en esta evaluación.</p>
                  )}
                </div>
              </div>

              {circs.length > 0 && (
                <div className="panel" style={{ marginBottom: 16 }}>
                  <div className="hd"><h3>Circunferencias</h3></div>
                  <div className="bd">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
                      {circs.map((c) => (
                        <div key={c.id}>
                          <span className="note">{c.site === "custom" ? c.custom_label : SITE_LABEL[c.site]}{c.side !== "none" ? ` (${c.side === "left" ? "izq." : "der."})` : ""}</span>
                          <div>{c.value_cm} cm</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {skinfolds.length > 0 && (
                <div className="panel" style={{ marginBottom: 16 }}>
                  <div className="hd"><h3>Pliegues cutáneos</h3></div>
                  <div className="bd">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 12 }}>
                      {skinfolds.map((s) => (
                        <div key={s.id}>
                          <span className="note">{s.site}{s.side ? ` (${s.side === "left" ? "izq." : "der."})` : ""}</span>
                          <div>{s.value_mm} mm</div>
                        </div>
                      ))}
                    </div>
                    {sumSkinfolds8(skinfolds).complete && (
                      <p className="note">Σ8 (suma de los 8 pliegues): <b>{sumSkinfolds8(skinfolds).sum} mm</b></p>
                    )}
                  </div>
                </div>
              )}

              {strength.length > 0 && (
                <div className="panel">
                  <div className="hd"><h3>Pruebas de fuerza</h3></div>
                  <div className="bd">
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                      <thead>
                        <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12.5 }}>
                          <th style={{ padding: "4px" }}>Ejercicio</th>
                          <th style={{ padding: "4px" }}>1RM estimado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {strength.map((s) => (
                          <tr key={s.id} style={{ borderTop: "1px solid var(--line)" }}>
                            <td style={{ padding: "6px 4px" }}>{s.exercise_name}</td>
                            <td style={{ padding: "6px 4px" }}><b>{s.estimated_1rm} kg</b></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {showSelfReport && (
        <SelfReportModal
          clientId={clientId}
          onClose={() => setShowSelfReport(false)}
          onSaved={async () => {
            setShowSelfReport(false);
            await reload(clientId);
            notify("Tus medidas quedaron registradas.");
          }}
        />
      )}
    </div>
  );
}

function SelfReportModal({ clientId, onClose, onSaved }: { clientId: string; onClose: () => void; onSaved: () => void }) {
  const { notify } = useToast();
  const [weight, setWeight] = useState("");
  const [values, setValues] = useState<Record<CircumferenceSite, string>>({} as Record<CircumferenceSite, string>);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const anyCirc = SELF_REPORT_SITES.some((s) => values[s]);
    if (!weight && !anyCirc) {
      setError("Completa al menos el peso o una medida.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const client = await getClient(clientId);
      const assessment = await createAssessment({
        organizationId: client.organization_id,
        trainerId: client.trainer_id,
        clientId,
        assessedAt: new Date().toISOString().slice(0, 10),
        type: "self_report",
        notes: "Registrado por el cliente",
      });
      if (weight) {
        await upsertBodyMeasurement(assessment.id, undefined, { weight_kg: Number(weight), height_cm: null, body_fat_pct: null, muscle_mass_kg: null });
      }
      for (const site of SELF_REPORT_SITES) {
        if (values[site]) {
          await addCircumference({ assessmentId: assessment.id, site, customLabel: "", side: "none", valueCm: Number(values[site]) });
        }
      }
      onSaved();
    } catch (e: any) {
      setError(e.message ?? "No pudimos guardar tus medidas.");
      setSaving(false);
    }
  };

  return (
    <Modal title="Registrar mis medidas" onClose={onClose}>
      <p className="note" style={{ marginBottom: 16 }}>
        Completá lo que quieras medirte hoy — no hace falta llenar todo. Queda guardado junto al resto de tu historial, para que tu entrenador también lo vea.
      </p>
      <label className="field-label">Peso (kg)</label>
      <input className="input" style={{ marginBottom: 14, maxWidth: 160 }} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        {SELF_REPORT_SITES.map((site) => (
          <div key={site}>
            <label className="field-label">{SITE_LABEL[site]} (cm)</label>
            <input
              className="input"
              inputMode="decimal"
              value={values[site] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [site]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      {error && <p className="error-text" style={{ marginBottom: 12 }}>{error}</p>}
      <button className="btn" onClick={submit} disabled={saving}>{saving ? "Guardando…" : "Guardar mis medidas"}</button>
    </Modal>
  );
}
