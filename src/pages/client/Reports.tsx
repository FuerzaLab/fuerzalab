import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { useToast } from "../../contexts/ToastContext";
import { getMyClientId } from "../../services/clients";
import { useClientReportData } from "../../hooks/useClientReportData";
import { exportReportPdf } from "../../lib/exportReportPdf";
import type { CircumferenceSite } from "../../services/assessments";
import {
  PhotoBeforeAfter,
  BodyCompositionChart,
  CircumferenceChart,
  SkinfoldSumChart,
  StrengthChart,
  PersonalRecordsList,
  WellnessBreakdownChart,
  WellnessScoreChart,
  TrainingWeeklyCharts,
  ExerciseProgressChart,
} from "../../components/reports/ReportSections";

export default function ClientReports() {
  const { notify } = useToast();
  const [clientId, setClientId] = useState<string | null>(null);
  const [circSite, setCircSite] = useState<CircumferenceSite | "">("");
  const [strengthExId, setStrengthExId] = useState("");
  const [progressExId, setProgressExId] = useState("");
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const data = useClientReportData(clientId);

  useEffect(() => {
    getMyClientId().then(setClientId).catch((e: any) => notify(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!circSite && data.circSiteOptions.length) setCircSite(data.circSiteOptions[0]);
    if (!strengthExId && data.strengthExerciseOptions.length) setStrengthExId(data.strengthExerciseOptions[0][0]);
    if (!progressExId && data.exerciseProgressOptions.length) setProgressExId(data.exerciseProgressOptions[0][0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.circSiteOptions, data.strengthExerciseOptions, data.exerciseProgressOptions]);

  const handleExport = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      await exportReportPdf(reportRef.current, "Mi reporte.pdf");
    } catch (e: any) {
      notify("No pudimos generar el PDF: " + e.message);
    }
    setExporting(false);
  };

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Mis reportes</h1>
          <p className="note">Tu evolución real, armada a partir de tus evaluaciones, tu bienestar diario y los entrenamientos que ya completaste.</p>
        </div>
        {clientId && (
          <button className="btn ghost" onClick={handleExport} disabled={exporting}>
            <Download size={16} /> {exporting ? "Generando…" : "Descargar PDF"}
          </button>
        )}
      </div>

      {!clientId && <p className="note">Cargando…</p>}
      {clientId && data.loading && <p className="note">Cargando…</p>}

      {clientId && !data.loading && (
        <div ref={reportRef} style={{ display: "grid", gap: 20, background: "#fff" }}>
          <div className="panel">
            <div className="hd"><h3>Fotos de progreso</h3></div>
            <div className="bd"><PhotoBeforeAfter clientId={clientId} restrictToShared={true} /></div>
          </div>

          <div className="panel">
            <div className="hd"><h3>Peso y % de grasa corporal</h3></div>
            <div className="bd"><BodyCompositionChart points={data.bodyPoints} /></div>
          </div>

          <div className="panel">
            <div className="hd"><h3>Circunferencias</h3></div>
            <div className="bd">
              <CircumferenceChart
                siteOptions={data.circSiteOptions}
                site={circSite}
                onSiteChange={setCircSite}
                series={circSite ? data.circSeriesFor(circSite) : []}
              />
            </div>
          </div>

          <div className="panel">
            <div className="hd"><h3>Σ8 de pliegues (ISAK)</h3></div>
            <div className="bd"><SkinfoldSumChart points={data.skinfoldPoints} /></div>
          </div>

          <div className="panel">
            <div className="hd"><h3>Fuerza (1RM estimado)</h3></div>
            <div className="bd">
              <StrengthChart
                exerciseOptions={data.strengthExerciseOptions}
                exerciseId={strengthExId}
                onExerciseChange={setStrengthExId}
                series={strengthExId ? data.strengthSeriesFor(strengthExId) : []}
              />
            </div>
          </div>

          <div className="panel">
            <div className="hd"><h3>Récords personales</h3></div>
            <div className="bd"><PersonalRecordsList records={data.personalRecords} /></div>
          </div>

          <div className="panel">
            <div className="hd"><h3>Bienestar — puntaje total</h3></div>
            <div className="bd"><WellnessScoreChart points={data.wellnessScorePoints} /></div>
          </div>

          <div className="panel">
            <div className="hd"><h3>Bienestar — por parámetro</h3></div>
            <div className="bd"><WellnessBreakdownChart points={data.wellnessBreakdownPoints} /></div>
          </div>

          <div className="panel">
            <div className="hd"><h3>Progreso por ejercicio entrenado</h3></div>
            <div className="bd">
              <ExerciseProgressChart
                exerciseOptions={data.exerciseProgressOptions}
                exerciseId={progressExId}
                onExerciseChange={setProgressExId}
                series={progressExId ? data.exerciseProgressFor(progressExId) : []}
              />
            </div>
          </div>

          <div className="panel">
            <div className="hd"><h3>Entrenamiento por semana</h3></div>
            <div className="bd">
              <TrainingWeeklyCharts sessionsPerWeek={data.sessionsPerWeek} volumePerWeek={data.volumePerWeek} rpePerWeek={data.rpePerWeek} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
