import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Trash2, UserPlus, X } from "lucide-react";
import { TopBar } from "../../components/layout/TopBar";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/EmptyState";
import {
  deleteUser,
  fetchRegions,
  fetchRoles,
  inviteUser,
  listUsers,
  updateUser
} from "../../api/client";
import type { PlatformUser, RegionInfo, RoleDefinition } from "../../types";
import { useToast } from "../../store/toast";

export function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [regions, setRegions] = useState<RegionInfo[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterQ, setFilterQ] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformUser | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [u, r, rl] = await Promise.all([listUsers(filterQ ? { q: filterQ } : undefined), fetchRegions(), fetchRoles()]);
      setUsers(u);
      setRegions(r.regions);
      setRoles(rl.roles);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <TopBar
        title="Users"
        subtitle={`${users.length} user${users.length === 1 ? "" : "s"} in your scope`}
        actions={
          <Button onClick={() => setInviteOpen(true)} data-testid="users-invite-btn">
            <UserPlus className="w-3.5 h-3.5" />
            Invite user
          </Button>
        }
      />

      <div className="flex-1 flex justify-center">
        <div className="w-full max-w-6xl px-4 md:px-10 py-6 md:py-8 space-y-4">
          <div className="flex items-center gap-2">
            <input
              data-testid="users-search-input"
              value={filterQ}
              onChange={(e) => setFilterQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="Search name or email…"
              className="flex-1 max-w-md px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            />
            <Button variant="secondary" size="sm" onClick={load} data-testid="users-search-btn">
              Search
            </Button>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-16 flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-brand" /> Loading…
            </div>
          ) : users.length === 0 ? (
            <EmptyState title="No users yet" description="Invite your first teammate using the button above." />
          ) : (
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">User</th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">Role</th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">Scope</th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">Status</th>
                      <th className="px-4 md:px-6 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {users.map((user) => (
                      <tr key={user.id} data-testid={`user-row-${user.id}`}>
                        <td className="px-4 md:px-6 py-3">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">{user.name}</p>
                          <p className="text-xs text-slate-500 font-mono">{user.email}</p>
                        </td>
                        <td className="px-4 md:px-6 py-3">
                          <Badge tone="brand" className="font-mono">
                            {user.roles[0] ?? "—"}
                          </Badge>
                        </td>
                        <td className="px-4 md:px-6 py-3 text-xs text-slate-500 dark:text-slate-400">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-700 dark:text-slate-200 capitalize">
                              {user.region ?? (user.is_super_admin ? "all regions" : "—")}
                            </span>
                            <span className="font-mono text-[11px]">{user.country ?? (user.is_super_admin ? "global" : "—")}</span>
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-3">
                          <Badge tone={user.status === "invited" ? "warning" : user.status === "active" ? "success" : "neutral"} className="capitalize">
                            {user.status}
                          </Badge>
                        </td>
                        <td className="px-4 md:px-6 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setEditing(user)}
                              data-testid={`user-edit-${user.id}`}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-brand hover:bg-brand/10"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {!user.is_super_admin && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!confirm(`Remove ${user.email}?`)) return;
                                  try {
                                    await deleteUser(user.id);
                                    setUsers((prev) => prev.filter((u) => u.id !== user.id));
                                    toast.success("User removed");
                                  } catch (err) {
                                    toast.error(err instanceof Error ? err.message : "Delete failed");
                                  }
                                }}
                                data-testid={`user-delete-${user.id}`}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-danger hover:bg-danger/10"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </div>

      {inviteOpen && (
        <UserFormModal
          title="Invite user"
          regions={regions}
          roles={roles}
          onClose={() => setInviteOpen(false)}
          onSubmit={async (values) => {
            try {
              const res = await inviteUser(values);
              if (res.email.delivered) {
                toast.success(`Invite email sent to ${values.email}`);
              } else {
                toast.warning(
                  "Invite created",
                  `Email delivery skipped. Password: ${res.temp_password ?? "—"} · Link: ${res.email.invite_url}`
                );
              }
              setInviteOpen(false);
              setUsers((prev) => [res.user, ...prev]);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Invite failed");
            }
          }}
        />
      )}

      {editing && (
        <UserFormModal
          title="Edit user"
          regions={regions}
          roles={roles}
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (values) => {
            try {
              const updated = await updateUser(editing.id, values);
              setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
              toast.success("User updated");
              setEditing(null);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Update failed");
            }
          }}
        />
      )}
    </>
  );
}

