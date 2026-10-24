import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { paths } from "../paths";

export default function RequireAuth() {
  const { session, loading, initialized } = useAuth();
  const location = useLocation();

  if (!initialized || loading) {
    return (
      <div className="auth-shell">
        <p className="note">Cargando…</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to={paths.login} state={{ from: location }} replace />;
  }

  return <Outlet />;
}
