import { useAuth } from "../../contexts/AuthContext";

export default function TrainerDashboard() {
  const { profile } = useAuth();
  return (
    <div className="page">
      <h1 style={{ marginBottom: 6 }}>Hola, {profile?.full_name}</h1>
      <p className="note" style={{ marginBottom: 20 }}>Tu cuenta y tu organización ya están conectadas a la base de datos real.</p>
      <div className="panel">
        <div className="bd">
          <p>
            El panel completo con tus clientes, rutinas y pagos se conecta en la siguiente entrega. Por ahora, esta
            pantalla confirma que iniciaste sesión correctamente como entrenador.
          </p>
        </div>
      </div>
    </div>
  );
}