type FormValues = {
  email: string;
  name: string;
  role: string;
  region: string | null;
  country: string | null;
  modules?: string[];
};

const ALL_DEPARTMENTS = ["sales", "marketing", "finance", "ops"];

function buildDefaultModules(role: string, selectedDepartments: string[]): string[] {
  // super_admin gets everything — backend overrides anyway.
  // For every other role we gate department access via the admin's selection.
  const base = ["dashboard", "tasks", "tool_results"];
  const depts = selectedDepartments.length === 0 ? [] : selectedDepartments;
  return [
    ...base,
    ...depts.flatMap((d) => [`department:${d}`, `agent:${d}`]),
  ];
}

function UserFormModal({
  title,
  regions,
  roles,
  initial,
  onClose,
  onSubmit
}: {
  title: string;
  regions: RegionInfo[];
  roles: RoleDefinition[];
  initial?: PlatformUser;
  onClose: () => void;
  onSubmit: (values: FormValues) => Promise<void> | void;
}) {
  const [email, setEmail] = useState(initial?.email ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState(initial?.roles[0] ?? "member");
  const [region, setRegion] = useState<string>(initial?.region ?? "");
  const [country, setCountry] = useState<string>(initial?.country ?? "");
  const initialDepts = useMemo(() => {
    const mods = initial?.modules ?? [];
    if (!mods.length) return role === "member" ? [] : ALL_DEPARTMENTS;
    return ALL_DEPARTMENTS.filter((d) => mods.includes(`department:${d}`));
  }, [initial, role]);
  const [departments, setDepartments] = useState<string[]>(initialDepts);
  const [submitting, setSubmitting] = useState(false);

  const countries = useMemo(() => regions.find((r) => r.key === region)?.countries ?? [], [region, regions]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit({
      email,
      name,
      role,
      region: region || null,
      country: country || null,
      modules: role === "super_admin" ? undefined : buildDefaultModules(role, departments),
    });
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <form
        onSubmit={handleSubmit}
        data-testid="user-form-modal"
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-5 md:p-6 space-y-4 animate-fade-up"
      >
        <header className="flex items-center justify-between">
          <h3 className="text-base font-display font-semibold text-slate-900 dark:text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </header>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-wider text-slate-400">Email</span>
            <input
              data-testid="user-form-email"
              type="email"
              required
              disabled={Boolean(initial)}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm disabled:opacity-60"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-wider text-slate-400">Name</span>
            <input
              data-testid="user-form-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-wider text-slate-400">Role</span>
            <select
              data-testid="user-form-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm"
            >
              {roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-wider text-slate-400">Region</span>
            <select
              data-testid="user-form-region"
              value={region}
              onChange={(e) => {
                setRegion(e.target.value);
                setCountry("");
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm"
            >
              <option value="">(None)</option>
              {regions.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs uppercase tracking-wider text-slate-400">Country</span>
            <select
              data-testid="user-form-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              disabled={!countries.length}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm disabled:opacity-60"
            >
              <option value="">(Any)</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {role !== "super_admin" && (
            <div className="md:col-span-2">
              <p className="text-xs uppercase tracking-wider text-slate-400 mb-2">
                Department access {role === "member" && <span className="normal-case text-slate-400 italic">(members only see the departments you grant)</span>}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2" data-testid="user-form-departments">
                {ALL_DEPARTMENTS.map((dept) => {
                  const active = departments.includes(dept);
                  return (
                    <button
                      key={dept}
                      type="button"
                      data-testid={`user-form-dept-${dept}`}
                      onClick={() =>
                        setDepartments((prev) =>
                          active ? prev.filter((d) => d !== dept) : [...prev, dept]
                        )
                      }
                      className={
                        "text-xs font-semibold capitalize px-3 py-2 rounded-xl border transition-colors " +
                        (active
                          ? "bg-brand text-white border-brand shadow-sm shadow-brand/30"
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-brand/40 hover:text-brand")
                      }
                    >
                      {dept}
                    </button>
                  );
                })}
              </div>
              {departments.length === 0 && role === "member" && (
                <p className="text-[11px] text-amber-500 mt-2">
                  This user won't see any departments — pick at least one.
                </p>
              )}
            </div>
          )}
        </div>
        <footer className="flex items-center justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={submitting} data-testid="user-form-submit">
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
            {initial ? "Save changes" : "Send invite"}
          </Button>
        </footer>
      </form>
    </div>
  );
}
