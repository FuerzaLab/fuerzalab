import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { paths } from "./paths";

/** Punto de entrada "/": manda a cada quien al panel que le corresponde. */
export default function RoleRedirect() {
  const { profile, loading } = useAuth();

  if (loading) return null;
  if (!profile) return <Navigate to={paths.login} replace />;

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
