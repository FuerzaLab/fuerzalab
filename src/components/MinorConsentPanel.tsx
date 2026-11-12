import { useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import WhatsAppButton from "./WhatsAppButton";
import { ageFrom, type Guardian } from "../lib/minors";
import { compressImage } from "../lib/imageCompress";
import { getOrgBrand } from "../services/brand";
import type { ClientProfileRow, ClientRow } from "../services/clients";
import { clearGuardianConsent, downloadGuardianConsentPdf, guardianConsentUrl, setGuardianPhotos, uploadGuardianConsent } from "../services/guardianConsent";

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

  return (
    <div className="panel" style={{ marginBottom: 18, borderLeft: `4px solid ${ok ? "var(--ok)" : "#E3A21A"}` }}>
      <div className="hd" style={{ flexWrap: "wrap", gap: 8 }}>
        <h3>Menor de edad{age != null ? ` · ${age} años` : ""}</h3>
        <span className={`chip ${ok ? "ok" : "warn"}`}>
          {ok ? `Autorización recibida el ${new Date(client.guardian_consent_at!).toLocaleDateString("es")}` : "Falta la autorización del tutor"}
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

        {!ok && (
          <>
            <p style={{ margin: 0, fontSize: 14 }}>
              🔒 Mientras falte la autorización, <b>{client.full_name.split(" ")[0]} no puede usar la app</b> (solo ve un aviso de espera).
            </p>
            <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4, fontSize: 14 }}>
              <li>Descarga la autorización, imprímela y haz que la firme su madre, padre o tutor.</li>
              <li>Indica qué marcó sobre las fotos de progreso y sube una foto de la hoja firmada. Queda guardada en un lugar que solo ves tú.</li>
            </ol>
            <div className="minor-photos">
              <span>En la hoja firmada, las fotos de progreso:</span>
              <label><input type="radio" name="photos" checked={photosOk === true} onChange={() => setPhotosOk(true)} /> Las autoriza</label>
              <label><input type="radio" name="photos" checked={photosOk === false} onChange={() => setPhotosOk(false)} /> No las autoriza</label>
            </div>
          </>
        )}
        {ok && (
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
          {ok ? (
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
      </div>
    </div>
  );
}
