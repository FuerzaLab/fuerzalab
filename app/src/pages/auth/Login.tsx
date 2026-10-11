import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { paths } from "../../routes/paths";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      <input
        id="password"
        type="password"
        className="input"
        style={{ marginBottom: 8 }}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
      />

      <div style={{ textAlign: "right", marginBottom: 16 }}>
        <Link to={paths.forgotPassword} className="note">¿Olvidaste tu contraseña?</Link>
      </div>

      {error && <p className="error-text" style={{ marginBottom: 14 }}>{error}</p>}

      <button type="submit" className="btn" style={{ width: "100%", justifyContent: "center" }} disabled={loading}>
        {loading ? "Ingresando…" : "Ingresar"}
      </button>

      <p className="note" style={{ marginTop: 20, textAlign: "center" }}>
        ¿Te invitaron a la plataforma?{" "}
        <Link to={paths.register}>Regístrate con tu código</Link>
      </p>
    </form>
  );
}
