import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { listMessages, sendMessage, markThreadRead, type MessageRow } from "../services/messages";

export default function ChatThread({ clientId, otherLabel }: { clientId: string; otherLabel: string }) {
  const { profile } = useAuth();
  const { notify } = useToast();
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const msgs = await listMessages(clientId);
      setMessages(msgs);
      if (profile) await markThreadRead(clientId, profile.id);
    } catch (e: any) {
      notify(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const submit = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const msg = await sendMessage(clientId, text.trim());
      setMessages((m) => [...m, msg]);
      setText("");
    } catch (e: any) {
      notify(e.message);
    }
    setSending(false);
  };

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", height: 520 }}>
      <div className="hd"><h3>{otherLabel}</h3></div>
      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          <p className="note">Cargando…</p>
        ) : messages.length === 0 ? (
          <p className="note">Todavía no hay mensajes. Escribe el primero.</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === profile?.id;
            return (
              <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "75%" }}>
                <div
                  style={{
                    background: mine ? "var(--pri)" : "var(--bg)",
                    color: mine ? "#fff" : "var(--ink)",
                    borderRadius: 12,
                    padding: "8px 12px",
                    fontSize: 14.5,
                  }}
                >
                  {m.body}
                </div>
                <div className="note" style={{ fontSize: 11, marginTop: 2, textAlign: mine ? "right" : "left" }}>
                  {new Date(m.created_at).toLocaleString("es", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--line)" }}>
        <input
          className="input"
          placeholder="Escribe un mensaje"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        <button className="btn" onClick={submit} disabled={sending || !text.trim()} aria-label="Enviar">
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
