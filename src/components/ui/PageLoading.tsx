/** Lo que se ve mientras se descarga una pantalla (ver routes/index.tsx). */
export default function PageLoading() {
  return (
    <div className="page-loading" role="status" aria-label="Cargando">
      <img src="/logo.png" alt="" width={44} height={44} />
    </div>
  );
}
