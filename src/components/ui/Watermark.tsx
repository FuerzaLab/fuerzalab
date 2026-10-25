/**
 * Marca de agua con el logo (versión de una sola tinta), grande y cortada
 * en la esquina inferior derecha. Se usa solo en pantallas con espacio
 * libre (inicio de sesión/registro e Inicio) — no en pantallas de
 * trabajo, donde ensuciaría tablas y gráficos.
 *
 * Va detrás de todo (z-index -1 en CSS): las tarjetas, paneles y barras
 * la tapan; solo se ve en el fondo vacío. Para cambiar la intensidad,
 * tocar la opacidad de .watermark en global.css.
 */
export default function Watermark() {
  return <img src="/watermark.png" alt="" aria-hidden="true" className="watermark" />;
}
