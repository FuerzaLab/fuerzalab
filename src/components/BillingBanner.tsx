import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { daysBetween } from "../services/orgBilling";
import { paths } from "../routes/paths";

/**
 * Avisos del cobro de FuerzaLab para el entrenador y su equipo, arriba de
 * cada pantalla: fin de la prueba, pago por vencer y tope de alumnos.
 * (El bloqueo en sí lo muestra BillingBlocked.)
 */
export default function BillingBanner() {
  const { orgBilling: b, profile } = useAuth();
  const navigate = useNavigate();
  if (!b || b.exempt || b.role === "client") return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = (iso: string) => new Date(iso.slice(0, 10) + "T00:00:00");
  const fmt = (iso: string) => d(iso).toLocaleDateString("es", { day: "numeric", month: "long" });
  const msgs: { tone: "warn" | "bad"; text: string }[] = [];

  if (b.trial_ends_at && !b.next_due) {
    const left = daysBetween(today, d(b.trial_ends_at));
    if (left >= 0 && left <= 5)
      msgs.push({
        tone: left <= 1 ? "bad" : "warn",
        text: left === 0 ? "Tu prueba gratis de FuerzaLab termina hoy. Para seguir usándola, elige tu plan." : `Te ${left === 1 ? "queda 1 día" : `quedan ${left} días`} de prueba gratis de FuerzaLab. Para seguir usándola, elige tu plan.`,
      });
  }
  if (b.next_due) {
    const left = daysBetween(today, d(b.next_due.due_date));
    const amount = `${b.next_due.currency} ${Number(b.next_due.amount).toLocaleString("es")}`;
    if (left < 0) msgs.push({ tone: "bad", text: `Tu pago de FuerzaLab (${amount}) venció el ${fmt(b.next_due.due_date)}. Regístralo hoy para que no se suspenda el acceso.` });
    else if (left <= 5)
      msgs.push({
        tone: left <= 1 ? "bad" : "warn",
        text: `Tu pago de FuerzaLab (${amount}) vence ${left === 0 ? "hoy" : left === 1 ? "mañana" : `el ${fmt(b.next_due.due_date)}`}. Si no se registra, al día siguiente se suspende el acceso.`,
      });
  }
  if (b.limit_exceeded_since && b.plan?.client_limit != null) {
    const since = d(b.limit_exceeded_since);
    const left = 7 - daysBetween(since, today);
    msgs.push({
      tone: left <= 0 ? "bad" : "warn",
      text:
        left > 0
          ? `Tienes ${b.counted_clients} alumnos y tu plan permite ${b.plan.client_limit}. Te ${left === 1 ? "queda 1 día" : `quedan ${left} días`} para cambiar de plan; después no vas a poder sumar alumnos nuevos.`
          : `Llegaste al tope de tu plan (${b.plan.client_limit} alumnos): para sumar alumnos nuevos, cambia de plan o da de baja a alguno.`,
    });
  }
  if (msgs.length === 0) return null;

  return (
    <div style={{ display: "grid", gap: 8, maxWidth: 1192, margin: "16px 24px 0" }} className="billing-banners">
      {msgs.map((m) => (
        <div key={m.text} className={`billing-banner ${m.tone}`} role="status">
          <span style={{ flex: 1 }}>{m.text}</span>
          {profile?.role === "trainer" && (
            <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 12.5, flex: "none" }} onClick={() => navigate(paths.trainerSettings + "#mi-plan")}>
              Ver mi plan
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
