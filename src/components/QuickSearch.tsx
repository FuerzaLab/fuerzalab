import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { listClients, type ClientRow } from "../services/clients";
import { paths } from "../routes/paths";

/**
 * Buscador general (Ctrl + K, o el botón "Buscar" de arriba): escribes
 * "juan" y saltas a su ficha; escribes "pagos" y saltas a esa sección.
 * Busca sin importar tildes ni mayúsculas, en las secciones del menú que
 * esta persona puede ver y en sus alumnos.
 */
const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

interface Entry {
  key: string;
  label: string;
  hint: string;
  to: string;
}

export default function QuickSearch({ sections }: { sections: { to: string; label: string }[] }) {
  const { profile, can } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [clients, setClients] = useState<ClientRow[] | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const canClients = profile?.role === "trainer" || (profile?.role === "staff" && can("clients"));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setActive(0);
    setTimeout(() => inputRef.current?.focus(), 30);
    if (canClients && clients === null) listClients().then(setClients).catch(() => setClients([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const results = useMemo<Entry[]>(() => {
    const n = norm(q);
    const sec: Entry[] = sections
      .filter((s) => !n || norm(s.label).includes(n))
      .map((s) => ({ key: `s:${s.to}`, label: s.label, hint: "Sección", to: s.to }));
    const cl: Entry[] = n
      ? (clients ?? [])
          .filter((c) => norm(c.full_name).includes(n) || (c.email && norm(c.email).includes(n)))
          .slice(0, 8)
          .map((c) => ({ key: `c:${c.id}`, label: c.full_name, hint: "Alumno", to: paths.trainerClientDetail(c.id) }))
      : [];
    return [...cl, ...sec].slice(0, 12);
  }, [q, sections, clients]);

  const go = (e: Entry | undefined) => {
    if (!e) return;
    setOpen(false);
    navigate(e.to);
  };

  return (
    <>
      <button type="button" className="quick-search-btn" onClick={() => setOpen(true)} title="Buscar (Ctrl + K)">
        <Search size={16} /> <span className="qs-label">Buscar</span> <kbd>Ctrl K</kbd>
      </button>
      {open && (
        <div className="qs-overlay" onClick={() => setOpen(false)}>
          <div className="qs-panel" role="dialog" aria-label="Buscar" onClick={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              className="input"
              placeholder={canClients ? "Busca un alumno o una sección…" : "Busca una sección…"}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, results.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  go(results[active]);
                }
              }}
            />
            <div className="qs-results">
              {results.length === 0 ? (
                <p className="note" style={{ padding: "10px 4px", margin: 0 }}>No encontramos nada con «{q}».</p>
              ) : (
                results.map((r, i) => (
                  <button key={r.key} type="button" className={`qs-item${i === active ? " active" : ""}`} onMouseEnter={() => setActive(i)} onClick={() => go(r)}>
                    <span>{r.label}</span>
                    <span className="note" style={{ fontSize: 12 }}>{r.hint}</span>
                  </button>
                ))
              )}
            </div>
            <p className="note" style={{ fontSize: 11.5, margin: "8px 2px 0" }}>↑ ↓ para moverte · Enter para abrir · Esc para cerrar</p>
          </div>
        </div>
      )}
    </>
  );
}
