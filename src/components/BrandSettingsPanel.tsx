import { useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { getOrgBrand, saveOrgBrand, uploadBrandLogo, brandLogoUrl, type OrgBrand } from "../services/brand";
import { OrgMark } from "./ui/Brand";

/**
 * Configuración → "Tu marca" (solo entrenadores). Nombre y logo del negocio,
 * que aparecen junto a FuerzaLab en la app de tus clientes, de tu equipo y
 * en los reportes en PDF.
 */
export default function BrandSettingsPanel() {
  const { profile } = useAuth();
  const { notify } = useToast();
  const orgId = profile?.organization_id ?? null;
  const [saved, setSaved] = useState<OrgBrand | null>(null);
  const [name, setName] = useState("");
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    getOrgBrand(orgId).then((b) => {
      setSaved(b);
      setName(b.name ?? "");
      setLogoPath(b.logoPath);
    });
  }, [orgId]);

  if (!orgId || profile?.role !== "trainer") return null;

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) {
      notify("El logo tiene que ser una imagen PNG, JPG, WEBP o SVG.");
      return;
    }
    setUploading(true);
    try {
      const path = await uploadBrandLogo(orgId, file);
      setLogoPath(path);
    } catch (e: any) {
      notify(e.message);
    }
    setUploading(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveOrgBrand({ name: name.trim(), logoPath, previousLogoPath: saved?.logoPath ?? null });
      setSaved({ name: name.trim() || null, logoPath, logoUrl: brandLogoUrl(logoPath) });
      notify("Tu marca quedó guardada.");
    } catch (e: any) {
      notify(e.message);
    }
    setSaving(false);
  };

  const preview: OrgBrand = { name: name.trim() || null, logoPath, logoUrl: brandLogoUrl(logoPath) };
  const hasPreview = !!(preview.name || preview.logoUrl);
  const changed = (saved?.name ?? "") !== name.trim() || (saved?.logoPath ?? null) !== logoPath;

  return (
    <div className="panel" style={{ marginBottom: 18, maxWidth: 560 }}>
      <div className="hd"><h3>Tu marca</h3></div>
      <div className="bd">
        <p className="note" style={{ marginTop: 0 }}>
          El nombre y el logo de tu negocio aparecen junto a FuerzaLab, con el mismo tamaño, en la app de tus clientes y de
          tu equipo, y en los reportes en PDF.
        </p>

        <label className="field-label">Nombre de tu marca</label>
        <input
          className="input"
          style={{ marginBottom: 14 }}
          placeholder="Ej. Training Rodas"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label className="field-label">Logo</label>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
          <label className="btn ghost" style={{ cursor: uploading ? "wait" : "pointer", padding: "7px 12px", fontSize: 13.5 }}>
            <Upload size={15} /> {uploading ? "Subiendo…" : logoPath ? "Cambiar logo" : "Subir logo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              style={{ display: "none" }}
              disabled={uploading}
              onChange={(e) => {
                upload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {logoPath && (
            <button className="btn ghost" style={{ padding: "7px 12px", fontSize: 13.5, color: "var(--bad)" }} onClick={() => setLogoPath(null)}>
              Quitar logo
            </button>
          )}
        </div>
        <p className="note" style={{ fontSize: 12.5, marginTop: 0 }}>
          Ideal: cuadrado, de al menos 256 × 256 px, PNG con fondo transparente o de color. Hasta 2 MB. Si no subes logo, se
          muestran las iniciales de tu marca.
        </p>

        {hasPreview && (
          <>
            <label className="field-label" style={{ marginTop: 14 }}>Así lo ven tus clientes</label>
            <div className="launcher-topbar" style={{ position: "static", borderRadius: 10, marginBottom: 14 }}>
              <div className="brand cobrand">
                <OrgMark brand={preview} />
                <span className="cobrand-sep" aria-hidden="true" />
                <span className="brand-item">
                  <img src="/logo.png" alt="" className="brand-logo" width={34} height={34} />
                  <span className="brand-text">Fuerza<span>Lab</span></span>
                </span>
              </div>
            </div>
          </>
        )}

        <button className="btn" onClick={save} disabled={saving || uploading || !changed}>
          {saving ? "Guardando…" : "Guardar marca"}
        </button>
      </div>
    </div>
  );
}
