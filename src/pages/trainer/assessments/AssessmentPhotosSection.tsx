import { useEffect, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import Loading from "../../../components/ui/Loading";
import { paths } from "../../../routes/paths";
import {
  ANGLE_LABEL,
  ANGLE_ORDER,
  deleteProgressPhoto,
  getPhotoUrl,
  listPhotosOnDate,
  setPhotoVisibility,
  uploadProgressPhoto,
  type PhotoAngle,
  type PhotoVisibility,
  type ProgressPhotoRow,
} from "../../../services/progressPhotos";

/**
 * Fotos de progreso dentro de una evaluación. No son una tabla aparte:
 * son las mismas fotos de la pantalla "Fotos", con la fecha de esta
 * evaluación — así siguen apareciendo en Fotos, en la comparación
 * antes/ahora y en Reportes, como siempre.
 */
export default function AssessmentPhotosSection({
  clientId,
  date,
  onCountChange,
}: {
  clientId: string;
  /** Fecha de la evaluación (AAAA-MM-DD). */
  date: string;
  onCountChange: (n: number) => void;
}) {
  const { profile } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<ProgressPhotoRow[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<PhotoAngle | null>(null);
  const [visibility, setVisibility] = useState<PhotoVisibility>("client_and_trainer");
  const [toDelete, setToDelete] = useState<ProgressPhotoRow | null>(null);

  const load = async () => {
    try {
      const list = await listPhotosOnDate(clientId, date);
      setPhotos(list);
      onCountChange(list.length);
      const entries = await Promise.all(list.map(async (p) => [p.id, await getPhotoUrl(p.storage_path).catch(() => "")] as const));
      setUrls(Object.fromEntries(entries));
    } catch (e: any) {
      notify(e.message);
      setPhotos([]);
    }
  };

  useEffect(() => {
    setPhotos(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, date]);

  const upload = async (angle: PhotoAngle, file: File | undefined) => {
    if (!file || !profile?.organization_id) return;
    setUploading(angle);
    try {
      await uploadProgressPhoto({ organizationId: profile.organization_id, clientId, file, takenAt: date, notes: "", visibility, angle });
      await load();
      notify(`Foto ${ANGLE_LABEL[angle].toLowerCase()} guardada.`);
    } catch (e: any) {
      notify(e.message);
    }
    setUploading(null);
  };

  if (photos === null) return <Loading />;

  const byAngle = new Map<PhotoAngle, ProgressPhotoRow>();
  const others: ProgressPhotoRow[] = [];
  for (const p of photos) {
    if (p.angle && !byAngle.has(p.angle)) byAngle.set(p.angle, p);
    else others.push(p);
  }

  const Thumb = ({ p, label }: { p: ProgressPhotoRow; label: string }) => (
    <div style={{ position: "relative" }}>
      {urls[p.id] ? (
        <img src={urls[p.id]} alt={label} style={{ width: "100%", aspectRatio: "3 / 4", objectFit: "cover", borderRadius: 8, display: "block" }} />
      ) : (
        <div style={{ width: "100%", aspectRatio: "3 / 4", borderRadius: 8, background: "var(--bg)" }} />
      )}
      <button
        className="btn ghost"
        title="Eliminar foto"
        style={{ position: "absolute", top: 6, right: 6, padding: "4px 6px", background: "#fff", color: "var(--bad)" }}
        onClick={() => setToDelete(p)}
      >
        <Trash2 size={14} />
      </button>
      <select
        className="input"
        style={{ marginTop: 6, fontSize: 12.5, padding: "4px 8px" }}
        value={p.visibility}
        onChange={async (e) => {
          const v = e.target.value as PhotoVisibility;
          try {
            await setPhotoVisibility(p.id, v);
            setPhotos((ps) => (ps ? ps.map((x) => (x.id === p.id ? { ...x, visibility: v } : x)) : ps));
          } catch (err: any) {
            notify(err.message);
          }
        }}
      >
        <option value="client_and_trainer">La ve el cliente</option>
        <option value="trainer_only">Solo vos</option>
      </select>
    </div>
  );

  return (
    <div className="panel">
      <div className="hd">
        <h3>Fotos de esta evaluación</h3>
        <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 12.5 }} onClick={() => navigate(paths.trainerProgressPhotos)}>
          Ver todas las fotos
        </button>
      </div>
      <div className="bd">
        <p className="note" style={{ marginTop: 0 }}>
          Se guardan con la fecha de la evaluación y aparecen también en Fotos, en la comparación antes/ahora y en Reportes.
          Podés subir los cuatro ángulos o solo los que tengas.
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
          <label className="field-label" style={{ margin: 0 }}>Las fotos nuevas:</label>
          <select className="input" style={{ width: "auto" }} value={visibility} onChange={(e) => setVisibility(e.target.value as PhotoVisibility)}>
            <option value="client_and_trainer">Las ve el cliente</option>
            <option value="trainer_only">Solo las ves vos</option>
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
          {ANGLE_ORDER.map((angle) => {
            const p = byAngle.get(angle);
            return (
              <div key={angle}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{ANGLE_LABEL[angle]}</div>
                {p ? (
                  <Thumb p={p} label={ANGLE_LABEL[angle]} />
                ) : (
                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      aspectRatio: "3 / 4",
                      border: "1.5px dashed var(--line)",
                      borderRadius: 8,
                      cursor: uploading ? "wait" : "pointer",
                      color: "var(--muted)",
                      fontSize: 13,
                      textAlign: "center",
                      padding: 8,
                    }}
                  >
                    {uploading === angle ? (
                      "Subiendo…"
                    ) : (
                      <>
                        <Upload size={20} />
                        Subir foto
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      disabled={!!uploading}
                      onChange={(e) => {
                        upload(angle, e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
            );
          })}
        </div>

        {others.length > 0 && (
          <>
            <div style={{ fontWeight: 600, fontSize: 13, margin: "16px 0 6px" }}>Otras fotos de ese día</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
              {others.map((p) => (
                <Thumb key={p.id} p={p} label="Foto de progreso" />
              ))}
            </div>
          </>
        )}
      </div>

      {toDelete && (
        <ConfirmModal
          title="Eliminar foto"
          message="¿Eliminar esta foto? Se borra también de Fotos y de los reportes. No se puede deshacer."
          confirmLabel="Eliminar"
          danger
          onClose={() => setToDelete(null)}
          onConfirm={async () => {
            const p = toDelete;
            setToDelete(null);
            try {
              await deleteProgressPhoto(p.id, p.storage_path);
              await load();
            } catch (e: any) {
              notify(e.message);
            }
          }}
        />
      )}
    </div>
  );
}
