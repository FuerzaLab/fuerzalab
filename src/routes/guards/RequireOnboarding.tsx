import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { getMyClientId, getClientProfile } from "../../services/clients";
import OnboardingForm from "../../pages/client/OnboardingForm";

export default function RequireOnboarding() {
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const check = async () => {
    setLoading(true);
    try {
      const id = await getMyClientId();
      setClientId(id);
      if (id) {
        const prof = await getClientProfile(id);
        setSubmitted(Boolean(prof?.submitted_at));
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

  return <Outlet />;
}
