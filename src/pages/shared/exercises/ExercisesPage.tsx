import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Plus, FileUp, Film, Trash2, Pencil } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../../../contexts/ToastContext";
import {
  listExercises,
  listCatalog,
  bodyRegionOf,
  uploadExerciseMedia,
  removeExerciseMedia,
  getExerciseMediaUrl,
  listVariationsFor,
  addVariation,
  removeVariation,
  RELATION_LABEL,
  deleteExercise,
  getProfileNames,
  type ExerciseRow,
  type CatalogItem,
  type ExerciseVariationRow,
  type VariationRelation,
} from "../../../services/exercises";
import { compressImage } from "../../../lib/imageCompress";
import NewExerciseModal from "./NewExerciseModal";
import ImportExercisesModal from "./ImportExercisesModal";
import Chip from "../../../components/ui/Chip";
import Loading from "../../../components/ui/Loading";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import Modal from "../../../components/ui/Modal";
import SearchSelect from "../../../components/ui/SearchSelect";

export default function ExercisesPage({ scope }: { scope: "global" | "trainer" }) {
  const { profile, actingTrainerId, can } = useAuth();
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
  const [variations, setVariations] = useState<ExerciseVariationRow[]>([]);
  const [addingVariation, setAddingVariation] = useState(false);
  const [newRelatedId, setNewRelatedId] = useState("");
  const [newRelation, setNewRelation] = useState<VariationRelation>("variant");
  const [newVariationNotes, setNewVariationNotes] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  // Antes de la primera subida se pide confirmar que se tienen los derechos
  // de la foto o el video (se recuerda en este dispositivo).
  const [askMediaRights, setAskMediaRights] = useState(false);
  const [rightsChecked, setRightsChecked] = useState(false);
  const RIGHTS_KEY = "fl-media-rights-ok";
  const startMediaUpload = () => {
    let ok = false;
    try {
      ok = localStorage.getItem(RIGHTS_KEY) === "1";
    } catch {
      /* sin almacenamiento: se pregunta cada vez */
    }
    if (ok) mediaInputRef.current?.click();
    else {
      setRightsChecked(false);
      setAskMediaRights(true);
    }
  };
  const [editingExercise, setEditingExercise] = useState<ExerciseRow | null>(null);
  const [toDelete, setToDelete] = useState<ExerciseRow | null>(null);
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (selected?.media_path) {
      getExerciseMediaUrl(selected.media_path).then(setMediaUrl).catch(() => setMediaUrl(""));
    } else {
      setMediaUrl("");
    }
  }, [selected?.media_path]);

  useEffect(() => {
    setAddingVariation(false);
    setNewRelatedId("");
    setNewVariationNotes("");
    if (selected) {
      listVariationsFor(selected.id).then(setVariations).catch((e: any) => notify(e.message));
    } else {
      setVariations([]);
    }
  }, [selected?.id]);

  const pickMedia = async (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    if (!raw || !selected || !profile) return;
    setUploadingMedia(true);
    try {
      const file = await compressImage(raw);
      const folderPrefix = scope === "global" ? "global" : profile.organization_id!;
      const { path, type } = await uploadExerciseMedia({ exerciseId: selected.id, folderPrefix, uploaderId: (actingTrainerId ?? profile.id), file });
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
      if (scope === "global") {
        const ownerIds = Array.from(new Set(ex.map((x) => x.owner_id).filter((x): x is string => !!x)));
        setOwnerNames(await getProfileNames(ownerIds).catch((): Record<string, string> => ({})));
      }
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

  // Qué ejercicios se pueden editar/eliminar desde esta pantalla: en la
  // biblioteca global (Super Admin), los globales; en la del entrenador,
  // solo los propios — los globales se ven, pero no se tocan.
  // (El Super Admin puede todos — requiere part3q_migration.sql.)
  const canEdit = (e: ExerciseRow) =>
    scope === "global"
      ? true
      : e.scope === "trainer" && e.owner_id === (actingTrainerId ?? profile.id) && can("exercises", "write");

  // En la vista del Super Admin, de quién es cada ejercicio que no es global.
  const originLabel = (e: ExerciseRow) =>
    e.scope === "global" ? "Global" : `De ${ownerNames[e.owner_id ?? ""] ?? "un entrenador"}`;

  const confirmDelete = async () => {
    const ex = toDelete;
    if (!ex) return;
    setToDelete(null);
    try {
      const result = await deleteExercise(ex.id);
      const rest = exercises.filter((x) => x.id !== ex.id);
      setExercises(rest);
      setSelected((s) => (s?.id === ex.id ? rest[0] ?? null : s));
      notify(
        result === "deleted"
          ? "Ejercicio eliminado."
          : "Ejercicio quitado de la biblioteca. Como ya se usó en rutinas o en el historial, ahí se sigue viendo."
      );
    } catch (err: any) {
      notify(err.message);
    }
  };

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
                        {scope === "global" && e.scope !== "global" && (
                          <div className="note" style={{ fontSize: 12 }}>{originLabel(e)}</div>
                        )}
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
                {canEdit(selected) && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 12.5 }} onClick={() => setEditingExercise(selected)}>
                      <Pencil size={13} /> Editar
                    </button>
                    <button
                      className="btn ghost"
                      style={{ padding: "4px 10px", fontSize: 12.5, color: "var(--bad)" }}
                      onClick={() => setToDelete(selected)}
                    >
                      <Trash2 size={13} /> Eliminar
                    </button>
                  </div>
                )}
              </div>
              <div className="bd">
                {scope === "global" && (
                  <div style={{ marginBottom: 12 }}>
                    <Chip tone={selected.scope === "global" ? "pri" : "warn"}>{originLabel(selected)}</Chip>
                    {selected.scope !== "global" && (
                      <span className="note" style={{ marginLeft: 8, fontSize: 12.5 }}>
                        Está en la biblioteca de ese entrenador, no en la global.
                      </span>
                    )}
                  </div>
                )}
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
                      <button className="btn ghost" style={{ padding: "6px 14px", fontSize: 13 }} onClick={startMediaUpload} disabled={uploadingMedia}>
                        <Film size={14} /> {uploadingMedia ? "Subiendo…" : "Subir foto o video de demostración"}
                      </button>
                      <p className="note" style={{ fontSize: 12, margin: "6px 0 0" }}>
                        Solo fotos o videos tuyos, o que tengas permiso para usar.
                      </p>
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
                <p style={{ marginBottom: 16 }}>
                  <b>Errores frecuentes.</b> {selected.common_mistakes || "Sin observaciones registradas todavía."}
                </p>

                <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <b>Alternativas y progresiones</b>
                    {!addingVariation && (
                      <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 12.5 }} onClick={() => setAddingVariation(true)}>
                        <Plus size={12} /> Agregar
                      </button>
                    )}
                  </div>

                  {variations.length === 0 && !addingVariation && (
                    <p className="note">Sin alternativas cargadas todavía — útil para cuando a un cliente le falta el equipo, o para subir/bajar la dificultad.</p>
                  )}

                  {variations.length > 0 && (
                    <div style={{ display: "grid", gap: 6, marginBottom: addingVariation ? 14 : 0 }}>
                      {variations.map((v) => (
                        <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                          <span>
                            <Chip tone={v.relation === "progression" ? "warn" : v.relation === "regression" ? "ok" : ""}>{RELATION_LABEL[v.relation]}</Chip>{" "}
                            {v.related_exercise_name}
                            {v.notes && <span className="note"> — {v.notes}</span>}
                          </span>
                          <button
                            className="btn ghost"
                            style={{ padding: "3px 8px", fontSize: 12 }}
                            onClick={async () => {
                              await removeVariation(v.id);
                              setVariations((vs) => vs.filter((x) => x.id !== v.id));
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {addingVariation && (
                    <div style={{ display: "grid", gap: 10 }}>
                      <SearchSelect className="input" value={newRelatedId} onChange={(e) => setNewRelatedId(e.target.value)}>
                        <option value="">Elige un ejercicio</option>
                        {exercises.filter((e) => e.id !== selected.id).map((e) => (
                          <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                      </SearchSelect>
                      <select className="input" value={newRelation} onChange={(e) => setNewRelation(e.target.value as VariationRelation)}>
                        {(Object.entries(RELATION_LABEL) as [VariationRelation, string][]).map(([k, l]) => (
                          <option key={k} value={k}>{l}</option>
                        ))}
                      </select>
                      <input className="input" placeholder="Nota (opcional) — ej. si no hay barra" value={newVariationNotes} onChange={(e) => setNewVariationNotes(e.target.value)} />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          className="btn"
                          disabled={!newRelatedId}
                          onClick={async () => {
                            try {
                              const created = await addVariation({ exerciseId: selected.id, relatedExerciseId: newRelatedId, relation: newRelation, notes: newVariationNotes });
                              setVariations((vs) => [...vs, created]);
                              setAddingVariation(false);
                              setNewRelatedId("");
                              setNewVariationNotes("");
                            } catch (e: any) {
                              notify(e.message);
                            }
                          }}
                        >
                          Guardar
                        </button>
                        <button className="btn ghost" onClick={() => setAddingVariation(false)}>Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {askMediaRights && (
        <Modal title="Antes de subir una foto o un video" onClose={() => setAskMediaRights(false)}>
          <p style={{ marginTop: 0 }}>
            La mayoría de las fotos y videos de ejercicios que hay en internet tienen dueño: canales de YouTube, gimnasios,
            fotógrafos o apps. Subirlos sin permiso puede traer un reclamo por derechos de autor.
          </p>
          <p className="note">
            Usa fotos o videos que hayas hecho tú (o tu equipo, o tus alumnos con su permiso), o material con una licencia que
            permita usarlo, y que no muestren a otras personas sin su consentimiento.
          </p>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "14px 0", fontSize: 14 }}>
            <input type="checkbox" checked={rightsChecked} onChange={(e) => setRightsChecked(e.target.checked)} style={{ marginTop: 3 }} />
            <span>Confirmo que lo que voy a subir es mío o tengo permiso para usarlo.</span>
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn"
              disabled={!rightsChecked}
              onClick={() => {
                try {
                  localStorage.setItem(RIGHTS_KEY, "1");
                } catch {
                  /* nada */
                }
                setAskMediaRights(false);
                mediaInputRef.current?.click();
              }}
            >
              Elegir archivo
            </button>
            <button className="btn ghost" onClick={() => setAskMediaRights(false)}>Cancelar</button>
          </div>
        </Modal>
      )}

      {editingExercise && (
        <NewExerciseModal
          scope={scope}
          organizationId={profile.organization_id}
          ownerId={(actingTrainerId ?? profile.id)}
          muscles={muscles}
          patterns={patterns}
          equipment={equipment}
          exercise={editingExercise}
          onClose={() => setEditingExercise(null)}
          onCreated={(ex) => {
            setExercises((xs) => xs.map((x) => (x.id === ex.id ? ex : x)).sort((a, b) => a.name.localeCompare(b.name)));
            setSelected(ex);
            setEditingExercise(null);
            notify("Cambios guardados.");
          }}
        />
      )}

      {toDelete && (
        <ConfirmModal
          title="Eliminar ejercicio"
          message={`¿Eliminar "${toDelete.name}"${scope === "global" && toDelete.scope !== "global" ? ` (${originLabel(toDelete)})` : ""} de la biblioteca? Si ya lo usaste en alguna rutina, evaluación o entrenamiento registrado, no se borra ese historial: el ejercicio deja de aparecer en la biblioteca y no se puede elegir para rutinas nuevas, pero donde ya estaba se sigue viendo.`}
          confirmLabel="Eliminar"
          danger
          onClose={() => setToDelete(null)}
          onConfirm={confirmDelete}
        />
      )}

      {showNew && (
        <NewExerciseModal
          scope={scope}
          organizationId={profile.organization_id}
          ownerId={(actingTrainerId ?? profile.id)}
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
          ownerId={(actingTrainerId ?? profile.id)}
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
