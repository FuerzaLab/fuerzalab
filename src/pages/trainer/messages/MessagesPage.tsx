import { useEffect, useState } from "react";
import { useToast } from "../../../contexts/ToastContext";
import ChatThread from "../../../components/ChatThread";
import { listClients, type ClientRow } from "../../../services/clients";
import { countUnreadByClient } from "../../../services/messages";
import EmptyState from "../../../components/ui/EmptyState";

export default function MessagesPage() {
  const { notify } = useToast();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientId, setClientId] = useState("");
  const [unread, setUnread] = useState<Record<string, number>>({});

  const load = async () => {
    try {
      const cs = (await listClients()).filter((c) => c.status !== "archived");
      setClients(cs);
      setClientId(cs[0]?.id ?? "");
      setUnread(await countUnreadByClient(cs.map((c) => c.id)));
    } catch (e: any) {
      notify(e.message);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page">
      <h1 style={{ marginBottom: 20 }}>Mensajes</h1>
      <div style={{ display: "grid", gridTemplateColumns: "220px minmax(0,1fr)", gap: 18 }}>
        <div className="panel">
          {clients.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setClientId(c.id);
                setUnread((u) => ({ ...u, [c.id]: 0 }));
              }}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
                border: 0,
                borderBottom: "1px solid var(--line)",
                background: c.id === clientId ? "var(--pri-soft)" : "transparent",
                padding: "10px 14px",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span>{c.full_name}</span>
              {unread[c.id] > 0 && (
                <span style={{ background: "var(--pri)", color: "#fff", borderRadius: 99, fontSize: 11, padding: "1px 7px" }}>
                  {unread[c.id]}
                </span>
              )}
            </button>
          ))}
          {clients.length === 0 && (
            <div style={{ padding: 10 }}>
              <EmptyState title="Todavía no hay conversaciones">
                Cuando invites a tus alumnos, cada uno va a poder escribirte desde su app, y tú le respondes desde acá.
              </EmptyState>
            </div>
          )}
        </div>
        {clientId ? (
          <ChatThread clientId={clientId} otherLabel={clients.find((c) => c.id === clientId)?.full_name ?? ""} />
        ) : (
          <div className="panel"><div className="bd"><p className="note">Elige un cliente para ver la conversación.</p></div></div>
        )}
      </div>
    </div>
  );
}
