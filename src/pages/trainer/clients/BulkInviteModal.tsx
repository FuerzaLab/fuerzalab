import { useState } from "react";
import Modal from "../../../components/ui/Modal";
import FilePickerButton from "../../../components/ui/FilePickerButton";
import WhatsAppButton from "../../../components/WhatsAppButton";
import { useToast } from "../../../contexts/ToastContext";
import { createClientWithInvite, type ClientRow } from "../../../services/clients";
import { paths } from "../../../routes/paths";
import { inviteMessage } from "../../../lib/whatsapp";

/**
 * Cargar varios alumnos de una vez: pegando una lista (una persona por
 * línea: "Nombre, WhatsApp, correo") o subiendo un Excel con columnas
 * Nombre / WhatsApp (o Teléfono) / Correo. Se crea cada alumno con su
 * invitación y queda un botón de WhatsApp por persona para mandársela.
 */
interface Draft {
  id: number;
  name: string;
  phone: string;
  email: string;
}
interface Done extends Draft {
  link?: string;
  error?: string;
  pending?: boolean;
}

const norm = (t: string) => String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const pick = (row: Record<string, any>, keys: string[]) => {
  const k = Object.keys(row).find((h) => keys.some((x) => norm(h).includes(x)));
  return k ? String(row[k] ?? "").trim() : "";
};

function parseText(text: string): Draft[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      const parts = line.split(/[,;\t]/).map((p) => p.trim()).filter(Boolean);
      const email = parts.find((p) => p.includes("@")) ?? "";
      const phone = parts.find((p) => /\d{7,}/.test(p.replace(/\D/g, ""))) ?? "";
      const name = parts.find((p) => p !== email && p !== phone) ?? "";
      return { id: i, name, phone, email };
    })
    .filter((d) => d.name);
}

export default function BulkInviteModal({
  organizationId,
  trainerId,
  onClose,
  onCreated,
}: {
  organizationId: string;
  trainerId: string;
  onClose: () => void;
  onCreated: (clients: ClientRow[]) => void;
}) {
  const { notify } = useToast();
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Draft[]>([]);
  const [results, setResults] = useState<Done[] | null>(null);
  const [working, setWorking] = useState(false);

  const fromFile = async (file: File) => {
    try {
      const { parseExcelFile } = await import("../../../lib/importParsing");
      const data = await parseExcelFile(file);
      const list = data
        .map((r, i) => ({
          id: i,
          name: pick(r, ["nombre", "alumno", "cliente", "name"]),
          phone: pick(r, ["whatsapp", "telefono", "celular", "phone", "movil"]),
          email: pick(r, ["correo", "email", "mail"]),
        }))
        .filter((d) => d.name);
      if (!list.length) notify("No encontramos una columna «Nombre» en el archivo.");
      setRows(list);
    } catch (e: any) {
      notify("No pudimos leer el archivo: " + e.message);
    }
  };

  const createAll = async () => {
    setWorking(true);
    const out: Done[] = [];
    const created: ClientRow[] = [];
    for (const r of rows) {
      try {
        const { client, code } = await createClientWithInvite({ organizationId, trainerId, fullName: r.name, email: r.email, phone: r.phone });
        created.push(client);
        out.push({ ...r, link: `${window.location.origin}${paths.register}?codigo=${code}`, pending: client.seat_pending });
      } catch (e: any) {
        out.push({ ...r, error: e.message ?? "No se pudo crear" });
      }
      setResults([...out]);
    }
    onCreated(created);
    setWorking(false);
  };

  const ok = (results ?? []).filter((r) => r.link);
  const pendingCount = ok.filter((r) => r.pending).length;

  return (
    <Modal title="Cargar varios alumnos" onClose={onClose} wide>
      {!results ? (
        <>
          <p className="note" style={{ marginTop: 0 }}>
            Pega una lista con <b>una persona por línea</b> — nombre, WhatsApp y correo, separados por coma (el WhatsApp y el
            correo son opcionales) — o sube un Excel con columnas <b>Nombre</b>, <b>WhatsApp</b> y <b>Correo</b>.
          </p>
          <FilePickerButton accept=".xlsx,.xls,.csv" onFile={fromFile} />
          <textarea
            className="input"
            style={{ minHeight: 110, margin: "8px 0" }}
            placeholder={"Ana Rojas, 71234567, ana@correo.com\nCarlos Paz, 76543210\nLucía Flores"}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button className="btn ghost" style={{ marginBottom: 14 }} onClick={() => setRows(parseText(text))} disabled={!text.trim()}>
            Revisar la lista
          </button>

          {rows.length > 0 && (
            <>
              <div style={{ overflowX: "auto", marginBottom: 12 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 12.5 }}>
                      <th style={{ padding: "6px 8px" }}>Nombre</th>
                      <th style={{ padding: "6px 8px" }}>WhatsApp</th>
                      <th style={{ padding: "6px 8px" }}>Correo</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} style={{ borderTop: "1px solid var(--line)" }}>
                        {(["name", "phone", "email"] as const).map((f) => (
                          <td key={f} style={{ padding: "5px 6px" }}>
                            <input className="input" style={{ padding: "5px 8px" }} value={r[f]} onChange={(e) => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, [f]: e.target.value } : x)))} />
                          </td>
                        ))}
                        <td style={{ padding: "5px 6px" }}>
                          <button type="button" aria-label={`Quitar ${r.name}`} onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} style={{ border: 0, background: "none", color: "var(--muted)", cursor: "pointer" }}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="btn" onClick={createAll} disabled={working || rows.some((r) => !r.name.trim())}>
                {working ? "Creando…" : `Crear ${rows.length} ${rows.length === 1 ? "alumno" : "alumnos"} con su invitación`}
              </button>
            </>
          )}
        </>
      ) : (
        <>
          <p className="note" style={{ marginTop: 0 }}>
            {working ? "Creando…" : `Listo: ${ok.length} ${ok.length === 1 ? "alumno creado" : "alumnos creados"}.`} Mándale a cada uno su invitación por
            WhatsApp (un toque por persona) o copia todos los enlaces.
            {pendingCount > 0 && ` ${pendingCount} ${pendingCount === 1 ? "queda" : "quedan"} esperando el pago de su cupo: pueden registrarse y llenar su formulario.`}
          </p>
          <div style={{ display: "grid", gap: 0, marginBottom: 12 }}>
            {results.map((r) => (
              <div key={r.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--line)", flexWrap: "wrap" }}>
                <b style={{ flex: "1 1 160px" }}>{r.name}</b>
                {r.error ? (
                  <span className="error-text" style={{ margin: 0 }}>{r.error}</span>
                ) : (
                  <WhatsAppButton small phone={r.phone} label={r.phone ? "Enviar invitación" : "Enviar (elige el contacto)"} text={inviteMessage(r.name, r.link!)} />
                )}
              </div>
            ))}
          </div>
          {!working && ok.length > 0 && (
            <button
              className="btn ghost"
              onClick={() => {
                navigator.clipboard?.writeText(ok.map((r) => `${r.name}: ${r.link}`).join("\n"));
                notify("Enlaces copiados.");
              }}
            >
              Copiar todos los enlaces
            </button>
          )}
          {!working && (
            <button className="btn" style={{ marginLeft: 8 }} onClick={onClose}>Terminar</button>
          )}
        </>
      )}
    </Modal>
  );
}
