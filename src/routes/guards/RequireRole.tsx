import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import type { Role } from "../../types/auth";
import { paths } from "../paths";

export default function RequireRole({ allow }: { allow: Role[] }) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-shell">
        <p className="note">Cargando…</p>
      </div>
    );
  }

  if (!profile || !profile.is_active) {
    return <Navigate to={paths.noAccess} replace />;
  }

  if (!allow.includes(profile.role)) {
    return <Navigate to={paths.noAccess} replace />;
  }

  return <Outlet />;
}
