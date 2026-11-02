import { useAuth } from "../contexts/AuthContext";
import { BILLING_PERIOD_LABEL } from "../services/billing";

const WHATSAPP = (import.meta.env.VITE_CONTACT_WHATSAPP ?? "").replace(/\D/g, "");
const fmt = (iso: string) => new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
const money = (n: number, cur: string) => `${cur} ${Number(n).toLocaleString("es")}`;

/** Configuración → "Mi plan de FuerzaLab" (entrenadores). */
export default function MyPlanPanel() {
  const { orgBilling: b, profile } = useAuth();
  if (!b || profile?.role !== "trainer") return null;

  return (
    <div className="panel" id="mi-plan" style={{ marginBottom: 18, maxWidth: 560 }}>
      <div className="hd"><h3>Mi plan de FuerzaLab</h3></div>
      <div className="bd" style={{ display: "grid", gap: 10 }}>
        {b.exempt ? (
          <p className="note" style={{ margin: 0 }}>Tu organización no tiene cobro.</p>
        ) : (
          <>
            {b.plan ? (
              <div>
                <b style={{ fontSize: 17 }}>{b.plan.name}</b>
                <div className="note">
                  {b.plan.price > 0 && <>{money(b.plan.price, b.plan.currency)} {BILLING_PERIOD_LABEL[b.plan.period as keyof typeof BILLING_PERIOD_LABEL]?.toLowerCase() ?? ""}</>}
                  {b.plan.included_clients != null && b.plan.price > 0 && <>, con {b.plan.included_clients} alumnos incluidos</>}
                  {b.plan.price_per_client > 0 && <>{b.plan.price > 0 ? " + " : ""}{money(b.plan.price_per_client, b.plan.currency)} por cada alumno{b.plan.included_clients ? " extra" : ""}</>}
                </div>
              </div>
            ) : (
              <p className="note" style={{ margin: 0 }}>Todavía no tienes un plan asignado.</p>
            )}
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div>
                <div className="note" style={{ fontSize: 12.5 }}>Alumnos activos</div>
                <b style={{ fontSize: 20 }}>{b.active_clients ?? 0}</b>
                {b.plan?.client_limit != null && <span className="note"> de {b.plan.client_limit}</span>}
              </div>
              {b.estimated_amount != null && b.plan && (
                <div>
                  <div className="note" style={{ fontSize: 12.5 }}>Próximo período, con tus alumnos de hoy</div>
                  <b style={{ fontSize: 20 }}>{money(b.estimated_amount, b.plan.currency)}</b>
                </div>
              )}
              {b.next_due && (
                <div>
                  <div className="note" style={{ fontSize: 12.5 }}>Próximo pago</div>
                  <b style={{ fontSize: 20 }}>{money(b.next_due.amount, b.next_due.currency)}</b>
                  <div className="note" style={{ fontSize: 12.5 }}>vence el {fmt(b.next_due.due_date)}</div>
                </div>
              )}
            </div>
            {b.trial_ends_at && !b.next_due && new Date(b.trial_ends_at) > new Date() && (
              <p className="note" style={{ margin: 0 }}>Estás en tu prueba gratis hasta el <b>{fmt(b.trial_ends_at)}</b>.</p>
            )}
            <p className="note" style={{ fontSize: 12.5, margin: 0 }}>
              Si un pago vence y no se registra, al día siguiente se suspende el acceso tuyo y de tu equipo; tus alumnos siguen
              entrenando 7 días más. Se reactiva apenas se registra el pago.
            </p>
            {WHATSAPP && (
              <a className="btn" style={{ textDecoration: "none", justifySelf: "start" }} href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent("Hola, quiero pagar o cambiar mi plan de FuerzaLab.")}`} target="_blank" rel="noreferrer">
                Pagar o cambiar de plan por WhatsApp
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}
