import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h2 style={{ marginBottom: 10 }}>Página no encontrada</h2>
        <p className="note" style={{ marginBottom: 16 }}>La dirección a la que intentaste entrar no existe.</p>
        <Link to="/" className="btn" style={{ width: "100%", justifyContent: "center" }}>
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
