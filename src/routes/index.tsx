import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import PageLoading from "../components/ui/PageLoading";

import AuthLayout from "./layouts/AuthLayout";
import AppLayout from "./layouts/AppLayout";
import RequireAuth from "./guards/RequireAuth";
import RequireRole from "./guards/RequireRole";
import RequireOnboarding from "./guards/RequireOnboarding";
import RequireStaffAccess from "./guards/RequireStaffAccess";
import RoleRedirect from "./RoleRedirect";

import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
import ForgotPassword from "../pages/auth/ForgotPassword";
import ResetPassword from "../pages/auth/ResetPassword";
import NoAccess from "../pages/shared/NoAccess";
import NotFound from "../pages/shared/NotFound";
const ComingSoon = lazy(() => import("../pages/shared/ComingSoon"));

const AdminDashboard = lazy(() => import("../pages/admin/Dashboard"));
const Organizations = lazy(() => import("../pages/admin/Organizations"));
const AdminBillingPage = lazy(() => import("../pages/admin/billing/BillingPage"));
const Users = lazy(() => import("../pages/admin/Users"));
const TrainerDashboard = lazy(() => import("../pages/trainer/Dashboard"));
const ClientDashboard = lazy(() => import("../pages/client/Dashboard"));
const ClientsList = lazy(() => import("../pages/trainer/clients/ClientsList"));
const ClientDetail = lazy(() => import("../pages/trainer/clients/ClientDetail"));
const ExercisesPage = lazy(() => import("../pages/shared/exercises/ExercisesPage"));
const ProgramsPage = lazy(() => import("../pages/trainer/programs/ProgramsPage"));
const BuilderPage = lazy(() => import("../pages/trainer/builder/BuilderPage"));
const TrainerPaymentsPage = lazy(() => import("../pages/trainer/payments/PaymentsPage"));
const TrainerMessagesPage = lazy(() => import("../pages/trainer/messages/MessagesPage"));
const ClientPayments = lazy(() => import("../pages/client/Payments"));
const ClientMessages = lazy(() => import("../pages/client/Messages"));
const Settings = lazy(() => import("../pages/shared/Settings"));
const ClientRoutine = lazy(() => import("../pages/client/Routine"));
const TrainerAssessmentsPage = lazy(() => import("../pages/trainer/assessments/AssessmentsPage"));
const ClientAssessments = lazy(() => import("../pages/client/Assessments"));
const TrainerWellnessPage = lazy(() => import("../pages/trainer/wellness/WellnessPage"));
const ReportsPage = lazy(() => import("../pages/trainer/reports/ReportsPage"));
const ClientWellness = lazy(() => import("../pages/client/Wellness"));
const ClientReports = lazy(() => import("../pages/client/Reports"));
const ProgressPhotosPage = lazy(() => import("../pages/trainer/progress-photos/ProgressPhotosPage"));
const SuggestionsPage = lazy(() => import("../pages/trainer/suggestions/SuggestionsPage"));
const TemplatesPage = lazy(() => import("../pages/trainer/templates/TemplatesPage"));
const AgendaPage = lazy(() => import("../pages/trainer/agenda/AgendaPage"));
const RunSessionPage = lazy(() => import("../pages/trainer/run-session/RunSessionPage"));
const ClientProgressPhotos = lazy(() => import("../pages/client/ProgressPhotos"));
const TeamPage = lazy(() => import("../pages/trainer/team/TeamPage"));
const StudioPage = lazy(() => import("../pages/trainer/studio/StudioPage"));

import { paths } from "./paths";

