import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { getMyClientId, getClientProfile } from "../../services/clients";
import OnboardingForm from "../../pages/client/OnboardingForm";

export default function RequireOnboarding() {
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState("");

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
          <p className="error-text">{error}</p>
        </div>
      </div>
    );
  }

  if (!clientId) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <p>Tu cuenta todavía no está vinculada a una ficha de cliente. Avisa a tu entrenador.</p>
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
          <button className="btn ghost" style={{ width: "100%", justifyContent: "center" }} onClick={check}>
            Ya me confirmaron, volver a intentar
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
