import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { getMyClientId, getClientProfile } from "../../services/clients";
import OnboardingForm from "../../pages/client/OnboardingForm";
import { paths } from "../paths";

export default function RequireOnboarding() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState("");

  const handleLogout = async () => {
    await signOut();
    navigate(paths.login, { replace: true });
  };

  const check = async () => {
    setLoading(true);
    try {
      const id = await getMyClientId();
      setClientId(id);
      if (id) {
        const prof = await getClientProfile(id);
        setSubmitted(Boolean(prof?.submitted_at));
        setReviewed(Boolean(prof?.reviewed_at));
      }
    } catch (e: any) {
      setError(e.message ?? "No pudimos cargar tu cuenta.");
    }
    setLoading(false);
  };

  useEffect(() => {
    check();
  }, []);

  if (loading) {
    return (
      <div className="auth-shell">
        <p className="note">Cargando…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <p className="error-text" style={{ marginBottom: 16 }}>{error}</p>
          <button className="btn ghost" onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </div>
    );
  }

  if (!clientId) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <p style={{ marginBottom: 16 }}>Tu cuenta todavía no está vinculada a una ficha de cliente. Avisa a tu entrenador.</p>
          <button className="btn ghost" onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </div>
    );
  }

  if (!submitted) {
    return <OnboardingForm clientId={clientId} onDone={check} />;
  }

  if (!reviewed) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <h2 style={{ marginBottom: 10 }}>Ya casi</h2>
          <p className="note" style={{ marginBottom: 16 }}>
            Enviamos tu formulario. Tu entrenador lo está revisando — en cuanto lo confirme, vas a poder ver el resto
            de la app. No hace falta que hagas nada más por ahora.
          </p>
          <button className="btn ghost" style={{ width: "100%", justifyContent: "center", marginBottom: 10 }} onClick={check}>
            Ya me confirmaron, volver a intentar
          </button>
          <button className="btn ghost" style={{ width: "100%", justifyContent: "center" }} onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
