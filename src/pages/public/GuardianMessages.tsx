import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";

interface GuardianView {
  ok: boolean;
  client?: string;
  trainer?: string | null;
  expires_at?: string;
  messages?: { from_trainer: boolean; sender: string; body: string; has_attachment: boolean; at: string }[];
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("es", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * Página pública (sin iniciar sesión) para la madre, padre o tutor de un
 * alumno menor: lee los mensajes entre su hijo y el entrenador, sin poder
 * escribir. Se abre con el enlace privado que le manda el entrenador (part4u).
 */
export default function GuardianMessages() {
  const { token = "" } = useParams();
  const [view, setView] = useState<GuardianView | null>(null);

  useEffect(() => {
    supabase
      .rpc("guardian_messages", { p_token: token })
      .then(({ data, error }) => setView(error ? { ok: false } : ((data ?? { ok: false }) as GuardianView)));
  }, [token]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "24px 16px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <img src="/logo.png" alt="" width={36} height={36} style={{ borderRadius: 9 }} />
          <b style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24 }}>
            Fuerza<span style={{ color: "var(--pri)" }}>Lab</span>
          </b>
        </div>
        {!view ? (
          <p className="note">Cargando…</p>
        ) : !view.ok ? (
          <div className="panel">
            <div className="bd">
              <h2 style={{ marginTop: 0 }}>Este enlace no está disponible</h2>
              <p className="note" style={{ marginBottom: 0 }}>
                Venció o el entrenador lo anuló. Pídele un enlace nuevo para leer los mensajes.
              </p>
            </div>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: 22, marginBottom: 4 }}>Mensajes de {view.client} con su entrenador</h1>
            <p className="note" style={{ marginBottom: 16 }}>
              Solo lectura{view.trainer ? ` · Entrenador: ${view.trainer}` : ""}
              {view.expires_at ? ` · Este enlace vence el ${new Date(view.expires_at).toLocaleDateString("es")}` : ""}. No lo
              compartas: quien lo tenga puede leer estos mensajes.
            </p>
            {view.messages && view.messages.length > 0 ? (
              <div style={{ display: "grid", gap: 10 }}>
                {view.messages.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      justifySelf: m.from_trainer ? "start" : "end",
                      maxWidth: "85%",
                      background: m.from_trainer ? "#fff" : "var(--pri-soft)",
                      border: "1px solid var(--line)",
                      borderRadius: 12,
                      padding: "8px 12px",
                    }}
                  >
                    <div className="note" style={{ fontSize: 12, marginBottom: 2 }}>
                      {m.sender || (m.from_trainer ? "Entrenador" : view.client)} · {when(m.at)}
                    </div>
                    <div style={{ whiteSpace: "pre-wrap", fontSize: 14.5 }}>{m.body}</div>
                    {m.has_attachment && <div className="note" style={{ fontSize: 12, marginTop: 4 }}>📎 Tiene un archivo adjunto (se ve dentro de la app).</div>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="note">Todavía no hay mensajes.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
