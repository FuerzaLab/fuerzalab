import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { paths } from "../routes/paths";
import { LEGAL_VERSION } from "../lib/legalVersion";
import { isAnyDemo } from "../lib/demo";

/** ¿Esta persona tiene que aceptar la versión nueva de los Términos y la Privacidad? */
export function needsTermsReaccept(user: { email?: string | null; user_metadata?: Record<string, any> } | null, role: string | undefined): boolean {
  if (!user || !role || role === "super_admin" || isAnyDemo(user.email)) return false;
  return (user.user_metadata?.terms_version ?? "") < LEGAL_VERSION;
}

/**
 * Pantalla para aceptar la versión nueva de los Términos de uso y la Política
 * de privacidad, con los consentimientos separados (Términos, punto 5). Queda
 * guardada la fecha, la hora y la versión en los datos de la cuenta.
 */
export default function TermsReaccept() {
  const { profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const isClient = profile?.role === "client";
  const [terms, setTerms] = useState(false);
  const [health, setHealth] = useState(false);
  const [abroad, setAbroad] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const accept = async () => {
    if (!terms || !abroad || (isClient && !health)) return setError("Para seguir, marca las casillas.");
    setBusy(true);
    setError("");
    const now = new Date().toISOString();
    const { error: err } = await supabase.auth.updateUser({
      data: {
        terms_accepted_at: now,
        terms_version: LEGAL_VERSION,
        abroad_storage_consent_at: now,
        ...(isClient ? { health_consent_at: now } : {}),
      },
    });
    if (err) {
      setError("No se pudo guardar. Intenta de nuevo.");
      setBusy(false);
      return;
    }
    await supabase.auth.refreshSession().catch(() => null);
    await refreshProfile();
    window.location.reload();
  };

  const box = (checked: boolean, set: (v: boolean) => void, text: ReactNode) => (
    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "8px 0", fontSize: 13.5, lineHeight: 1.45 }}>
      <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} style={{ marginTop: 3 }} />
      <span>{text}</span>
    </label>
  );

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <h2 style={{ marginBottom: 8 }}>Actualizamos los Términos y la Política de privacidad</h2>
        <p className="note" style={{ marginBottom: 12 }}>
          Para seguir usando FuerzaLab, léelos y acéptalos. Entre otras cosas: cómo se protegen los datos de los menores, qué
          pasa si un plan vence y cuánto tiempo se guardan los datos.
        </p>
        <p style={{ marginBottom: 6, fontSize: 14 }}>
          <Link to={paths.terms} target="_blank" rel="noreferrer">Leer los Términos de uso</Link> ·{" "}
          <Link to={paths.privacy} target="_blank" rel="noreferrer">Leer la Política de privacidad</Link>
        </p>
        {box(terms, setTerms, <>Acepto los Términos de uso y la Política de privacidad.</>)}
        {isClient &&
          box(health, setHealth, <>Autorizo expresamente el registro de mis datos de salud (cuestionario PAR-Q+, lesiones, medicamentos, bienestar y evaluaciones físicas) para que mi entrenador planifique mi entrenamiento de forma segura.</>)}
        {box(abroad, setAbroad, <>Autorizo expresamente que mis datos se guarden en servidores ubicados fuera de Bolivia (Estados Unidos).</>)}
        {error && <p className="error-text" style={{ margin: "8px 0" }}>{error}</p>}
        <button className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 10 }} disabled={busy} onClick={accept}>
          {busy ? "Guardando…" : "Aceptar y continuar"}
        </button>
        <button
          className="btn ghost"
          style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
          onClick={async () => {
            await signOut();
            navigate(paths.login, { replace: true });
          }}
        >
          Ahora no (cerrar sesión)
        </button>
      </div>
    </div>
  );
}
