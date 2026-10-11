export default function ComingSoon({ title }: { title: string }) {
  return (
    <div className="page">
      <h1 style={{ marginBottom: 6 }}>{title}</h1>
      <p className="note" style={{ marginBottom: 20 }}>Este módulo todavía no está conectado.</p>
      <div className="panel">
        <div className="bd">
          <p>
            La cuenta, el inicio de sesión y el acceso por rol ya funcionan de verdad contra tu base de datos de
            Supabase. Este módulo en particular se conecta en la siguiente entrega del proyecto.
          </p>
        </div>
      </div>
    </div>
  );
}
