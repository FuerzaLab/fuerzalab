import { useOrgBrand } from "../../hooks/useOrgBrand";
import { brandInitials, type OrgBrand } from "../../services/brand";

/**
 * Logo + "FuerzaLab". Si la organización del usuario cargó su marca
 * (Configuración → Tu marca), se muestran las dos juntas, con el mismo
 * tamaño y peso: la marca del entrenador/estudio y FuerzaLab, separadas
 * por una línea fina. Ninguna queda subordinada a la otra.
 *
 * En el inicio de sesión todavía no se sabe de qué organización es la
 * persona, así que ahí va solo FuerzaLab.
 */
export default function Brand({ className = "brand", withOrg = true }: { className?: string; withOrg?: boolean }) {
  const org = useOrgBrand();
  const showOrg = withOrg && !!org;
  return (
    <div className={`${className}${showOrg ? " cobrand" : ""}`}>
      {showOrg && (
        <>
          <OrgMark brand={org!} />
          <span className="cobrand-sep" aria-hidden="true" />
        </>
      )}
      <span className="brand-item">
        <img src="/logo.png" alt="" className="brand-logo" width={36} height={36} />
        <span className="brand-text">
          Fuerza<span>Lab</span>
        </span>
      </span>
    </div>
  );
}

/** Logo (o iniciales, si no subió logo) y nombre de la marca del entrenador/estudio. */
export function OrgMark({ brand }: { brand: OrgBrand }) {
  const name = brand.name ?? "";
  return (
    <span className={`brand-item${brand.logoUrl ? " has-logo" : ""}`}>
      {brand.logoUrl ? (
        <img src={brand.logoUrl} alt="" className="brand-logo org-logo" width={36} height={36} crossOrigin="anonymous" />
      ) : (
        <span className="brand-logo org-initials" aria-hidden="true">{brandInitials(name || "?")}</span>
      )}
      {name && <span className="brand-text org-name">{name}</span>}
    </span>
  );
}

/**
 * Encabezado de los reportes (y de su PDF): la marca del entrenador/estudio
 * y FuerzaLab, con el mismo peso, y la fecha del reporte.
 */
export function ReportBrandHeader({ label = "Reporte de progreso" }: { label?: string } = {}) {
  const org = useOrgBrand();
  return (
    <div className="report-brand">
      <div className="brand-row">
        {org && (
          <>
            <OrgMark brand={org} />
            <span className="cobrand-sep" aria-hidden="true" />
          </>
        )}
        <span className="brand-item">
          <img src="/logo.png" alt="" className="brand-logo" width={36} height={36} />
          <span className="brand-text">
            Fuerza<span>Lab</span>
          </span>
        </span>
      </div>
      <span className="note">{label} · {new Date().toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}</span>
    </div>
  );
}
