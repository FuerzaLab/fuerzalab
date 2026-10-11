import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { paths } from "../../routes/paths";

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return setError("Escribe tu correo electrónico.");
    setError("");
    setLoading(true);
    const { error: err } = await requestPasswordReset(email.trim());
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div>
        <h2 style={{ marginBottom: 6 }}>Revisa tu correo</h2>
        <p className="note" style={{ marginBottom: 16 }}>
          Si <b>{email}</b> tiene una cuenta, te enviamos un enlace para elegir una contraseña nueva.
        </p>
        <Link to={paths.login} className="btn" style={{ width: "100%", justifyContent: "center" }}>
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <h2 style={{ marginBottom: 6 }}>Recuperar acceso</h2>
      <p className="note" style={{ marginBottom: 20 }}>Te enviaremos un enlace para elegir una contraseña nueva.</p>

      <label className="field-label" htmlFor="email">Correo electrónico</label>
      <input
        id="email"
        type="email"
        className="input"
        style={{ marginBottom: 14 }}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoFocus
      />

      {error && <p className="error-text" style={{ marginBottom: 14 }}>{error}</p>}

      <button type="submit" className="btn" style={{ width: "100%", justifyContent: "center" }} disabled={loading}>
        {loading ? "Enviando…" : "Enviar enlace"}
      </button>

      <p className="note" style={{ marginTop: 20, textAlign: "center" }}>
        <Link to={paths.login}>Volver a iniciar sesión</Link>
      </p>
    </form>
  );
}
