import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { paths } from "./paths";
import Landing from "../pages/public/Landing";
import BillingBlocked from "../pages/shared/BillingBlocked";
import { billingBlock } from "../services/orgBilling";

/**
 * Punto de entrada "/": sin sesión, la página de presentación; con sesión,
 * manda a cada quien al panel que le corresponde.
 */
export default function RoleRedirect() {
  const { profile, loading, session, orgBilling } = useAuth();

  if (loading) return null;
  // Sesión iniciada pero sin acceso por el cobro de la organización: se explica por qué.
  if (session && billingBlock(orgBilling)) return <BillingBlocked />;
  if (!profile) return <Landing />;

  switch (profile.role) {
    case "super_admin":
      return <Navigate to={paths.adminDashboard} replace />;
    case "trainer":
    case "staff":
      return <Navigate to={paths.trainerDashboard} replace />;
    case "client":
      return <Navigate to={paths.clientDashboard} replace />;
    default:
      return <Navigate to={paths.noAccess} replace />;
  }
}
