import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { paths } from "../../routes/paths";
import PasswordInput from "../../components/ui/PasswordInput";
import { DEMO_EMAIL, DEMO_ENABLED, DEMO_PASSWORD } from "../../lib/demo";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const enterDemo = async () => {
    setError("");
    setDemoLoading(true);
    const { error: err } = await signIn(DEMO_EMAIL, DEMO_PASSWORD);
    setDemoLoading(false);
    if (err) {
      setError("La demo no está disponible en este momento. Intenta de nuevo en unos minutos.");
      return;
    }
    navigate("/", { replace: true });
  };

  const from = (location.state as { from?: Location })?.from?.pathname;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Completa tu correo y tu contraseña.");
      return;
    }
    setError("");
    setLoading(true);
    const { error: err } = await signIn(email.trim(), password);
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    // El router redirige automáticamente según el rol una vez que el
    // perfil carga; si venía de una ruta protegida, vuelve ahí.
    navigate(from || "/", { replace: true });
  };

  return (
    <form onSubmit={onSubmit}>
      <h2 style={{ marginBottom: 6 }}>Iniciar sesión</h2>
      <p className="note" style={{ marginBottom: 20 }}>Entra con tu correo y contraseña.</p>

      <label className="field-label" htmlFor="email">Correo electrónico</label>
      <input
        id="email"
        type="email"
        className="input"
        style={{ marginBottom: 14 }}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        autoFocus
      />

      <label className="field-label" htmlFor="password">Contraseña</label>
      <PasswordInput
        id="password"
        style={{ marginBottom: 8 }}
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
      />

      <div style={{ textAlign: "right", marginBottom: 16 }}>
        <Link to={paths.forgotPassword} className="note">¿Olvidaste tu contraseña?</Link>
      </div>

      {error && <p className="error-text" style={{ marginBottom: 14 }}>{error}</p>}

      <button type="submit" className="btn" style={{ width: "100%", justifyContent: "center" }} disabled={loading}>
        {loading ? "Ingresando…" : "Ingresar"}
      </button>

      {DEMO_ENABLED && (
        <div className="demo-cta">
          <div style={{ fontWeight: 600, marginBottom: 2 }}>¿Todavía no tienes cuenta?</div>
          <div className="note" style={{ marginBottom: 10 }}>
            Prueba FuerzaLab como entrenador, con clientes y datos de ejemplo. Sin registrarte.
          </div>
          <button type="button" className="btn ghost" style={{ width: "100%", justifyContent: "center" }} onClick={enterDemo} disabled={demoLoading}>
            {demoLoading ? "Entrando a la demo…" : "Probar la demo"}
          </button>
        </div>
      )}

      <p className="note" style={{ marginTop: 20, textAlign: "center" }}>
        ¿Te invitaron a la plataforma?{" "}
        <Link to={paths.register}>Regístrate con tu código</Link>
      </p>
      <p className="note" style={{ marginTop: 10, textAlign: "center", fontSize: 12.5 }}>
        <Link to={paths.terms}>Términos de uso</Link> · <Link to={paths.privacy}>Política de privacidad</Link>
      </p>
    </form>
  );
}
