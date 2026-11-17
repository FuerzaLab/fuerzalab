import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import WhatsAppButton from "./WhatsAppButton";
import { ageFrom, type Guardian } from "../lib/minors";
import { compressImage } from "../lib/imageCompress";
import { getOrgBrand } from "../services/brand";
import type { ClientProfileRow, ClientRow } from "../services/clients";
import {
  activeGuardianLink,
  clearGuardianConsent,
  createGuardianLink,
  downloadGuardianConsentPdf,
  guardianConsentUrl,
  guardianLinkUrl,
  revokeGuardianLinks,
  setGuardianPhotos,
  uploadGuardianConsent,
  type GuardianLink,
} from "../services/guardianConsent";

/**
 * Ficha del alumno menor de edad: datos de su tutor, PDF de la autorización
 * para firmar, foto de la autorización firmada y su estado.
 */
export default function MinorConsentPanel({ client, intake, onChange }: { client: ClientRow; intake: ClientProfileRow; onChange: (c: ClientRow) => void }) {
  const { profile } = useAuth();
  const { notify } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  // Lo que marcó el tutor en el papel sobre las fotos de progreso.
  const [photosOk, setPhotosOk] = useState<boolean | null>(null);
  const g = (intake.guardian ?? null) as Guardian | null;
  const age = ageFrom(intake.birth_date);
  const ok = !!client.guardian_consent_at;
  // Autorización del formulario anterior: hay que renovarla antes de esta fecha (part4u).
  const renewBy = ok && client.guardian_consent_renew_by ? client.guardian_consent_renew_by : null;
  const renewOverdue = !!renewBy && new Date(renewBy + "T23:59:59") < new Date();
  const showUpload = !ok || !!renewBy;
  // Enlace para que el tutor lea los mensajes.
  const [link, setLink] = useState<GuardianLink | null | undefined>(undefined);
  useEffect(() => {
    activeGuardianLink(client.id).then(setLink).catch(() => setLink(null));
  }, [client.id]);

  return (
    <div className="panel" style={{ marginBottom: 18, borderLeft: `4px solid ${ok ? "var(--ok)" : "#E3A21A"}` }}>
      <div className="hd" style={{ flexWrap: "wrap", gap: 8 }}>
        <h3>Menor de edad{age != null ? ` · ${age} años` : ""}</h3>
        <span className={`chip ${ok && !renewBy ? "ok" : renewOverdue || !ok ? "bad" : "warn"}`}>
          {!ok
            ? "Falta la autorización del tutor"
            : renewBy
              ? renewOverdue
                ? "Venció el plazo para renovar la autorización"
                : `Renovar la autorización antes del ${new Date(renewBy + "T12:00:00").toLocaleDateString("es")}`
              : `Autorización recibida el ${new Date(client.guardian_consent_at!).toLocaleDateString("es")}`}
        </span>
      </div>
      <div className="bd" style={{ display: "grid", gap: 12 }}>
        {g ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span>
              <b>{g.name}</b> <span className="note">· {g.relationship} · CI {g.ci}</span>
              <div className="note">📱 {g.phone}</div>
            </span>
            <WhatsAppButton
              phone={g.phone}
              small
              label="Escribir al tutor"
              text={`¡Hola ${g.name.split(" ")[0]}! Soy ${profile?.full_name?.split(" ")[0] ?? "el entrenador"}, entrenador de ${client.full_name.split(" ")[0]}. Para que pueda entrenar con nosotros necesito tu autorización firmada; te la llevo para que la firmes.`}
            />
          </div>
        ) : (
          <p className="note" style={{ margin: 0 }}>Todavía no cargó los datos de su madre, padre o tutor (se piden en el formulario de ingreso).</p>
        )}

        {renewBy && (
          <p style={{ margin: 0, fontSize: 14 }}>
            🔁 Actualizamos el formulario de autorización. Pide que lo firmen de nuevo (descárgalo abajo) y sube la foto de la hoja
            firmada{renewOverdue ? "" : ` antes del ${new Date(renewBy + "T12:00:00").toLocaleDateString("es")}`}.{" "}
            {renewOverdue
              ? "Venció el plazo: hasta que la subas, la ficha está bloqueada (no puede usar la app ni se le pueden cargar datos)."
              : "Si no se renueva a tiempo, la ficha se bloquea hasta que la subas."}
          </p>
        )}
        {showUpload && (
          <>
            {!ok && (
            <p style={{ margin: 0, fontSize: 14 }}>
              🔒 Mientras falte la autorización, <b>{client.full_name.split(" ")[0]} no puede usar la app</b> (solo ve un aviso de espera) y
              <b> no se le pueden registrar entrenamientos, evaluaciones, medidas ni fotos</b>. Sí puedes ir armándole el plan.
            </p>
            )}
            <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4, fontSize: 14 }}>
              <li>Descarga la autorización, imprímela y haz que la firme su madre, padre o tutor.</li>
              <li>Indica qué marcó sobre las fotos de progreso y sube una foto de la hoja firmada. Queda guardada en un lugar privado: solo la ves tú (y FuerzaLab, si necesita verificarla).</li>
            </ol>
            <div className="minor-photos">
              <span>En la hoja firmada, las fotos de progreso:</span>
              <label><input type="radio" name="photos" checked={photosOk === true} onChange={() => setPhotosOk(true)} /> Las autoriza</label>
              <label><input type="radio" name="photos" checked={photosOk === false} onChange={() => setPhotosOk(false)} /> No las autoriza</label>
            </div>
          </>
        )}
        {ok && !renewBy && (
          <div className="minor-photos">
            <span>
              Fotos de progreso: <b>{client.guardian_photos_ok ? "autorizadas" : "no autorizadas (desactivadas para este alumno)"}</b>
            </span>
            <button
              className="link-btn"
              style={{ fontSize: 13 }}
              onClick={async () => {
                try {
                  onChange(await setGuardianPhotos(client, !client.guardian_photos_ok));
                } catch (e: any) {
                  notify(e.message);
                }
              }}
            >
              {client.guardian_photos_ok ? "Marcar como no autorizadas" : "Marcar como autorizadas"}
            </button>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const brand = profile?.organization_id ? await getOrgBrand(profile.organization_id).catch(() => null) : null;
                await downloadGuardianConsentPdf({
                  clientName: client.full_name,
                  birthDate: intake.birth_date,
                  guardian: g,
                  trainerName: profile?.full_name ?? "",
                  orgName: brand?.name ?? "",
                });
              } catch (e: any) {
                notify("No se pudo generar el PDF: " + e.message);
              }
              setBusy(false);
            }}
          >
            Descargar la autorización (PDF)
          </button>
          {ok && !renewBy ? (
            <>
              <button
                className="btn ghost"
                onClick={async () => {
                  try {
                    window.open(await guardianConsentUrl(client.guardian_consent_path!), "_blank");
                  } catch (e: any) {
                    notify(e.message);
                  }
                }}
              >
                Ver la autorización firmada
              </button>
              <button
                className="link-btn"
                style={{ fontSize: 13 }}
                onClick={async () => {
                  if (!window.confirm("¿Quitar la autorización cargada? (por ejemplo, si subiste la foto equivocada)")) return;
                  try {
                    onChange(await clearGuardianConsent(client));
                  } catch (e: any) {
                    notify(e.message);
                  }
                }}
              >
                Quitar
              </button>
            </>
          ) : (
            <button
              className="btn"
              disabled={busy}
              onClick={() => (photosOk === null ? notify("Primero indica si en la hoja autorizó o no las fotos de progreso.") : fileRef.current?.click())}
            >
              {busy ? "Subiendo…" : "Subir la autorización firmada"}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            style={{ display: "none" }}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f || !profile) return;
              setBusy(true);
              try {
                const file = f.type.startsWith("image/") ? await compressImage(f).catch(() => f) : f;
                onChange(await uploadGuardianConsent(client, file, profile.id, photosOk === true));
                notify("Autorización guardada.");
              } catch (err: any) {
                notify(err.message);
              }
              setBusy(false);
            }}
          />
        </div>
        {ok && !renewOverdue && (
          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, display: "grid", gap: 8 }}>
            <b style={{ fontSize: 14 }}>Mensajes para el tutor</b>
            <p className="note" style={{ margin: 0 }}>
              Su madre, padre o tutor puede leer los mensajes entre tú y {client.full_name.split(" ")[0]} con un enlace privado de solo
              lectura (no puede escribir). Vence en 90 días; puedes anularlo cuando quieras.
            </p>
            {link === undefined ? null : link ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span className="note" style={{ fontSize: 12.5 }}>Enlace activo hasta el {new Date(link.expires_at).toLocaleDateString("es")}.</span>
                {g?.phone && (
                  <WhatsAppButton
                    phone={g.phone}
                    small
                    label="Enviar al tutor"
                    text={`¡Hola ${g.name.split(" ")[0]}! Con este enlace puedes leer cuando quieras los mensajes entre ${client.full_name.split(" ")[0]} y su entrenador en FuerzaLab (solo lectura). Es privado: no lo compartas. ${guardianLinkUrl(link.token)}`}
                  />
                )}
                <button
                  className="btn ghost"
                  style={{ padding: "4px 10px", fontSize: 12.5 }}
                  onClick={() => {
                    navigator.clipboard?.writeText(guardianLinkUrl(link.token));
                    notify("Enlace copiado.");
                  }}
                >
                  Copiar enlace
                </button>
                <button
                  className="link-btn"
                  style={{ fontSize: 13, color: "var(--bad)" }}
                  onClick={async () => {
                    if (!window.confirm("¿Anular el enlace? El tutor ya no podrá leer los mensajes con él.")) return;
                    await revokeGuardianLinks(client.id);
                    setLink(null);
                    notify("Enlace anulado.");
                  }}
                >
                  Anular
                </button>
              </div>
            ) : (
              <button
                className="btn ghost"
                style={{ justifySelf: "start" }}
                onClick={async () => {
                  try {
                    setLink(await createGuardianLink(client.id));
                    notify("Enlace creado: envíaselo al tutor.");
                  } catch (e: any) {
                    notify(e.message);
                  }
                }}
              >
                Crear enlace para el tutor
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
