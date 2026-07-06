import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Crown, Loader2, ShieldCheck, UserPlus, Users2 } from "lucide-react";
import { TopBar } from "../../components/layout/TopBar";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import { fetchRoles } from "../../api/client";
import type { RoleDefinition } from "../../types";
import { cn } from "../../lib/cn";

// Canonical list of permission verbs so the matrix rows stay stable.
const PERMISSION_ROWS: { key: string; label: string }[] = [
  { key: "department:read", label: "Read department data" },
  { key: "department:export", label: "Export department data" },
  { key: "agent:chat", label: "Chat with agents" },
  { key: "task:create", label: "Create tasks" },
  { key: "user:invite", label: "Invite users" },
  { key: "user:manage_region", label: "Manage region users" },
  { key: "user:manage_country", label: "Manage country users" }
];

const SCOPE_ICON: Record<RoleDefinition["scope"], JSX.Element> = {
  global: <Crown className="w-3.5 h-3.5" />,
  region: <ShieldCheck className="w-3.5 h-3.5" />,
  country: <Users2 className="w-3.5 h-3.5" />
};

const SCOPE_TONE: Record<RoleDefinition["scope"], "success" | "info" | "brand"> = {
  global: "success",
  region: "info",
  country: "brand"
};

export function RolesPage() {
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "permissions" | "hierarchy">("overview");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchRoles();
        setRoles(res.roles);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load roles");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const canDo = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const role of roles) {
      const set = new Set<string>(role.permissions);
      if (role.permissions.includes("*")) {
        for (const row of PERMISSION_ROWS) set.add(row.key);
      }
      map.set(role.key, set);
    }
    return map;
  }, [roles]);

  return (
    <>
      <TopBar title="Roles & Permissions" subtitle="Hierarchy, invite boundaries and explicit permissions." />
      <div className="flex-1 flex justify-center">
        <div className="w-full max-w-6xl px-4 md:px-10 py-6 md:py-8 space-y-5">
          <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
            {[
              { key: "overview", label: "Overview" },
              { key: "permissions", label: "Permissions Matrix" },
              { key: "hierarchy", label: "Invite Hierarchy" }
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key as typeof tab)}
                data-testid={`roles-tab-${t.key}`}
                className={cn(
                  "px-4 py-2 text-sm font-semibold rounded-xl transition-colors whitespace-nowrap",
                  tab === t.key
                    ? "bg-brand-subtle dark:bg-brand-glow text-brand"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-16 flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-brand" /> Loading roles…
            </div>
          ) : error ? (
            <EmptyState icon={<ShieldCheck className="w-6 h-6" />} title="Couldn't load roles" description={error} />
          ) : tab === "overview" ? (
            <OverviewView roles={roles} />
          ) : tab === "permissions" ? (
            <PermissionsMatrix roles={roles} canDo={canDo} />
          ) : (
            <HierarchyView roles={roles} />
          )}
        </div>
      </div>
    </>
  );
}

function OverviewView({ roles }: { roles: RoleDefinition[] }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {roles.map((role) => (
        <section
          key={role.key}
          data-testid={`role-card-${role.key}`}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-5 shadow-sm"
        >
          <header className="flex items-start justify-between flex-wrap gap-3 mb-3">
            <div>
              <h3 className="text-base font-display font-semibold text-slate-900 dark:text-white">{role.label}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{role.key}</p>
            </div>
            <Badge tone={SCOPE_TONE[role.scope]} className="inline-flex items-center gap-1 capitalize">
              {SCOPE_ICON[role.scope]}
              {role.scope} scope
            </Badge>
          </header>

          <div className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400 mb-1.5 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5" />
                Can invite
              </p>
              <div className="flex flex-wrap gap-1.5">
                {role.can_invite.length === 0 ? (
                  <span className="text-xs text-slate-500">— nobody</span>
                ) : (
                  role.can_invite.map((r) => (
                    <Badge key={r} tone="info" className="font-mono">
                      {r}
                    </Badge>
                  ))
                )}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400 mb-1.5">Permissions</p>
              <div className="flex flex-wrap gap-1.5">
                {role.permissions.map((p) => (
                  <Badge key={p} tone="neutral" className="font-mono">
                    {p}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

function PermissionsMatrix({ roles, canDo }: { roles: RoleDefinition[]; canDo: Map<string, Set<string>> }) {
  return (
    <section
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-sm"
      data-testid="roles-permissions-matrix"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
              <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">Permission</th>
              {roles.map((r) => (
                <th
                  key={r.key}
                  className="px-3 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-300"
                  data-testid={`roles-matrix-col-${r.key}`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-mono text-[10px] uppercase tracking-widest">{r.key}</span>
                    <Badge tone={SCOPE_TONE[r.scope]} className="text-[10px] capitalize">{r.scope}</Badge>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {PERMISSION_ROWS.map((row) => (
              <tr key={row.key} data-testid={`roles-matrix-row-${row.key}`}>
                <td className="px-4 md:px-6 py-3 text-xs">
                  <p className="font-medium text-slate-800 dark:text-slate-100">{row.label}</p>
                  <p className="font-mono text-[10px] text-slate-400 mt-0.5">{row.key}</p>
                </td>
                {roles.map((r) => (
                  <td
                    key={`${row.key}-${r.key}`}
                    className="px-3 py-3 text-center"
                    data-testid={`roles-matrix-cell-${r.key}-${row.key}`}
                  >
                    {canDo.get(r.key)?.has(row.key) ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-500">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="inline-block w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HierarchyView({ roles }: { roles: RoleDefinition[] }) {
  return (
    <section
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-5 md:p-6 shadow-sm"
      data-testid="roles-hierarchy"
    >
      <p className="text-xs uppercase tracking-widest text-slate-400 mb-4">Who can invite whom</p>
      <ul className="space-y-2.5">
        {roles.map((role) => (
          <li key={role.key} className="flex items-center gap-3 flex-wrap" data-testid={`roles-hierarchy-${role.key}`}>
            <Badge tone={SCOPE_TONE[role.scope]} className="inline-flex items-center gap-1 capitalize font-mono">
              {SCOPE_ICON[role.scope]}
              {role.label}
            </Badge>
            <ChevronRight className="w-4 h-4 text-slate-300" />
            {role.can_invite.length === 0 ? (
              <span className="text-xs text-slate-400 italic">can invite nobody</span>
            ) : (
              <div className="flex gap-1.5 flex-wrap">
                {role.can_invite.map((r) => (
                  <Badge key={r} tone="neutral" className="font-mono">
                    {r}
                  </Badge>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
