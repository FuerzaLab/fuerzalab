import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { paths } from "../../routes/paths";

export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.");
    if (password !== confirmPassword) return setError("Las contraseñas no coinciden.");
    setError("");
    setLoading(true);
    const { error: err } = await updatePassword(password);
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    setDone(true);
    setTimeout(() => navigate(paths.login, { replace: true }), 1800);
  };

  if (done) {
    return (
      <div>
        <h2 style={{ marginBottom: 6 }}>Contraseña actualizada</h2>
        <p className="note">Ya puedes iniciar sesión con tu nueva contraseña. Te llevamos ahí…</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <h2 style={{ marginBottom: 6 }}>Elige una nueva contraseña</h2>
      <p className="note" style={{ marginBottom: 20 }}>
        Debes abrir esta página desde el enlace que te enviamos por correo.
      </p>

      <label className="field-label" htmlFor="password">Nueva contraseña</label>
      <input
        id="password"
        type="password"
        className="input"
        style={{ marginBottom: 14 }}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
      />

      <label className="field-label" htmlFor="confirmPassword">Confirmar contraseña</label>
      <input
        id="confirmPassword"
        type="password"
        className="input"
        style={{ marginBottom: 8 }}
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />

      {error && <p className="error-text" style={{ margin: "10px 0" }}>{error}</p>}

      <button type="submit" className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 10 }} disabled={loading}>
        {loading ? "Guardando…" : "Guardar contraseña"}
      </button>
    </form>
  );
}
