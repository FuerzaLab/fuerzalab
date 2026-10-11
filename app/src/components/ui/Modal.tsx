import { X } from "lucide-react";
import type { ReactNode } from "react";

export default function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,26,51,.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
        style={{
          background: "#fff",
          borderRadius: 12,
          width: "100%",
          maxWidth: wide ? 820 : 460,
          maxHeight: "min(640px, 90vh)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "22px 22px 14px", flex: "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2>{title}</h2>
            <button
              aria-label="Cerrar"
              onClick={onClose}
              style={{ border: 0, background: "none", cursor: "pointer" }}
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <div style={{ padding: "0 22px 22px", overflowY: "auto" }}>{children}</div>
      </div>
    </div>
  );
}