// Las pantallas se descargan recién cuando se abren (code splitting): así la
// primera carga, sobre todo en el celular, baja solo lo necesario. Las de
// inicio de sesión y registro quedan incluidas desde el principio.
const PrivacyPage = lazy(() => import("../pages/public/Legal").then((m) => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import("../pages/public/Legal").then((m) => ({ default: m.TermsPage })));

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoading />}>
    <Routes>
      {/* Autenticación: públicas */}
      <Route element={<AuthLayout />}>
        <Route path={paths.login} element={<Login />} />
        <Route path={paths.register} element={<Register />} />
        <Route path={paths.forgotPassword} element={<ForgotPassword />} />
        <Route path={paths.resetPassword} element={<ResetPassword />} />
      </Route>

      {/* "/" es pública: sin sesión muestra la página de presentación; con
          sesión, RoleRedirect lleva a cada uno a su panel. Por eso va fuera
          de RequireAuth (que mandaría al visitante al inicio de sesión). */}
      <Route path="/" element={<RoleRedirect />} />
      <Route path={paths.privacy} element={<PrivacyPage />} />
      <Route path={paths.terms} element={<TermsPage />} />

      {/* A partir de aquí, hace falta sesión iniciada */}
      <Route element={<RequireAuth />}>
        <Route path={paths.noAccess} element={<NoAccess />} />

        {/* Super Admin */}
        <Route element={<RequireRole allow={["super_admin"]} />}>
          <Route element={<AppLayout />}>
            <Route path={paths.adminDashboard} element={<AdminDashboard />} />
            <Route path={paths.adminOrgs} element={<Organizations />} />
            <Route path={paths.adminUsers} element={<Users />} />
            <Route path={paths.adminExercises} element={<ExercisesPage scope="global" />} />
            <Route path={paths.adminBilling} element={<AdminBillingPage />} />
            <Route path={paths.adminSettings} element={<Settings />} />
          </Route>
        </Route>

        {/* Entrenador y Staff */}
        <Route element={<RequireRole allow={["trainer", "staff"]} />}>
          <Route element={<AppLayout />}>
          <Route element={<RequireStaffAccess />}>
            <Route path={paths.trainerDashboard} element={<TrainerDashboard />} />
            <Route path={paths.trainerClients} element={<ClientsList />} />
            <Route path={paths.trainerClientDetailPattern} element={<ClientDetail />} />
            <Route path={paths.trainerExercises} element={<ExercisesPage scope="trainer" />} />
            <Route path={paths.trainerTemplates} element={<TemplatesPage />} />
            <Route path={paths.trainerAgenda} element={<AgendaPage />} />
            <Route path={paths.trainerPrograms} element={<ProgramsPage />} />
            <Route path={paths.trainerAssessments} element={<TrainerAssessmentsPage />} />
            <Route path={paths.trainerWellness} element={<TrainerWellnessPage />} />
            <Route path={paths.trainerProgressPhotos} element={<ProgressPhotosPage />} />
            <Route path={paths.trainerRunSession} element={<RunSessionPage />} />
            <Route path={paths.trainerBuilder} element={<BuilderPage />} />
            <Route path={paths.trainerTracking} element={<ComingSoon title="Seguimiento" />} />
            <Route path={paths.trainerAnalytics} element={<ComingSoon title="Analytics" />} />
            <Route path={paths.trainerSuggestions} element={<SuggestionsPage />} />
            <Route path={paths.trainerMessages} element={<TrainerMessagesPage />} />
            <Route path={paths.trainerPayments} element={<TrainerPaymentsPage />} />
            <Route path={paths.trainerReports} element={<ReportsPage />} />
            <Route path={paths.trainerSettings} element={<Settings />} />
            <Route path={paths.trainerTeam} element={<TeamPage />} />
            <Route path={paths.trainerStudio} element={<StudioPage />} />
          </Route>
          </Route>
        </Route>

        {/* Cliente */}
        <Route element={<RequireRole allow={["client"]} />}>
          <Route element={<RequireOnboarding />}>
          <Route element={<AppLayout />}>
            <Route path={paths.clientDashboard} element={<ClientDashboard />} />
            <Route path={paths.clientRoutine} element={<ClientRoutine />} />
            <Route path={paths.clientHistory} element={<ComingSoon title="Historial" />} />
            <Route path={paths.clientProgress} element={<ClientProgressPhotos />} />
            <Route path={paths.clientAssessments} element={<ClientAssessments />} />
            <Route path={paths.clientMessages} element={<ClientMessages />} />
            <Route path={paths.clientPayments} element={<ClientPayments />} />
            <Route path={paths.clientProfile} element={<Settings />} />
            <Route path={paths.clientWellness} element={<ClientWellness />} />
            <Route path={paths.clientReports} element={<ClientReports />} />
          </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  );
}
