import { Routes, Route } from "react-router-dom";

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
import ComingSoon from "../pages/shared/ComingSoon";

import AdminDashboard from "../pages/admin/Dashboard";
import Organizations from "../pages/admin/Organizations";
import AdminBillingPage from "../pages/admin/billing/BillingPage";
import Users from "../pages/admin/Users";
import TrainerDashboard from "../pages/trainer/Dashboard";
import ClientDashboard from "../pages/client/Dashboard";
import ClientsList from "../pages/trainer/clients/ClientsList";
import ClientDetail from "../pages/trainer/clients/ClientDetail";
import ExercisesPage from "../pages/shared/exercises/ExercisesPage";
import ProgramsPage from "../pages/trainer/programs/ProgramsPage";
import BuilderPage from "../pages/trainer/builder/BuilderPage";
import TrainerPaymentsPage from "../pages/trainer/payments/PaymentsPage";
import TrainerMessagesPage from "../pages/trainer/messages/MessagesPage";
import ClientPayments from "../pages/client/Payments";
import ClientMessages from "../pages/client/Messages";
import Settings from "../pages/shared/Settings";
import ClientRoutine from "../pages/client/Routine";
import TrainerAssessmentsPage from "../pages/trainer/assessments/AssessmentsPage";
import ClientAssessments from "../pages/client/Assessments";
import TrainerWellnessPage from "../pages/trainer/wellness/WellnessPage";
import ReportsPage from "../pages/trainer/reports/ReportsPage";
import ClientWellness from "../pages/client/Wellness";
import ClientReports from "../pages/client/Reports";
import ProgressPhotosPage from "../pages/trainer/progress-photos/ProgressPhotosPage";
import SuggestionsPage from "../pages/trainer/suggestions/SuggestionsPage";
import TemplatesPage from "../pages/trainer/templates/TemplatesPage";
import AgendaPage from "../pages/trainer/agenda/AgendaPage";
import RunSessionPage from "../pages/trainer/run-session/RunSessionPage";
import ClientProgressPhotos from "../pages/client/ProgressPhotos";
import TeamPage from "../pages/trainer/team/TeamPage";
import StudioPage from "../pages/trainer/studio/StudioPage";

import { paths } from "./paths";

export default function AppRoutes() {
  return (
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
  );
}
