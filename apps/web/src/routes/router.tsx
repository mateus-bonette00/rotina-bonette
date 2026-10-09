import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppShell } from "../components/shell/AppShell";
import { LoginPage } from "../features/auth/LoginPage";
import { CalendarPage } from "../features/calendar/CalendarPage";
import { FocusPage } from "../features/focus/FocusPage";
import { IdeasPage } from "../features/ideas/IdeasPage";
import { ProjectDetailPage } from "../features/projects/ProjectDetailPage";
import { ProjectsPage } from "../features/projects/ProjectsPage";
import { RoutinesPage } from "../features/routines/RoutinesPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { KanbanPage } from "../features/tasks/KanbanPage";
import { useSession } from "../hooks/useSession";

function RequireAuth() {
  const session = useSession();
  if (session.isLoading) return <p className="grid min-h-screen place-items-center text-muted">Abrindo a rotina…</p>;
  if (!session.data?.authenticated) return <Navigate to="/login" replace />;
  return <AppShell />;
}

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: <RequireAuth />,
    children: [
      { index: true, element: <CalendarPage /> },
      { path: "calendario", element: <Navigate to="/" replace /> },
      { path: "kanban", element: <KanbanPage /> },
      { path: "projetos", element: <ProjectsPage /> },
      { path: "projetos/:id", element: <ProjectDetailPage /> },
      { path: "ideias", element: <IdeasPage /> },
      { path: "rotinas", element: <RoutinesPage /> },
      { path: "foco", element: <FocusPage /> },
      { path: "ajustes", element: <SettingsPage /> },
    ],
  },
]);
