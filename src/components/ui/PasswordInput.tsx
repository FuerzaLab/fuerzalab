import { useState, type CSSProperties } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function PasswordInput({
  value,
  onChange,
  className = "input",
  style,
  autoComplete,
  placeholder,
  id,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  style?: CSSProperties;
  autoComplete?: string;
  placeholder?: string;
  id?: string;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: "relative", ...style }}>
      <input
        id={id}
        type={visible ? "text" : "password"}
        className={className}
        style={{ paddingRight: 38, width: "100%" }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
      <button
        type="button"
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        onClick={() => setVisible((v) => !v)}
        style={{
          position: "absolute",
          right: 8,
          top: "50%",
          transform: "translateY(-50%)",
          border: 0,
          background: "none",
          color: "var(--muted)",
          cursor: "pointer",
          display: "flex",
          padding: 4,
        }}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
