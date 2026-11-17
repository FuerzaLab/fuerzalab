import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { paths } from "../routes/paths";
import { fmtDate, studentPlanState } from "../services/studentBilling";

/** Aviso arriba de cada pantalla del alumno: su plan de FuerzaLab vence pronto o ya venció (part4q). */
export default function StudentPlanBanner() {
  const { orgBilling } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  if (orgBilling?.role !== "client" || pathname === paths.clientPlan) return null;
  const s = studentPlanState(orgBilling);
  if (orgBilling.student_pending_payment) return null; // ya mandó el comprobante
  let tone: "warn" | "bad" | null = null;
  let text = "";
  if (s.kind === "soon") {
    tone = s.daysLeft <= 1 ? "bad" : "warn";
    text = s.daysLeft === 0 ? "Tu plan de FuerzaLab vence hoy." : `Tu plan de FuerzaLab vence el ${fmtDate(s.until)} (${s.daysLeft === 1 ? "mañana" : `en ${s.daysLeft} días`}).`;
  } else if (s.kind === "grace") {
    tone = "bad";
    text = `Tu plan de FuerzaLab venció el ${fmtDate(s.until)}. Paga ${s.graceLeft === 0 ? "hoy" : `en los próximos ${s.graceLeft === 1 ? "día" : `${s.graceLeft} días`}`} para que no se pause tu acceso.`;
  }
  if (!tone) return null;
  return (
    <div style={{ display: "grid", gap: 8, maxWidth: 1192, margin: "16px 24px 0" }} className="billing-banners">
      <div className={`billing-banner ${tone}`} role="status">
        <span style={{ flex: 1 }}>{text}</span>
        <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 12.5, flex: "none" }} onClick={() => navigate(paths.clientPlan)}>
          Pagar mi plan
        </button>
      </div>
    </div>
  );
}
