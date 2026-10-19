import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Plus, FileUp, Film, Trash2 } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import {
  listExercises,
  listCatalog,
  bodyRegionOf,
  uploadExerciseMedia,
  removeExerciseMedia,
  getExerciseMediaUrl,
  type ExerciseRow,
  type CatalogItem,
} from "../../../services/exercises";
import { compressImage } from "../../../lib/imageCompress";
import NewExerciseModal from "./NewExerciseModal";
import ImportExercisesModal from "./ImportExercisesModal";
import Chip from "../../../components/ui/Chip";
import Loading from "../../../components/ui/Loading";

export default function ExercisesPage({ scope }: { scope: "global" | "trainer" }) {
  const { profile } = useAuth();
  const { notify } = useToast();
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [muscles, setMuscles] = useState<CatalogItem[]>([]);
  const [patterns, setPatterns] = useState<CatalogItem[]>([]);
  const [equipment, setEquipment] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [query, setQuery] = useState("");
  const [bodyFilter, setBodyFilter] = useState<"all" | "Superior" | "Inferior" | "Full body">("all");
  const [selected, setSelected] = useState<ExerciseRow | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [mediaUrl, setMediaUrl] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selected?.media_path) {
      getExerciseMediaUrl(selected.media_path).then(setMediaUrl).catch(() => setMediaUrl(""));
    } else {
      setMediaUrl("");
    }
  }, [selected?.media_path]);

  const pickMedia = async (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    if (!raw || !selected || !profile) return;
    setUploadingMedia(true);
    try {
      const file = await compressImage(raw);
      const folderPrefix = scope === "global" ? "global" : profile.organization_id!;
      const { path, type } = await uploadExerciseMedia({ exerciseId: selected.id, folderPrefix, uploaderId: profile.id, file });
      setExercises((es) => es.map((x) => (x.id === selected.id ? { ...x, media_path: path, media_type: type } : x)));
      setSelected((s) => (s ? { ...s, media_path: path, media_type: type } : s));
      notify("Archivo subido.");
    } catch (err: any) {
      notify(err.message);
    }
    setUploadingMedia(false);
    if (mediaInputRef.current) mediaInputRef.current.value = "";
  };

  const clearMedia = async () => {
    if (!selected?.media_path) return;
    try {
      await removeExerciseMedia(selected.id, selected.media_path);
      setExercises((es) => es.map((x) => (x.id === selected.id ? { ...x, media_path: null, media_type: null } : x)));
      setSelected((s) => (s ? { ...s, media_path: null, media_type: null } : s));
      notify("Archivo quitado.");
    } catch (err: any) {
      notify(err.message);
    }
  };

  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [ex, mu, pa, eq] = await Promise.all([
        listExercises(),
        listCatalog("muscle_group"),
        listCatalog("movement_pattern"),
        listCatalog("equipment"),
      ]);
      setExercises(ex);
      setMuscles(mu);
      setPatterns(pa);
      setEquipment(eq);
      if (ex.length) setSelected(ex[0]);
    } catch (err: any) {
      setLoadError(err.message ?? "No pudimos cargar la biblioteca de ejercicios.");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const muscleById = useMemo(() => Object.fromEntries(muscles.map((m) => [m.id, m])), [muscles]);
  const equipById = useMemo(() => Object.fromEntries(equipment.map((e) => [e.id, e])), [equipment]);

  const filtered = useMemo(() => {
    return exercises.filter((e) => {
      const matchesQuery = e.name.toLowerCase().includes(query.toLowerCase());
      const region = bodyRegionOf(muscleById[e.primary_muscle_id ?? ""]?.key ?? null);
      const matchesBody = bodyFilter === "all" || region === bodyFilter;
      return matchesQuery && matchesBody;
    });
  }, [exercises, query, bodyFilter, muscleById]);

  if (!profile) return null;

  const title = scope === "global" ? "Biblioteca global de ejercicios" : "Biblioteca de ejercicios";
  const sub =
    scope === "global"
      ? "Lo que publiques aquí lo ven todos los entrenadores."
      : "Ejercicios globales y los que creaste tú.";

  return (
    <div className="page">
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>{title}</h1>
          <p className="note">{sub}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn ghost" onClick={() => setShowImport(true)}>
            <FileUp size={16} /> Importar
          </button>
          <button className="btn" onClick={() => setShowNew(true)}>
            <Plus size={16} /> Nuevo ejercicio
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <input
          className="input"
          style={{ maxWidth: 260 }}
          placeholder="Buscar ejercicio"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(["all", "Superior", "Inferior", "Full body"] as const).map((b) => (
            <button
              key={b}
              onClick={() => setBodyFilter(b)}
              className="btn ghost"
              style={{
                padding: "6px 12px",
                fontSize: 13,
                background: bodyFilter === b ? "var(--pri)" : "transparent",
                color: bodyFilter === b ? "#fff" : "var(--pri)",
              }}
            >
              {b === "all" ? "Todos" : b}
            </button>
          ))}
        </div>
      </div>

      {loadError && <p className="error-text" style={{ marginBottom: 14 }}>{loadError}</p>}
      {loading ? (
        <Loading />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)", gap: 18 }}>
          <div className="panel">
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14.5 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 13 }}>
                    <th style={{ padding: "10px 14px" }}>Ejercicio</th>
                    <th style={{ padding: "10px 14px" }}>Grupo</th>
                    <th style={{ padding: "10px 14px" }}>Nivel</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr
                      key={e.id}
                      onClick={() => setSelected(e)}
                      style={{
                        borderTop: "1px solid var(--line)",
                        cursor: "pointer",
                        background: selected?.id === e.id ? "var(--pri-soft)" : undefined,
                      }}
                    >
                      <td style={{ padding: "10px 14px" }}>
                        <b>{e.name}</b>
                      </td>
                      <td style={{ padding: "10px 14px" }}>{muscleById[e.primary_muscle_id ?? ""]?.label ?? "—"}</td>
                      <td style={{ padding: "10px 14px" }}>{difficultyLabel(e.difficulty)}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={3} className="note" style={{ padding: 16 }}>
                        No hay ejercicios con ese filtro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {selected && (
            <div className="panel">
              <div className="hd">
                <h3>{selected.name}</h3>
              </div>
              <div className="bd">
                <div style={{ marginBottom: 14 }}>
                  {selected.media_path && mediaUrl ? (
                    <div>
                      {selected.media_type === "video" ? (
                        <video src={mediaUrl} controls style={{ width: "100%", maxHeight: 280, borderRadius: 8, background: "#000" }} />
                      ) : (
                        <img src={mediaUrl} alt={selected.name} style={{ width: "100%", maxHeight: 280, objectFit: "contain", borderRadius: 8 }} />
                      )}
                      <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 12.5, marginTop: 8 }} onClick={clearMedia}>
                        <Trash2 size={13} /> Quitar
                      </button>
                    </div>
                  ) : (
                    <div>
                      <input ref={mediaInputRef} type="file" accept="image/*,video/mp4,video/webm" onChange={pickMedia} style={{ display: "none" }} />
                      <button className="btn ghost" style={{ padding: "6px 14px", fontSize: 13 }} onClick={() => mediaInputRef.current?.click()} disabled={uploadingMedia}>
                        <Film size={14} /> {uploadingMedia ? "Subiendo…" : "Subir foto o video de demostración"}
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {selected.goals.map((g) => (
                    <Chip key={g} tone="pri">{g}</Chip>
                  ))}
                  {selected.equipment_ids.map((id) => (
                    <Chip key={id}>{equipById[id]?.label ?? id}</Chip>
                  ))}
                </div>
                <p style={{ marginBottom: 8 }}>
                  <b>Indicaciones.</b> {selected.technical_cues || "Sin indicaciones registradas todavía."}
                </p>
                <p>
                  <b>Errores frecuentes.</b> {selected.common_mistakes || "Sin observaciones registradas todavía."}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {showNew && (
        <NewExerciseModal
          scope={scope}
          organizationId={profile.organization_id}
          ownerId={profile.id}
          muscles={muscles}
          patterns={patterns}
          equipment={equipment}
          onClose={() => setShowNew(false)}
          onCreated={(ex) => {
            setExercises((xs) => [ex, ...xs]);
            setSelected(ex);
            setShowNew(false);
          }}
        />
      )}

      {showImport && (
        <ImportExercisesModal
          scope={scope}
          organizationId={profile.organization_id}
          ownerId={profile.id}
          muscles={muscles}
          patterns={patterns}
          equipment={equipment}
          onClose={() => setShowImport(false)}
          onImported={(created) => {
            setExercises((xs) => [...created, ...xs]);
            if (created[0]) setSelected(created[0]);
            setShowImport(false);
            notify(`${created.length} ejercicio${created.length === 1 ? "" : "s"} importado${created.length === 1 ? "" : "s"}.`);
          }}
        />
      )}
    </div>
  );
}

function difficultyLabel(d: ExerciseRow["difficulty"]): string {
  if (d === "beginner") return "Principiante";
  if (d === "intermediate") return "Intermedio";
  if (d === "advanced") return "Avanzado";
  return "—";
}
