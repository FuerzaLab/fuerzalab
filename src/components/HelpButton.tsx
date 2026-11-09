import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { paths } from "../routes/paths";
import { helpTopicIdFor } from "../pages/shared/HelpCenter";

/** Botón "?" de la barra de arriba: abre la ayuda de la pantalla en la que estás. */
export default function HelpButton() {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  if (!profile || profile.role === "super_admin") return null;
  const role = profile.role === "client" ? "client" : "trainer";
  const base = role === "client" ? paths.clientHelp : paths.trainerHelp;
  if (pathname === base) return null;
  const topic = helpTopicIdFor(pathname, role);
  return (
    <Link to={topic ? `${base}?tema=${topic}` : base} className="help-btn" aria-label="Ayuda de esta pantalla" title="Ayuda de esta pantalla">
      ?
    </Link>
  );
}
