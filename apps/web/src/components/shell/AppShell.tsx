import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  FolderKanban,
  Lightbulb,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Repeat,
  Settings,
  SquareKanban,
  Timer,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api, setCsrf } from "../../lib/api";
import { cx } from "../../lib/format";
import type { Settings as SettingsModel } from "../../types";
import { Button } from "../ui";

const SIDEBAR_KEY = "rotina.sidebar.collapsed";

const links = [
  { to: "/", label: "Calendário", icon: CalendarDays, end: true },
  { to: "/kanban", label: "Kanban", icon: SquareKanban },
  { to: "/projetos", label: "Projetos", icon: FolderKanban },
  { to: "/ideias", label: "Ideias", icon: Lightbulb },
  { to: "/rotinas", label: "Rotinas", icon: Repeat },
  { to: "/foco", label: "Foco", icon: Timer },
  { to: "/ajustes", label: "Ajustes", icon: Settings },
];

function applyTheme(theme: SettingsModel["theme"]) {
  const dark =
    theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

function Mark({ compact }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="relative grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-focus shadow-sm shadow-focus/25">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6h16M4 12h10M4 18h7" />
        </svg>
      </div>
      {compact ? null : (
        <div className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-bold tracking-tight text-ink">Rotina</span>
          <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            Bonette
          </span>
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === "1");

  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<{ settings: SettingsModel }>("/settings"),
  });
  const focus = useQuery({
    queryKey: ["focus-current"],
    queryFn: () => api<{ session: { id: string; task?: { title: string } | null } | null }>("/focus/current"),
  });

  useEffect(() => {
    if (settings.data) applyTheme(settings.data.settings.theme);
  }, [settings.data]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function toggleSidebar() {
    setCollapsed((value) => {
      const next = !value;
      localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      return next;
    });
  }

  if (location.pathname === "/foco") return <Outlet context={{ notify: setToast }} />;

  async function logout() {
    await api("/auth/logout", { method: "POST", body: "{}" });
    setCsrf(null);
    queryClient.clear();
    navigate("/login");
  }

  return (
    <div className="min-h-[100dvh] bg-bg transition-colors duration-200">
      {/* Desktop Sidebar */}
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-20 hidden flex-col border-r border-line bg-panel/90 backdrop-blur-md py-4 transition-all duration-200 md:flex",
          collapsed ? "w-16 px-2.5" : "w-60 px-3.5",
        )}
      >
        {/* Brand Header */}
        <div className={cx("flex items-center", collapsed ? "justify-center" : "justify-between gap-2 px-1")}>
          <Mark compact={collapsed} />
          {collapsed ? null : (
            <button
              aria-label="Recolher menu"
              className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-ink transition cursor-pointer"
              type="button"
              onClick={toggleSidebar}
            >
              <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </button>
          )}
        </div>

        {collapsed ? (
          <button
            aria-label="Expandir menu"
            className="mt-3 grid h-8 w-full place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-ink transition cursor-pointer"
            type="button"
            onClick={toggleSidebar}
          >
            <PanelLeftOpen className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </button>
        ) : null}

        {/* Navigation Items */}
        <nav className="mt-6 grid gap-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              title={collapsed ? link.label : undefined}
              className={({ isActive }) =>
                cx(
                  "flex items-center rounded-xl text-xs font-semibold transition-all duration-150",
                  collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2",
                  isActive
                    ? "bg-focus/12 text-focus shadow-xs"
                    : "text-muted hover:bg-panel-2 hover:text-ink",
                )
              }
            >
              <link.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              {collapsed ? <span className="sr-only">{link.label}</span> : link.label}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer Area */}
        <div className={cx("mt-auto grid gap-2.5", collapsed ? "px-0" : "px-0.5")}>
          {focus.data?.session ? (
            <button
              className={cx(
                "rounded-xl border border-focus/30 bg-focus/10 text-left text-xs font-semibold text-focus transition hover:bg-focus/15 cursor-pointer",
                collapsed ? "p-2 text-center" : "px-3 py-2 flex items-center gap-2",
              )}
              title={focus.data.session.task?.title ?? "Foco em andamento"}
              onClick={() => navigate("/foco")}
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-focus opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-focus"></span>
              </span>
              {collapsed ? null : (
                <span className="truncate">
                  {focus.data.session.task?.title ? `Foco: ${focus.data.session.task.title}` : "Foco em andamento"}
                </span>
              )}
            </button>
          ) : null}

          <Button
            variant="quiet"
            className={cx("justify-self-start text-xs font-medium", collapsed && "mx-auto px-2")}
            data-testid="logout"
            onClick={logout}
          >
            <span className="inline-flex items-center gap-1.5">
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              {collapsed ? <span className="sr-only">Sair</span> : "Sair"}
            </span>
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={collapsed ? "md:pl-16" : "md:pl-60"}>
        <main className="px-4 py-6 pb-28 md:px-8 md:py-8 md:pb-12 max-w-[1600px] mx-auto">
          <Outlet context={{ notify: setToast }} />
        </main>
      </div>

      {/* Mobile Bottom Navigation Dock */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-panel/95 backdrop-blur-md px-3 py-2 md:hidden shadow-lg">
        <nav className="flex gap-1 overflow-x-auto pb-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                cx(
                  "shrink-0 rounded-xl px-2.5 py-1.5 text-xs font-medium transition",
                  isActive ? "bg-focus/15 text-focus font-semibold" : "text-muted hover:text-ink",
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
          <button
            className="shrink-0 rounded-xl px-2.5 py-1.5 text-xs font-medium text-muted hover:text-hot cursor-pointer"
            type="button"
            onClick={() => void logout()}
          >
            Sair
          </button>
        </nav>
      </div>

      {/* Toast Notification */}
      {toast ? (
        <div className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-full border border-line bg-ink px-4 py-2 text-xs font-semibold text-bg shadow-2xl backdrop-blur-md md:bottom-8 animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
