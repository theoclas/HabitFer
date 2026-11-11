import { Navigate, Route, Routes } from "react-router-dom";
import { FernanceShell } from "./apps/fernance/layouts/FernanceShell";
import { DashboardPage } from "./apps/fernance/pages/DashboardPage";
import { AccountsPage } from "./apps/fernance/pages/AccountsPage";
import { CategoriesPage } from "./apps/fernance/pages/CategoriesPage";
import { MovementsPage } from "./apps/fernance/pages/MovementsPage";
import { CreditsPage } from "./apps/fernance/pages/CreditsPage";
import { CreditDetailPage } from "./apps/fernance/pages/CreditDetailPage";
import { HabitFerShell } from "./apps/habitfer/layouts/HabitFerShell";
import { FerFitShell } from "./apps/ferfit/layouts/FerFitShell";
import { FitEditorPage } from "./apps/ferfit/pages/FitEditorPage";
import { FitExercisesPage } from "./apps/ferfit/pages/FitExercisesPage";
import { FitPlayerPage } from "./apps/ferfit/pages/FitPlayerPage";
import { FitRoutinePage } from "./apps/ferfit/pages/FitRoutinePage";
import { FitRoutinesPage } from "./apps/ferfit/pages/FitRoutinesPage";
import { FitTodayPage } from "./apps/ferfit/pages/FitTodayPage";
import { FitWeekPage } from "./apps/ferfit/pages/FitWeekPage";
import { NutriFerShell } from "./apps/nutrifer/layouts/NutriFerShell";
import { NutriGoalPage } from "./apps/nutrifer/pages/NutriGoalPage";
import { NutriKitchenPage } from "./apps/nutrifer/pages/NutriKitchenPage";
import { NutriPlanPage } from "./apps/nutrifer/pages/NutriPlanPage";
import { NutriProgressPage } from "./apps/nutrifer/pages/NutriProgressPage";
import { NutriRecipePage } from "./apps/nutrifer/pages/NutriRecipePage";
import { NutriTodayPage } from "./apps/nutrifer/pages/NutriTodayPage";
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
import { APPS, resolvePostLoginPath } from "./platform/apps";
import { AchievementsPage } from "./pages/AchievementsPage";
import { HabitDetailPage } from "./pages/HabitDetailPage";
import { HabitsPage } from "./pages/HabitsPage";
import { LoginPage } from "./pages/LoginPage";
import { ActionPage } from "./pages/ActionPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RegisterPage } from "./pages/RegisterPage";
import { ShortLinkPage } from "./pages/ShortLinkPage";
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
      {/* Botón «Hecho» de los correos: funciona sin sesión, con el token del enlace. */}
      <Route path="/accion" element={<ActionPage />} />
      {/* Enlace corto de los avisos por WhatsApp: lleva a /accion. */}
      <Route path="/a/:code" element={<ShortLinkPage />} />
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
          <Route path="logros" element={<AchievementsPage />} />
        </Route>
        {APPS.proyecfer.retired ? (
          // ProyecFer está retirada (ver platform/apps.ts): sus direcciones viejas llevan a HabitFer.
          <Route path="/app/proyecfer/*" element={<Navigate to="/app/habitfer" replace />} />
        ) : (
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
        )}
        <Route path="/app/fernance" element={<FernanceShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="movements" element={<MovementsPage />} />
          {/* Los ingresos ahora son movimientos (los enlaces viejos siguen sirviendo). */}
          <Route path="incomes" element={<Navigate to="/app/fernance/movements?tipo=INCOME" replace />} />
          <Route path="credits" element={<CreditsPage />} />
          <Route path="credits/:id" element={<CreditDetailPage />} />
        </Route>
        <Route path="/app/nutrifer" element={<NutriFerShell />}>
          <Route index element={<NutriTodayPage />} />
          <Route path="cocina" element={<NutriKitchenPage />} />
          <Route path="cocina/receta/:id" element={<NutriRecipePage />} />
          <Route path="cocina/plan" element={<NutriPlanPage />} />
          <Route path="progreso" element={<NutriProgressPage />} />
          <Route path="meta" element={<NutriGoalPage />} />
        </Route>
        <Route path="/app/ferfit" element={<FerFitShell />}>
          <Route index element={<FitTodayPage />} />
          <Route path="rutinas" element={<FitRoutinesPage />} />
          <Route path="rutinas/nueva" element={<FitEditorPage />} />
          <Route path="rutinas/:id" element={<FitRoutinePage />} />
          <Route path="rutinas/:id/editar" element={<FitEditorPage />} />
          <Route path="rutinas/:id/entrenar" element={<FitPlayerPage />} />
          <Route path="listas/:key" element={<FitRoutinePage />} />
          <Route path="listas/:key/entrenar" element={<FitPlayerPage />} />
          <Route path="ejercicios" element={<FitExercisesPage />} />
          <Route path="semana" element={<FitWeekPage />} />
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
