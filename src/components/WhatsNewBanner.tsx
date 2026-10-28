import { useNavigate } from "react-router-dom";
import { Sparkles, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useWhatsNew } from "../hooks/useWhatsNew";
import { paths } from "../routes/paths";

/**
 * Aviso en Inicio cuando hay mejoras de FuerzaLab sin ver: "Hay 3 mejoras
 * nuevas — Ver". Desaparece al abrir "Qué hay de nuevo" o al cerrarlo con la ✕
 * (en ese caso también se apaga el puntito del menú).
 */
export default function WhatsNewBanner() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { unseenCount, entries, unseenIds, markAllSeen } = useWhatsNew();
  if (unseenCount === 0) return null;
  const first = entries.find((e) => unseenIds.has(e.id));
  const to = profile?.role === "client" ? paths.clientWhatsNew : paths.trainerWhatsNew;
  return (
    <div className="wn-banner" role="status">
      <Sparkles size={18} style={{ flex: "none" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>{unseenCount === 1 ? "Hay 1 mejora nueva en FuerzaLab" : `Hay ${unseenCount} mejoras nuevas en FuerzaLab`}</b>
        {first && <div className="wn-banner-sub">{first.title}{unseenCount > 1 ? " y más" : ""}</div>}
      </div>
      <button className="btn" style={{ padding: "6px 14px", fontSize: 13.5, flex: "none" }} onClick={() => navigate(to)}>
        Ver
      </button>
      <button className="wn-banner-x" aria-label="Cerrar aviso" onClick={markAllSeen}>
        <X size={16} />
      </button>
    </div>
  );
}
