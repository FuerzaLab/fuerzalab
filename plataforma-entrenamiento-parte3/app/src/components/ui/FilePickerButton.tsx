import { useRef, useState } from "react";
import { FileUp } from "lucide-react";

export default function FilePickerButton({
  accept,
  onFile,
  label = "Seleccionar archivo",
}: {
  accept: string;
  onFile: (file: File) => void;
  label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");

  return (
    <div className="note" style={{ marginBottom: 14 }}>
      <input
        ref={ref}
        type="file"
        accept={accept}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setFileName(f.name);
          onFile(f);
        }}
        style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}
        aria-label={label}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="btn ghost" onClick={() => ref.current?.click()}>
          <FileUp size={16} /> {label}
        </button>
        <span>{fileName || "Ningún archivo seleccionado"}</span>
      </div>
    </div>
  );
}
