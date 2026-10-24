import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../../contexts/ToastContext";
import Chip from "../../../components/ui/Chip";
import { paths } from "../../../routes/paths";
import { computeSuggestions, TYPE_LABEL, type Suggestion, type SuggestionType } from "../../../services/suggestions";
import Loading from "../../../components/ui/Loading";

const SEVERITY_TONE: Record<Suggestion["severity"], "bad" | "warn" | "pri"> = { urgent: "bad", review: "warn", info: "pri" };
const SEVERITY_LABEL: Record<Suggestion["severity"], string> = { urgent: "Urgente", review: "Revisar", info: "Info" };

const TYPE_DESTINATION: Record<SuggestionType, string> = {
  no_logs: paths.trainerBuilder,
  low_adherence: paths.trainerReports,
  stagnation: paths.trainerReports,
  wellness_risk: paths.trainerWellness,
  assessment_due: paths.trainerAssessments,
  payment_overdue: paths.trainerPayments,
};

export default function SuggestionsPage() {
  const { notify } = useToast();
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SuggestionType | "all">("all");

  const load = async () => {
    setLoading(true);
    try {
      setSuggestions(await computeSuggestions());
    } catch (e: any) {
      notify(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const urgentCount = suggestions.filter((s) => s.severity === "urgent").length;
  const visible = filter === "all" ? suggestions : suggestions.filter((s) => s.type === filter);
  const typesPresent = [...new Set(suggestions.map((s) => s.type))];

  return (
    <div className="page">
      <h1 style={{ marginBottom: 4 }}>Sugerencias</h1>
      <p className="note" style={{ marginBottom: 20 }}>
        Alertas calculadas al momento a partir de los entrenamientos, el bienestar, las evaluaciones y los pagos de tus clientes activos. No se guardan en ningún lado — siempre reflejan el estado actual.
      </p>

      {loading ? (
        <Loading />
      ) : suggestions.length === 0 ? (
        <p className="note">No hay nada para revisar por ahora. 🟢</p>
      ) : (
        <>
          {urgentCount > 0 && (
            <div className="panel" style={{ marginBottom: 18, borderLeft: "4px solid var(--bad)" }}>
              <div className="bd"><b>{urgentCount} urgente{urgentCount === 1 ? "" : "s"}</b> entre las {suggestions.length} sugerencias de hoy.</div>
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
            <button
              onClick={() => setFilter("all")}
              className="chip"
              style={{ cursor: "pointer", border: "1px solid var(--line)", background: filter === "all" ? "var(--pri)" : "#fff", color: filter === "all" ? "#fff" : "var(--muted)" }}
            >
              Todas ({suggestions.length})
            </button>
            {typesPresent.map((t) => {
              const count = suggestions.filter((s) => s.type === t).length;
              return (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className="chip"
                  style={{ cursor: "pointer", border: "1px solid var(--line)", background: filter === t ? "var(--pri)" : "#fff", color: filter === t ? "#fff" : "var(--muted)" }}
                >
                  {TYPE_LABEL[t]} ({count})
                </button>
              );
            })}
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {visible.map((s, i) => (
              <div key={i} className="panel" style={{ margin: 0 }}>
                <div className="bd" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <b>{s.clientName}</b>
                      <Chip tone={SEVERITY_TONE[s.severity]}>{SEVERITY_LABEL[s.severity]}</Chip>
                    </div>
                    <div className="note" style={{ marginBottom: 2 }}>{TYPE_LABEL[s.type]}</div>
                    <div>{s.detail}</div>
                  </div>
                  <button className="btn ghost" style={{ padding: "6px 14px", fontSize: 13 }} onClick={() => navigate(TYPE_DESTINATION[s.type])}>
                    Revisar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
