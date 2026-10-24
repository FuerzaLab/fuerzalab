import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface ToastContextValue {
  notify: (message: string) => void;
  flashSaved: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const notify = useCallback((msg: string) => {
    setMessage(msg);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(null), 2600);
  }, []);

  // Un indicador aparte, chico y discreto — a propósito distinto del toast
  // de arriba, que es para errores y mensajes importantes. Este solo
  // confirma que un cambio ya se guardó solo, sin competir con nada.
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<number | null>(null);

  const flashSaved = useCallback(() => {
    setSaved(true);
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaved(false), 1400);
  }, []);

  return (
    <ToastContext.Provider value={{ notify, flashSaved }}>
      {children}
      {message && (
        <div
          role="status"
          style={{
            position: "fixed",
            left: "50%",
            bottom: 24,
            transform: "translateX(-50%)",
            background: "var(--ink)",
            color: "#fff",
            padding: "10px 18px",
            borderRadius: 8,
            zIndex: 60,
            fontSize: 14,
            maxWidth: "90vw",
          }}
        >
          {message}
        </div>
      )}
      <div
        aria-hidden={!saved}
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: 59,
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "var(--ok-soft, #E1F1EA)",
          color: "#1F6B52",
          padding: "6px 12px",
          borderRadius: 99,
          fontSize: 12.5,
          fontWeight: 500,
          opacity: saved ? 1 : 0,
          transform: saved ? "translateY(0)" : "translateY(6px)",
          transition: "opacity .25s ease, transform .25s ease",
          pointerEvents: "none",
        }}
      >
        ✓ Guardado
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}
