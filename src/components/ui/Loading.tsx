export default function Loading({ text = "Cargando…" }: { text?: string }) {
  return (
    <p className="loading-row">
      <span className="spinner" aria-hidden="true" />
      {text}
    </p>
  );
}
