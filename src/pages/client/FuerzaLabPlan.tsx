import StudentPlanPanel from "../../components/StudentPlanPanel";

/** Alumno → "Mi plan FuerzaLab": hasta cuándo tiene la app y cómo pagar (part4q). */
export default function FuerzaLabPlan() {
  return (
    <div className="page">
      <h1 style={{ marginBottom: 4 }}>Mi plan FuerzaLab</h1>
      <p className="note" style={{ marginBottom: 18, maxWidth: 640 }}>
        Para usar la app pagas un plan a FuerzaLab (mensual, trimestral, semestral o anual). Pagas con QR, subes el
        comprobante y listo.
      </p>
      <StudentPlanPanel />
    </div>
  );
}
