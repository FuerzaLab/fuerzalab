import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { useToast } from "../../../contexts/ToastContext";
import { listClients, type ClientRow } from "../../../services/clients";
import { useClientReportData } from "../../../hooks/useClientReportData";
import { exportReportPdf } from "../../../lib/exportReportPdf";
import type { CircumferenceSite } from "../../../services/assessments";
import {
  BodyCompositionChart,
  CircumferenceChart,
  SkinfoldSumChart,
  StrengthChart,
  PersonalRecordsList,
  WellnessBreakdownChart,
  WellnessScoreChart,
  TrainingWeeklyCharts,
  ExerciseProgressChart,
  AssessmentComparison,
  PhotoBeforeAfter,
  fmtDate,
} from "../../../components/reports/ReportSections";
import Loading from "../../../components/ui/Loading";
import SearchSelect from "../../../components/ui/SearchSelect";

export default function ReportsPage() {
  const { notify } = useToast();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientId, setClientId] = useState("");
  const [circSite, setCircSite] = useState<CircumferenceSite | "">("");
  const [strengthExId, setStrengthExId] = useState("");
  const [progressExId, setProgressExId] = useState("");
  const [cmpA, setCmpA] = useState("");
  const [cmpB, setCmpB] = useState("");
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const data = useClientReportData(clientId || null);

  useEffect(() => {
    listClients().then(setClients).catch((e) => notify(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!circSite && data.circSiteOptions.length) setCircSite(data.circSiteOptions[0]);
    if (!strengthExId && data.strengthExerciseOptions.length) setStrengthExId(data.strengthExerciseOptions[0][0]);
    if (!progressExId && data.exerciseProgressOptions.length) setProgressExId(data.exerciseProgressOptions[0][0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.circSiteOptions, data.strengthExerciseOptions, data.exerciseProgressOptions]);

  useEffect(() => {
    if (data.snapshots.length >= 2 && !cmpA && !cmpB) {
      setCmpA(data.snapshots[data.snapshots.length - 2].id);
      setCmpB(data.snapshots[data.snapshots.length - 1].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.snapshots]);

  const clientName = clients.find((c) => c.id === clientId)?.full_name ?? "cliente";

  const handleExport = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      await exportReportPdf(reportRef.current, `Reporte - ${clientName}.pdf`);
    } catch (e: any) {
      notify("No pudimos generar el PDF: " + e.message);
    }
    setExporting(false);
  };

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Reportes</h1>
          <p className="note">Evolución real de cada cliente, armada a partir de sus evaluaciones, su bienestar diario y los entrenamientos que ya completó.</p>
        </div>
        {clientId && (
          <button className="btn ghost" onClick={handleExport} disabled={exporting}>
            <Download size={16} /> {exporting ? "Generando…" : "Exportar a PDF"}
          </button>
        )}
      </div>

      <div style={{ marginBottom: 24, maxWidth: 320 }}>
        <label className="field-label">Cliente</label>
        <SearchSelect className="input" value={clientId} onChange={(e) => { setClientId(e.target.value); setCircSite(""); setStrengthExId(""); setProgressExId(""); setCmpA(""); setCmpB(""); }}>
          <option value="">Selecciona un cliente</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </SearchSelect>
      </div>

      {!clientId && <p className="note">Elige un cliente para ver sus reportes.</p>}
      {clientId && data.loading && <Loading />}

      {clientId && !data.loading && (
        <div ref={reportRef} style={{ display: "grid", gap: 20, background: "#fff" }}>
          <h2 style={{ margin: 0 }}>{clientName}</h2>

          <div className="panel">
            <div className="hd"><h3>Fotos de progreso</h3></div>
            <div className="bd"><PhotoBeforeAfter clientId={clientId} restrictToShared={false} /></div>
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
            <div className="hd"><h3>Comparar dos evaluaciones</h3></div>
            <div className="bd">
              <AssessmentComparison
                options={data.snapshots.map((s) => ({ id: s.id, label: `${fmtDate(s.date)} — ${s.typeLabel}` }))}
                idA={cmpA}
                idB={cmpB}
                onChangeA={setCmpA}
                onChangeB={setCmpB}
                snapshotA={data.snapshots.find((s) => s.id === cmpA) ?? null}
                snapshotB={data.snapshots.find((s) => s.id === cmpB) ?? null}
              />
            </div>
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
