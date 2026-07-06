import {
  Activity,
  BarChart3,
  Bot,
  CheckSquare,
  Cpu,
  History as HistoryIcon,
  LayoutDashboard,
  LineChart,
  ListTodo,
  LogOut,
  Megaphone,
  MessageSquare,
  Settings2,
  SlidersHorizontal,
  Users,
  Wallet,
  Wrench,
  Globe2,
  ShieldCheck
} from "lucide-react";
import { ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useSessionStore } from "../../store/session";
import { cn } from "../../lib/cn";

type NavItem = {
  to: string;
  label: string;
  icon: ReactNode;
  badge?: string | number;
  match?: (pathname: string) => boolean;
  testId?: string;
  adminOnly?: boolean;
};

const primaryNav: NavItem[] = [
  { to: "/", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" />, testId: "nav-dashboard" },
  { to: "/tasks", label: "Tasks", icon: <ListTodo className="w-4 h-4" />, testId: "nav-tasks" },
  { to: "/tools", label: "Tool Results", icon: <Wrench className="w-4 h-4" />, testId: "nav-tools" }
];

const departmentNav: NavItem[] = [
  {
    to: "/department/sales",
    label: "Sales",
    icon: <LineChart className="w-4 h-4" />,
    match: (p) => p.startsWith("/department/sales") || p.startsWith("/agent/sales"),
    testId: "nav-department-sales"
  },
  {
    to: "/department/marketing",
    label: "Marketing",
    icon: <Megaphone className="w-4 h-4" />,
    match: (p) => p.startsWith("/department/marketing") || p.startsWith("/agent/marketing"),
    testId: "nav-department-marketing"
  },
  {
    to: "/department/finance",
    label: "Finance",
    icon: <Wallet className="w-4 h-4" />,
    match: (p) => p.startsWith("/department/finance") || p.startsWith("/agent/finance"),
    testId: "nav-department-finance"
  },
  {
    to: "/department/ops",
    label: "Operations",
    icon: <Settings2 className="w-4 h-4" />,
    match: (p) => p.startsWith("/department/ops") || p.startsWith("/agent/ops"),
    testId: "nav-department-ops"
  }
];

const settingsNav: NavItem[] = [
  { to: "/settings", label: "Preferences", icon: <SlidersHorizontal className="w-4 h-4" />, testId: "nav-settings-preferences" },
  { to: "/settings/regions", label: "Regions", icon: <Globe2 className="w-4 h-4" />, testId: "nav-settings-regions" },
  { to: "/settings/roles", label: "Roles & Permissions", icon: <ShieldCheck className="w-4 h-4" />, testId: "nav-settings-roles", adminOnly: true },
  { to: "/settings/users", label: "Users", icon: <Users className="w-4 h-4" />, testId: "nav-settings-users", adminOnly: true },
  { to: "/settings/audit-log", label: "Audit Log", icon: <HistoryIcon className="w-4 h-4" />, testId: "nav-settings-audit", adminOnly: true },
  { to: "/settings/models", label: "AI Models", icon: <Cpu className="w-4 h-4" />, testId: "nav-settings-models", adminOnly: true },
  { to: "/settings/token-usage", label: "Token Usage", icon: <BarChart3 className="w-4 h-4" />, testId: "nav-settings-usage", adminOnly: true },
  { to: "/settings/approvals", label: "Approvals", icon: <CheckSquare className="w-4 h-4" />, testId: "nav-settings-approvals", adminOnly: true },
  { to: "/settings/health", label: "System Health", icon: <Activity className="w-4 h-4" />, testId: "nav-settings-health", adminOnly: true }
];

function initialsFor(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  const base = parts[0] ?? value;
  return base.slice(0, 2).toUpperCase();
}

function roleLabel(user: ReturnType<typeof useSessionStore.getState>["user"]): string {
  if (!user) return "Signed in";
  if (user.is_super_admin) return "Super Admin";
  const role = user.roles[0];
  if (!role) return "User";
  return role
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const ADMIN_ROLES = new Set(["super_admin", "regional_head", "regional_admin", "country_admin"]);

function isAdmin(user: ReturnType<typeof useSessionStore.getState>["user"]): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  return (user.roles ?? []).some((r) => ADMIN_ROLES.has(r));
}

type SidebarProps = { onNavigate?: () => void };

export function Sidebar({ onNavigate }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);
  const signOut = useSessionStore((s) => s.signOut);

  function isActive(item: NavItem): boolean {
    if (item.match) return item.match(location.pathname);
    if (item.to === "/") return location.pathname === "/";
    if (item.to === "/settings") return location.pathname === "/settings";
    return location.pathname.startsWith(item.to);
  }

  function NavRow({ item, active }: { item: NavItem; active: boolean }) {
    return (
      <NavLink
        to={item.to}
        end={item.to === "/" || item.to === "/settings"}
        data-testid={item.testId}
        onClick={() => onNavigate?.()}
        className={cn(
          "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-body transition-colors",
          active
            ? "bg-brand-subtle dark:bg-brand-glow text-brand font-medium"
            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
        )}
      >
        <span
          className={cn(
            "shrink-0",
            active ? "text-brand" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200"
          )}
        >
          {item.icon}
        </span>
        <span className="truncate">{item.label}</span>
      </NavLink>
    );
  }

  const settingsVisible = settingsNav.filter((item) => !item.adminOnly || isAdmin(user));

  return (
    <aside
      className="w-64 shrink-0 h-screen sticky top-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col"
      data-testid="app-sidebar"
    >
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center shadow-sm shadow-brand/30">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="leading-tight">
            <p className="text-base font-display font-bold text-slate-900 dark:text-white">Mitsumi AI</p>
            <p className="text-[11px] font-mono text-slate-400">Agent Platform</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {primaryNav.map((item) => (
          <NavRow key={item.to} item={item} active={isActive(item)} />
        ))}

        <div className="pt-4 pb-1 px-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Departments</p>
          <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
        </div>
        {departmentNav.map((item) => (
          <NavRow key={item.to} item={item} active={isActive(item)} />
        ))}

        <div className="pt-4 pb-1 px-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Settings</p>
        </div>
        {settingsVisible.map((item) => (
          <NavRow key={item.to} item={item} active={isActive(item)} />
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <div className="relative w-9 h-9 shrink-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand to-accent text-white text-xs font-bold flex items-center justify-center">
              {initialsFor(user?.name ?? user?.email ?? "User")}
            </div>
            <span
              className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"
              aria-hidden
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
              {user?.name ?? "Signed in"}
            </p>
            <p className="text-xs text-slate-400 truncate">{roleLabel(user)}</p>
          </div>
          {user && (
            <button
              type="button"
              data-testid="sidebar-sign-out-btn"
              onClick={() => {
                signOut();
                navigate("/login", { replace: true });
              }}
              aria-label="Sign out"
              title="Sign out"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-danger hover:bg-danger/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

export { isAdmin, ADMIN_ROLES };
