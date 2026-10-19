import { useEffect, useState } from "react";
import { useToast } from "../../contexts/ToastContext";
import ChatThread from "../../components/ChatThread";
import { getMyClientId } from "../../services/clients";
import Loading from "../../components/ui/Loading";

export default function ClientMessages() {
  const { notify } = useToast();
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    getMyClientId().then(setClientId).catch((e) => notify(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page">
      <h1 style={{ marginBottom: 20 }}>Mensajes</h1>
      {clientId ? <ChatThread clientId={clientId} otherLabel="Tu entrenador" /> : <Loading />}
    </div>
  );
}
