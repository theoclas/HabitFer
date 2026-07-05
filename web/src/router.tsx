import { Navigate, Route, Routes } from "react-router-dom";
import { FernanceShell } from "./apps/fernance/layouts/FernanceShell";
import { DashboardPage } from "./apps/fernance/pages/DashboardPage";
import { AccountsPage } from "./apps/fernance/pages/AccountsPage";
import { IncomesPage } from "./apps/fernance/pages/IncomesPage";
import { CreditsPage } from "./apps/fernance/pages/CreditsPage";
import { CreditDetailPage } from "./apps/fernance/pages/CreditDetailPage";
import { HabitFerShell } from "./apps/habitfer/layouts/HabitFerShell";
import { ProyecFerShell } from "./apps/proyecfer/layouts/ProyecFerShell";
import { ProyecFerHomePage } from "./apps/proyecfer/pages/ProyecFerHomePage";
import { WorkspacesPage } from "./apps/proyecfer/pages/WorkspacesPage";
import { WorkspaceDashboardPage } from "./apps/proyecfer/pages/WorkspaceDashboardPage";
import { CollabProjectPage } from "./apps/proyecfer/pages/CollabProjectPage";
import { PageEditorPage } from "./apps/proyecfer/pages/PageEditorPage";
import { DatabasePage } from "./apps/proyecfer/pages/DatabasePage";
import { ProyecFerStatsPage } from "./apps/proyecfer/pages/ProyecFerStatsPage";
import { WorkGuidePage } from "./apps/proyecfer/pages/WorkGuidePage";
import { RequireAuth } from "./layouts/RequireAuth";
import { AppPickerPage } from "./platform/AppPickerPage";
import { resolvePostLoginPath } from "./platform/apps";
import { HabitDetailPage } from "./pages/HabitDetailPage";
import { HabitsPage } from "./pages/HabitsPage";
import { LoginPage } from "./pages/LoginPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RegisterPage } from "./pages/RegisterPage";
import { StatsPage } from "./pages/StatsPage";
import { TasksPage } from "./pages/TasksPage";
import { TodayPage } from "./pages/TodayPage";
import { UsersPage } from "./pages/UsersPage";

function AppRedirect() {
  return <Navigate to={resolvePostLoginPath()} replace />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/app/picker" element={<AppPickerPage />} />
        <Route path="/app/profile" element={<ProfilePage />} />
        <Route path="/app/users" element={<UsersPage />} />
        <Route path="/app/habitfer" element={<HabitFerShell />}>
          <Route index element={<TodayPage />} />
          <Route path="habits" element={<HabitsPage />} />
          <Route path="habits/:id" element={<HabitDetailPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="stats" element={<StatsPage />} />
        </Route>
        <Route path="/app/proyecfer" element={<ProyecFerShell />}>
          <Route index element={<ProyecFerHomePage />} />
          <Route path="workspaces" element={<WorkspacesPage />} />
          <Route path="workspaces/:workspaceId" element={<WorkspaceDashboardPage />} />
          <Route path="workspaces/:workspaceId/projects/:projectId" element={<CollabProjectPage />} />
          <Route path="workspaces/:workspaceId/projects/:projectId/guides/:guideId" element={<WorkGuidePage />} />
          <Route path="workspaces/:workspaceId/pages/:pageId" element={<PageEditorPage />} />
          <Route path="workspaces/:workspaceId/databases/:databaseId" element={<DatabasePage />} />
          <Route path="stats" element={<ProyecFerStatsPage />} />
        </Route>
        <Route path="/app/fernance" element={<FernanceShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="incomes" element={<IncomesPage />} />
          <Route path="credits" element={<CreditsPage />} />
          <Route path="credits/:id" element={<CreditDetailPage />} />
        </Route>
        <Route path="/app" element={<AppRedirect />} />
        <Route path="/app/habits/*" element={<Navigate to="/app/habitfer/habits" replace />} />
        <Route path="/app/tasks" element={<Navigate to="/app/habitfer/tasks" replace />} />
        <Route path="/app/stats" element={<Navigate to="/app/habitfer/stats" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
