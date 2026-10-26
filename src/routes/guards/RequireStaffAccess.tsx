import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { routeRequirement, hasLevel } from "../../lib/staffModules";
import { paths } from "../paths";

/** Pantallas que son solo del entrenador, nunca del staff. */
const TRAINER_ONLY = [paths.trainerTeam];

/**
 * Para cuentas de staff: deja pasar solo a las pantallas para las que el
 * entrenador le dio permiso. Si escribe una URL a mano de una sección que
 * no tiene habilitada, vuelve a Inicio. El entrenador pasa siempre.
 *
 * Esto es comodidad, no seguridad: aunque alguien se saltara esta guarda,
 * la base de datos (RLS) igual no le devolvería datos que no le
 * corresponden.
 */
export default function RequireStaffAccess() {
  const { profile, staffAccess } = useAuth();
  const { pathname } = useLocation();

  if (profile?.role !== "staff") return <Outlet />;

  if (!staffAccess) {
    return (
      <div className="page">
        <div className="panel" style={{ padding: 20, maxWidth: 560 }}>
          <h3 style={{ marginTop: 0 }}>Tu cuenta todavía no está vinculada</h3>
          <p className="note">
            Tu cuenta de asistente no está asociada a ningún entrenador. Pídele al entrenador que te invitó que revise
            la sección "Equipo".
          </p>
        </div>
      </div>
    );
  }

  if (TRAINER_ONLY.includes(pathname as (typeof TRAINER_ONLY)[number])) {
    return <Navigate to={paths.trainerDashboard} replace />;
  }

  const req = routeRequirement(pathname);
  if (req) {
    const ok = hasLevel(staffAccess.permissions, req.module, req.level) && (!req.extra || hasLevel(staffAccess.permissions, req.extra, "read"));
    if (!ok) return <Navigate to={paths.trainerDashboard} replace />;
  }

  return <Outlet />;
}
