import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { HELP_MARKED, HELP_PDF, HELP_TOPICS, helpImage, searchHelp, type HelpRole, type HelpTopic } from "../../lib/helpContent";

/**
 * Centro de ayuda: buscador + temas por pantalla, con su captura (números
 * sobre los botones), qué hace cada botón, pasos y consejos. Mismo contenido
 * que el manual en PDF (lib/helpContent.ts). "?tema=<id>" abre un tema.
 */
export default function HelpCenter() {
  const { profile } = useAuth();
  const role: HelpRole = profile?.role === "client" ? "client" : "trainer";
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(params.get("tema"));

  const results = useMemo(() => searchHelp(query, role), [query, role]);

  // Abrir el tema pedido desde el botón "?" de una pantalla, y llevarlo a la vista.
  useEffect(() => {
    const t = params.get("tema");
    if (!t) return;
    setOpen(t);
    setTimeout(() => document.getElementById(`help-${t}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  }, [params]);

  const sections: { name: string; topics: HelpTopic[] }[] = [];
  for (const t of results) {
    let g = sections.find((x) => x.name === t.section);
    if (!g) sections.push((g = { name: t.section, topics: [] }));
    g.topics.push(t);
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="help-head">
        <div>
          <h1 style={{ margin: "0 0 4px" }}>Ayuda</h1>
          <p className="note" style={{ margin: 0 }}>Para qué sirve cada pantalla, qué hace cada botón y cómo usarlo.</p>
        </div>
        <a className="btn ghost" href={HELP_PDF} download>
          Descargar el manual (PDF)
        </a>
      </div>

      <input
        className="input help-search"
        type="search"
        placeholder={role === "client" ? "Busca: entrenar, descanso, pagos, fotos…" : "Busca: invitar, rutina, cobro, sala, video…"}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (params.get("tema")) setParams({}, { replace: true });
        }}
        autoFocus={!params.get("tema")}
      />

      {results.length === 0 && (
        <p className="note">No encontramos nada con «{query}». Prueba con otra palabra, o escríbele a tu entrenador o a FuerzaLab.</p>
      )}

      {sections.map((g) => (
        <div key={g.name} style={{ marginBottom: 18 }}>
          <h2 className="help-section">{g.name}</h2>
          {g.topics.map((t) => {
            const isOpen = open === t.id || (!!query && results.length <= 3);
            const marked = t.capture ? HELP_MARKED[t.capture] ?? [] : [];
            return (
              <div key={t.id} id={`help-${t.id}`} className={`panel help-topic${isOpen ? " open" : ""}`}>
                <button className="help-topic-h" onClick={() => setOpen(isOpen && open === t.id ? null : t.id)} aria-expanded={isOpen}>
                  <span>
                    <b>{t.title}</b>
                    <span className="note">{t.summary}</span>
                  </span>
                  <span aria-hidden>{isOpen ? "−" : "+"}</span>
                </button>
                {isOpen && (
                  <div className="help-topic-b">
                    {t.capture && (
                      <a href={helpImage(t.capture)} target="_blank" rel="noreferrer" title="Ver la captura en grande">
                        <img src={helpImage(t.capture)} alt={`Pantalla: ${t.title}`} loading="lazy" className="help-shot" />
                      </a>
                    )}
                    {t.buttons && (
                      <table className="help-table">
                        <tbody>
                          {t.buttons.map((b, i) => (
                            <tr key={b.label}>
                              <td className="b">
                                {marked.includes(i) && <span className="help-badge">{i + 1}</span>}
                                {b.label}
                              </td>
                              <td>{b.desc}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {t.steps && (
                      <ol className="help-steps">
                        {t.steps.map((s) => <li key={s}>{s}</li>)}
                      </ol>
                    )}
                    {t.tips?.map((s) => <p key={s} className="help-tip">💡 {s}</p>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** El tema de ayuda de la pantalla actual (o ninguno). */
export function helpTopicIdFor(pathname: string, role: HelpRole): string | null {
  const t = HELP_TOPICS.filter((x) => x.role === role && x.path).sort((a, b) => b.path!.length - a.path!.length).find((x) => pathname === x.path || pathname.startsWith(x.path + "/"));
  return t?.id ?? null;
}
