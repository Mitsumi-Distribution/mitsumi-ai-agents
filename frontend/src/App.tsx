import { Loader2, Lock } from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";
import React from "react";
import { Navigate, Outlet, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { createChat, fetchMe, listChats } from "./api/client";
import { AppShell } from "./components/layout/AppShell";
import { EmptyState } from "./components/ui/EmptyState";
import { useSessionStore } from "./store/session";
import { AgentView } from "./pages/AgentView";
import { Dashboard } from "./pages/Dashboard";
import { DepartmentPage } from "./pages/DepartmentPage";
import { LoginPage } from "./pages/LoginPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { TaskView } from "./pages/TaskView";
import { ToolResults } from "./pages/ToolResults";
import { HealthPage } from "./pages/settings/HealthPage";
import { ModelsPage } from "./pages/settings/ModelsPage";
import { TokenUsagePage } from "./pages/settings/TokenUsagePage";
import { ApprovalsPage } from "./pages/settings/ApprovalsPage";
import { PreferencesPage } from "./pages/settings/PreferencesPage";
import { RegionsPage } from "./pages/settings/RegionsPage";
import { RolesPage } from "./pages/settings/RolesPage";
import { UsersPage } from "./pages/settings/UsersPage";
import { AuditLogPage } from "./pages/settings/AuditLogPage";
import { isAdmin } from "./components/layout/Sidebar";

export function App() {
  const token = useSessionStore((s) => s.token);
  const user = useSessionStore((s) => s.user);
  const setUser = useSessionStore((s) => s.setUser);
  const [hydrating, setHydrating] = useState(Boolean(token && !user));

  useEffect(() => {
    let cancelled = false;
    async function hydrateUser() {
      if (!token || user) {
        setHydrating(false);
        return;
      }
      try {
        const me = await fetchMe();
        if (cancelled) return;
        setUser(me);
      } catch {
        /* handled by route guard */
      } finally {
        if (!cancelled) setHydrating(false);
      }
    }
    hydrateUser();
    return () => {
      cancelled = true;
    };
  }, [token, user, setUser]);

  if (hydrating) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center font-body px-6">
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <Loader2 className="w-4 h-4 animate-spin text-brand" />
          <span className="font-medium">Restoring your session…</span>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Fullscreen, auth-protected agent pages (no dashboard shell) */}
      <Route element={<RequireAuth />}>
        <Route path="/agent/:name" element={<AgentLanding />} />
        <Route path="/agent/:name/c/:chatId" element={<AgentView />} />
      </Route>

      {/* Everything else lives inside the dashboard shell */}
      <Route element={<RequireAuthLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/department/:name" element={<DepartmentRoute />} />
        <Route path="/tasks" element={<TaskView />} />
        <Route path="/tools" element={<ToolResults />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/settings" element={<PreferencesPage />} />
        <Route path="/settings/preferences" element={<PreferencesPage />} />
        <Route path="/settings/regions" element={<RegionsPage />} />
        <Route path="/settings/roles" element={<AdminRoute><RolesPage /></AdminRoute>} />
        <Route path="/settings/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
        <Route path="/settings/audit-log" element={<AdminRoute><AuditLogPage /></AdminRoute>} />
        <Route path="/settings/health" element={<AdminRoute><HealthPage /></AdminRoute>} />
        <Route path="/settings/models" element={<AdminRoute><ModelsPage /></AdminRoute>} />
        <Route path="/settings/token-usage" element={<AdminRoute><TokenUsagePage /></AdminRoute>} />
        <Route path="/settings/approvals" element={<AdminRoute><ApprovalsPage /></AdminRoute>} />
      </Route>
    </Routes>
  );
}

function RequireAuth() {
  const token = useSessionStore((s) => s.token);
  const user = useSessionStore((s) => s.user);
  if (!token || !user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function AdminRoute({ children }: { children: React.ReactElement }) {
  const user = useSessionStore((s) => s.user);
  if (!isAdmin(user)) {
    return (
      <div className="flex-1 px-4 md:px-10 py-8 max-w-5xl w-full mx-auto">
        <EmptyState
          icon={<Lock className="w-6 h-6" />}
          title="Admins only"
          description="You need an admin role to view this page."
        />
      </div>
    );
  }
  return children;
}

function DepartmentRoute() {
  const { name } = useParams();
  return <DepartmentPage departmentKey={name} />;
}

/**
 * AgentLanding resolves the right chat for the department:
 *  1. If the agent has existing chats, navigate to the most recent one.
 *  2. Otherwise create a single chat and navigate to it.
 *
 * Uses a ref guard so React 18 StrictMode double-invokes don't create two
 * chats on first mount. Prior version blindly created a chat every visit,
 * which is why a new empty chat was spawned each time a department was
 * clicked.
 */
function AgentLanding() {
  const navigate = useNavigate();
  const params = useParams();
  const name = params.name ?? "sales";
  const token = useSessionStore((s) => s.token);
  const inflight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    inflight.current = false;

    async function resolveChat() {
      if (inflight.current || !token) return;
      inflight.current = true;
      try {
        const existing = await listChats(name);
        if (cancelled) return;
        const pinnedFirst = [...existing].sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });
        const latest = pinnedFirst[0];
        if (latest) {
          navigate(`/agent/${name}/c/${latest.id}`, { replace: true });
          return;
        }
        const created = await createChat(name);
        if (cancelled) return;
        navigate(`/agent/${name}/c/${created.id}`, { replace: true });
      } catch {
        if (!cancelled) navigate("/", { replace: true });
      }
    }

    resolveChat();
    return () => {
      cancelled = true;
    };
  }, [name, token, navigate]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center px-6">
      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <Loader2 className="w-4 h-4 animate-spin text-brand" />
        <span className="font-medium">Opening your {name} workspace…</span>
      </div>
    </div>
  );
}

function RequireAuthLayout() {
  const token = useSessionStore((s) => s.token);
  const user = useSessionStore((s) => s.user);
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

