import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { billingBlock } from "../../services/orgBilling";
import { paths } from "../../routes/paths";

const WHATSAPP = (import.meta.env.VITE_CONTACT_WHATSAPP ?? "").replace(/\D/g, "");
const fmt = (iso: string) => new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("es", { day: "numeric", month: "long" });

/** Lo que ve quien tiene el acceso cortado: por qué, y qué hacer. */
export default function BillingBlocked() {
  const { orgBilling, signOut } = useAuth();
  const navigate = useNavigate();
  const block = billingBlock(orgBilling);
  const isClient = orgBilling?.role === "client";
  const due = orgBilling?.next_due;

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h2 style={{ marginBottom: 10 }}>{isClient ? "Tu acceso está pausado" : "Tu cuenta está suspendida"}</h2>
        {isClient ? (
          <p className="note">
            La cuenta de tu entrenador en FuerzaLab está suspendida por el momento. Escríbele para que la reactive: apenas lo
            haga, vuelves a ver tu rutina y todo tu progreso, sin perder nada.
          </p>
        ) : block?.reason === "suspended" ? (
          <p className="note">Tu organización ({orgBilling?.organization}) está suspendida. Escríbenos para reactivarla.</p>
        ) : (
          <>
            <p className="note">
              El pago de FuerzaLab{due ? ` de ${due.currency} ${Number(due.amount).toLocaleString("es")}, que vencía el ${fmt(due.due_date)},` : ""} todavía no se
              registró, así que el acceso quedó suspendido. No se perdió nada: apenas se registre el pago, todo vuelve a funcionar.
            </p>
            {block?.clientsUntil && (
              <p className="note" style={{ marginTop: 8 }}>
                Tus alumnos siguen entrenando con su rutina actual hasta el <b>{fmt(block.clientsUntil)}</b>. Después también se les pausa el acceso.
              </p>
            )}
          </>
        )}
        {!isClient && WHATSAPP && (
          <a
            className="btn"
            style={{ width: "100%", justifyContent: "center", marginTop: 14, textDecoration: "none" }}
            href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hola, quiero reactivar mi cuenta de FuerzaLab (${orgBilling?.organization ?? ""}).`)}`}
            target="_blank"
            rel="noreferrer"
          >
            Escribir por WhatsApp para pagar
          </a>
        )}
        <button
          className="btn ghost"
          style={{ width: "100%", justifyContent: "center", marginTop: 10 }}
          onClick={async () => {
            await signOut();
            navigate(paths.login, { replace: true });
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
