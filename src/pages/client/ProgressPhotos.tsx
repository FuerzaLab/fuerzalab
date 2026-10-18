import { useEffect, useState, type ChangeEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import Modal from "../../components/ui/Modal";
import { compressImage } from "../../lib/imageCompress";
import ConfirmModal from "../../components/ui/ConfirmModal";
import { getMyClientId } from "../../services/clients";
import {
  listProgressPhotos,
  uploadProgressPhotoSet,
  getPhotoUrl,
  deleteProgressPhoto,
  groupPhotosBySession,
  ANGLE_LABEL,
  ANGLE_ORDER,
  type ProgressPhotoRow,
  type PhotoAngle,
} from "../../services/progressPhotos";

export default function ClientProgressPhotos() {
  const { profile } = useAuth();
  const { notify } = useToast();
  const [clientId, setClientId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<ProgressPhotoRow[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [lightboxSession, setLightboxSession] = useState<ProgressPhotoRow[] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [toDelete, setToDelete] = useState<ProgressPhotoRow | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const id = await getMyClientId();
      setClientId(id);
      if (id) {
        const list = await listProgressPhotos(id);
        setPhotos(list);
        const entries = await Promise.all(list.map(async (p) => [p.id, await getPhotoUrl(p.storage_path)] as const));
        setUrls(Object.fromEntries(entries));
      }
    } catch (e: any) {
      notify(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sessions = groupPhotosBySession(photos);

  return (
    <div className="page">
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Mi progreso</h1>
          <p className="note">Fotos para ver tu propio cambio en el tiempo. Solo vos y tu entrenador las ven.</p>
        </div>
        {clientId && (
          <button className="btn" onClick={() => setShowUpload(true)}>
            <Plus size={16} /> Subir fotos
          </button>
        )}
      </div>

      {loading ? (
        <p className="note">Cargando…</p>
      ) : !clientId ? (
        <p className="note">Tu cuenta todavía no está vinculada a una ficha de cliente.</p>
      ) : sessions.length === 0 ? (
        <p className="note">Todavía no subiste ninguna foto.</p>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {sessions.map((s) => (
            <div key={s.key} className="panel">
              <div className="hd"><h3>{s.date ? new Date(s.date).toLocaleDateString("es") : "Sin fecha"}</h3></div>
              <div className="bd" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 12 }}>
                {s.photos.map((p, i) => (
                  <div key={p.id} style={{ borderRadius: 8, overflow: "hidden", border: "1px solid var(--line)" }}>
                    <img
                      src={urls[p.id]}
                      alt={p.angle ? ANGLE_LABEL[p.angle] : ""}
                      style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", cursor: "pointer" }}
                      onClick={() => { setLightboxSession(s.photos); setLightboxIndex(i); }}
                    />
                    <div style={{ padding: 6, fontSize: 12 }}>
                      <div className="note" style={{ marginBottom: 4 }}>{p.angle ? ANGLE_LABEL[p.angle] : "Sin etiquetar"}</div>
                      <button onClick={() => setToDelete(p)} style={{ border: 0, background: "none", color: "var(--bad)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                        <Trash2 size={13} /> Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showUpload && clientId && profile?.organization_id && (
        <UploadPhotoSetModal
          organizationId={profile.organization_id}
          clientId={clientId}
          onClose={() => setShowUpload(false)}
          onUploaded={async () => {
            setShowUpload(false);
            await load();
            notify("Fotos subidas.");
          }}
        />
      )}

      {lightboxSession && (
        <Modal
          title={ANGLE_LABEL[lightboxSession[lightboxIndex].angle ?? "front"]}
          onClose={() => setLightboxSession(null)}
        >
          <img src={urls[lightboxSession[lightboxIndex].id]} alt="" style={{ width: "100%", borderRadius: 8, marginBottom: 12 }} />
          {lightboxSession.length > 1 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {lightboxSession.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setLightboxIndex(i)}
                  className="btn ghost"
                  style={{ padding: "4px 10px", fontSize: 12.5, background: i === lightboxIndex ? "var(--pri)" : "transparent", color: i === lightboxIndex ? "#fff" : "var(--pri)" }}
                >
                  {p.angle ? ANGLE_LABEL[p.angle] : "—"}
                </button>
              ))}
            </div>
          )}
          {lightboxSession[lightboxIndex].notes && <p>{lightboxSession[lightboxIndex].notes}</p>}
        </Modal>
      )}

      {toDelete && (
        <ConfirmModal
          title="Eliminar foto"
          message="¿Eliminar esta foto? No se puede deshacer."
          confirmLabel="Eliminar"
          danger
          onClose={() => setToDelete(null)}
          onConfirm={async () => {
            await deleteProgressPhoto(toDelete.id, toDelete.storage_path);
            setPhotos((ps) => ps.filter((x) => x.id !== toDelete.id));
            setToDelete(null);
            notify("Foto eliminada.");
          }}
        />
      )}
    </div>
  );
}

function UploadPhotoSetModal({
  organizationId,
  clientId,
  onClose,
  onUploaded,
}: {
  organizationId: string;
  clientId: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const { notify } = useToast();
  const [files, setFiles] = useState<Partial<Record<PhotoAngle, File>>>({});
  const [takenAt, setTakenAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);

  const pickFile = (angle: PhotoAngle) => async (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    if (!raw) return;
    const compressed = await compressImage(raw);
    setFiles((f) => ({ ...f, [angle]: compressed }));
  };

  const submit = async () => {
    if (!Object.values(files).some(Boolean)) {
      notify("Elige al menos una foto.");
      return;
    }
    setUploading(true);
    try {
      await uploadProgressPhotoSet({ organizationId, clientId, files, takenAt, notes, visibility: "client_and_trainer" });
      onUploaded();
    } catch (e: any) {
      notify(e.message);
      setUploading(false);
    }
  };

  return (
    <Modal title="Subir fotos de progreso" onClose={onClose}>
      <p className="note" style={{ marginBottom: 14 }}>Subí las que tengas — no hace falta completar las 4 juntas.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 16 }}>
        {ANGLE_ORDER.map((angle) => (
          <div key={angle}>
            <label className="field-label">{ANGLE_LABEL[angle]}</label>
            <input type="file" accept="image/*" onChange={pickFile(angle)} style={{ fontSize: 12.5 }} />
          </div>
        ))}
      </div>
      <label className="field-label">Fecha</label>
      <input type="date" className="input" style={{ marginBottom: 12 }} value={takenAt} onChange={(e) => setTakenAt(e.target.value)} />
      <label className="field-label">Notas (opcional)</label>
      <textarea className="input" style={{ minHeight: 60, marginBottom: 16 }} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <button className="btn" onClick={submit} disabled={uploading}>{uploading ? "Subiendo…" : "Subir"}</button>
    </Modal>
  );
}
