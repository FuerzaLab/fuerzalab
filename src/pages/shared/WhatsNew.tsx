import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWhatsNew } from "../../hooks/useWhatsNew";

const fmt = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("es", { day: "numeric", month: "short" });

/** "Qué hay de nuevo": las mejoras de FuerzaLab para entrenadores o para alumnos (lib/changelog.ts). */
export default function WhatsNew() {
  const navigate = useNavigate();
  const { entries, unseenIds, markAllSeen } = useWhatsNew();
  // Lo que era nuevo al abrir la pantalla se sigue marcando como "Nuevo"
  // mientras se lee, aunque ya quede guardado como visto.
  const [newOnOpen] = useState(() => unseenIds);
  useEffect(() => {
    markAllSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <h1 style={{ margin: "0 0 4px" }}>Qué hay de nuevo</h1>
      <p className="note" style={{ marginBottom: 18 }}>Las mejoras de FuerzaLab, de la más nueva a la más vieja.</p>
      <div className="panel">
        <div className="bd" style={{ paddingTop: 4 }}>
          {entries.length === 0 && <p className="note">Todavía no hay novedades.</p>}
          {entries.map((e, i) => (
            <div key={e.id} className="wn-item" style={i === 0 ? { borderTop: 0 } : undefined}>
              <div className="wn-date">{fmt(e.date)}</div>
              <div>
                <div className="wn-title">
                  {e.title} {newOnOpen.has(e.id) && <span className="wn-new">Nuevo</span>}
                </div>
                <div className="note" style={{ fontSize: 14.5 }}>{e.body}</div>
                {e.link && (
                  <button className="btn ghost wn-go" onClick={() => navigate(e.link!.to)}>
                    {e.link.label}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
