import {
  Children,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

/**
 * Reemplazo directo de <select> que además deja escribir para buscar.
 *
 * Se usa igual que un <select> — mismos <option> adentro, mismo
 * `value`, y `onChange` recibe un objeto con `target.value` — así que
 * cambiar uno por otro es solo cambiar el nombre de la etiqueta:
 *
 *   <SearchSelect className="input" value={id} onChange={(e) => setId(e.target.value)}>
 *     <option value="">Selecciona un cliente</option>
 *     {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
 *   </SearchSelect>
 *
 * - Escribir filtra por coincidencia: sin importar mayúsculas ni tildes,
 *   y con varias palabras en cualquier orden ("sentadilla bulg" encuentra
 *   "Sentadilla búlgara").
 * - La flecha de la derecha abre la lista completa, como siempre.
 * - Teclado: ↓/↑ para moverse, Enter para elegir, Esc para cerrar.
 * - La lista se dibuja fuera de la página (portal), así no queda cortada
 *   dentro de las ventanas emergentes.
 */

interface Opt {
  value: string;
  label: string;
  disabled: boolean;
}

export interface SearchSelectChange {
  target: { value: string };
}

function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return "";
}

function collectOptions(children: ReactNode, out: Opt[] = []): Opt[] {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as { value?: string | number; children?: ReactNode; disabled?: boolean };
    if (child.type === "option") {
      const label = textOf(props.children).trim();
      out.push({ value: props.value != null ? String(props.value) : label, label, disabled: !!props.disabled });
    } else if (props.children) {
      // <optgroup> o fragmentos: se aplanan
      collectOptions(props.children, out);
    }
  });
  return out;
}

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Estilos que van al contenedor (ubicación); el resto, al campo de texto. */
const OUTER_KEYS = new Set([
  "margin",
  "marginTop",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "width",
  "maxWidth",
  "minWidth",
  "flex",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "alignSelf",
  "gridColumn",
]);

let idCounter = 0;

export default function SearchSelect({
  value,
  onChange,
  children,
  className = "input",
  style,
  disabled,
  "aria-label": ariaLabel,
}: {
  value: string | number | null | undefined;
  onChange: (e: SearchSelectChange) => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const options = useMemo(() => collectOptions(children), [children]);
  const current = value == null ? "" : String(value);
  const selected = options.find((o) => o.value === current) ?? null;
  // La opción con valor vacío ("Selecciona…") hace de texto de ayuda.
  const placeholder = options.find((o) => o.value === "")?.label ?? "Selecciona";

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; maxHeight: number; above: boolean } | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [listId] = useState(() => `ss-list-${++idCounter}`);

  const filtered = useMemo(() => {
    if (!query || !query.trim()) return options;
    const words = normalize(query).split(/\s+/).filter(Boolean);
    return options.filter((o) => {
      if (o.value === "") return false; // el "Selecciona…" no aparece al buscar
      const label = normalize(o.label);
      return words.every((w) => label.includes(w));
    });
  }, [options, query]);

  const outerStyle: CSSProperties = {};
  const innerStyle: CSSProperties = {};
  for (const [k, v] of Object.entries(style ?? {})) {
    (OUTER_KEYS.has(k) ? outerStyle : innerStyle)[k as keyof CSSProperties] = v as never;
  }

  const place = () => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - 8;
    const spaceAbove = r.top - 8;
    const above = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(140, Math.min(300, above ? spaceAbove : spaceBelow));
    setPos({
      left: r.left,
      top: above ? r.top - 4 : r.bottom + 4,
      width: Math.max(r.width, 200),
      maxHeight,
      above,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onMove = () => place();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  // Mantener visible la opción resaltada al moverse con el teclado.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${highlight}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  const openList = (fromTyping: boolean) => {
    if (disabled) return;
    if (!open) {
      const idx = fromTyping ? 0 : Math.max(0, options.findIndex((o) => o.value === current));
      setHighlight(idx);
    }
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setQuery(null);
  };

  const choose = (o: Opt | undefined) => {
    if (!o || o.disabled) return;
    if (o.value !== current) onChange({ target: { value: o.value } });
    close();
  };

  const move = (delta: number) => {
    if (!filtered.length) return;
    let i = highlight;
    for (let step = 0; step < filtered.length; step++) {
      i = (i + delta + filtered.length) % filtered.length;
      if (!filtered[i].disabled) break;
    }
    setHighlight(i);
  };

  const shownText = query !== null ? query : selected && selected.value !== "" ? selected.label : "";

  return (
    <div ref={wrapRef} className="ss-wrap" style={outerStyle}>
      <input
        ref={inputRef}
        className={`${className} ss-input`}
        style={innerStyle}
        value={shownText}
        placeholder={selected && selected.value !== "" ? selected.label : placeholder}
        disabled={disabled}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        autoComplete="off"
        spellCheck={false}
        onFocus={(e) => e.currentTarget.select()}
        onClick={() => openList(false)}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
          openList(true);
        }}
        onBlur={close}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!open) openList(false);
            else move(1);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) openList(false);
            else move(-1);
          } else if (e.key === "Enter") {
            if (open) {
              e.preventDefault();
              choose(filtered[highlight]);
            }
          } else if (e.key === "Escape") {
            if (open) {
              e.preventDefault();
              close();
            }
          } else if (e.key === "Tab") {
            // Si escribió algo y hay coincidencias, Tab elige la resaltada.
            if (open && query && filtered[highlight]) choose(filtered[highlight]);
            else close();
          }
        }}
      />
      <button
        type="button"
        className="ss-arrow"
        tabIndex={-1}
        aria-label="Ver todas las opciones"
        disabled={disabled}
        // mousedown (no click) para que el campo no pierda el foco y se cierre antes
        onMouseDown={(e) => {
          e.preventDefault();
          if (disabled) return;
          if (open) close();
          else {
            setQuery(null);
            openList(false);
            inputRef.current?.focus();
          }
        }}
      >
        <ChevronDown size={18} />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            className="ss-list"
            style={{
              left: pos.left,
              top: pos.top,
              width: pos.width,
              maxHeight: pos.maxHeight,
              transform: pos.above ? "translateY(-100%)" : undefined,
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {filtered.length === 0 ? (
              <div className="ss-empty">Sin coincidencias</div>
            ) : (
              filtered.map((o, i) => (
                <div
                  key={`${o.value}-${i}`}
                  data-idx={i}
                  role="option"
                  aria-selected={o.value === current}
                  aria-disabled={o.disabled}
                  className={`ss-opt${i === highlight ? " hl" : ""}${o.value === current ? " sel" : ""}${o.disabled ? " dis" : ""}${o.value === "" ? " ph" : ""}`}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => choose(o)}
                >
                  {o.label || "\u00a0"}
                </div>
              ))
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
