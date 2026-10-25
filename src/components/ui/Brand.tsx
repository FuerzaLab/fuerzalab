/**
 * Logo + "FuerzaLab", en todas las pantallas que muestran la marca
 * (menú lateral, barra superior del entrenador/asistente, inicio de
 * sesión y registro). El logo vive en public/logo.png.
 */
export default function Brand({ className = "brand" }: { className?: string }) {
  return (
    <div className={className}>
      <img src="/logo.png" alt="" className="brand-logo" width={36} height={36} />
      <span className="brand-text">
        Fuerza<span>Lab</span>
      </span>
    </div>
  );
}
