import { useAuth } from "../../contexts/AuthContext";
import { paths } from "../../routes/paths";
import { useNavigate } from "react-router-dom";

export default function NoAccess() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate(paths.login, { replace: true });
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h2 style={{ marginBottom: 10 }}>Sin acceso</h2>
        <p className="note" style={{ marginBottom: 16 }}>
          {profile && !profile.is_active
            ? "Tu cuenta está desactivada. Contacta a tu entrenador o administrador."
            : "Tu cuenta no tiene permiso para ver esta sección."}
        </p>
        <button className="btn" style={{ width: "100%", justifyContent: "center" }} onClick={handleLogout}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
