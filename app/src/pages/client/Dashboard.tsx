import { useAuth } from "../../contexts/AuthContext";

export default function ClientDashboard() {
  const { profile } = useAuth();
  return (
    <div className="page">
      <h1 style={{ marginBottom: 6 }}>Hola, {profile?.full_name}</h1>
      <p className="note" style={{ marginBottom: 20 }}>Tu cuenta ya está conectada.</p>
      <div className="panel">
        <div className="bd">
          <p>Tu rutina, progreso y mensajes se conectan en la siguiente entrega del proyecto.</p>
        </div>
      </div>
    </div>
  );
}
