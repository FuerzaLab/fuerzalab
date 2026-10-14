import { useEffect, useState } from "react";
import { useToast } from "../../contexts/ToastContext";
import Chip from "../../components/ui/Chip";
import { getMyClientId } from "../../services/clients";
import {
  listAssessments,
  getBodyMeasurement,
  listCircumferences,
  listStrengthTests,
  listSkinfolds,
  sumSkinfolds8,
  TYPE_LABEL,
  SITE_LABEL,
  type AssessmentRow,
  type BodyMeasurementRow,
  type CircumferenceRow,
  type StrengthTestRow,
  type SkinfoldRow,
} from "../../services/assessments";

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

  useEffect(() => {
    (async () => {
      try {
        const cId = await getMyClientId();
        if (!cId) {
          setLoading(false);
          return;
        }
        const list = await listAssessments(cId);
        setAssessments(list);
        setSelectedId(list[0]?.id ?? "");
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
      <h1 style={{ marginBottom: 20 }}>Mis evaluaciones</h1>

      {loading ? (
        <p className="note">Cargando…</p>
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
            <p className="note">Cargando…</p>
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
    </div>
  );
}
