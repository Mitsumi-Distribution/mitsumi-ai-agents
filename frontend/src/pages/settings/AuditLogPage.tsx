import { useEffect, useState } from "react";
import { History as HistoryIcon, Loader2, RefreshCw } from "lucide-react";
import { TopBar } from "../../components/layout/TopBar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { listAuditEntries } from "../../api/client";
import type { AuditEntry } from "../../types";
import { formatRelative } from "../../lib/format";
import { Pagination } from "../NotificationsPage";

const PAGE_SIZE = 25;

const ACTION_LABELS: Record<string, { label: string; tone: "brand" | "success" | "warning" | "danger" | "info" | "neutral" }> = {
  "user.invite": { label: "User invited", tone: "success" },
  "user.update": { label: "User updated", tone: "info" },
  "user.delete": { label: "User deleted", tone: "danger" },
  "user.password_set": { label: "Password set", tone: "brand" },
  "preferences.update": { label: "Preferences updated", tone: "neutral" },
  "department.scope_override": { label: "Scope override", tone: "warning" },
  "region.create": { label: "Region created", tone: "success" },
  "region.update": { label: "Region updated", tone: "info" },
  "region.delete": { label: "Region deleted", tone: "danger" },
  "region.country.add": { label: "Country added", tone: "success" },
  "region.country.remove": { label: "Country removed", tone: "warning" }
};

export function AuditLogPage() {
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string>("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await listAuditEntries({
        action: actionFilter || undefined,
        limit: PAGE_SIZE,
        skip: page * PAGE_SIZE
      });
      setRows(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <TopBar
        title="Audit Log"
        subtitle={`${total} event${total === 1 ? "" : "s"}${actionFilter ? ` · filtered by ${actionFilter}` : ""}`}
        actions={
          <Button variant="secondary" size="sm" onClick={load} data-testid="audit-refresh-btn">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />
      <div className="flex-1 flex justify-center">
        <div className="w-full max-w-5xl px-4 md:px-10 py-6 md:py-8 space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1" data-testid="audit-filter-bar">
            <FilterChip label="All" value="" current={actionFilter} onSelect={(v) => { setActionFilter(v); setPage(0); }} />
            {Object.entries(ACTION_LABELS).map(([key, meta]) => (
              <FilterChip
                key={key}
                label={meta.label}
                value={key}
                current={actionFilter}
                onSelect={(v) => { setActionFilter(v); setPage(0); }}
              />
            ))}
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-16 flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-brand" /> Loading audit events…
            </div>
          ) : error ? (
            <EmptyState icon={<HistoryIcon className="w-6 h-6" />} title="Couldn't load audit log" description={error} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<HistoryIcon className="w-6 h-6" />}
              title="No audit events yet"
              description="Invites, role changes, scope overrides and password resets will appear here."
            />
          ) : (
            <ol className="relative border-l border-slate-200 dark:border-slate-800 pl-6 space-y-3" data-testid="audit-list">
              {rows.map((row) => {
                const meta = ACTION_LABELS[row.action] ?? { label: row.action, tone: "neutral" as const };
                return (
                  <li key={row.id} data-testid={`audit-row-${row.id}`} className="ml-1">
                    <span className="absolute -left-[7px] w-3.5 h-3.5 rounded-full bg-brand border-2 border-white dark:border-slate-950" />
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 md:p-5 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <Badge tone={meta.tone} className="capitalize">
                          {meta.label}
                        </Badge>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {formatRelative(row.created_at)}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono ml-auto">
                          {new Date(row.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-200">
                        <span className="font-semibold">{row.actor_name ?? row.actor_email ?? "system"}</span>
                        {row.target ? (
                          <>
                            <span className="text-slate-400 mx-1">→</span>
                            <span className="font-mono text-[13px]">{row.target}</span>
                          </>
                        ) : null}
                      </p>
                      {Object.keys(row.metadata).length > 0 && (
                        <pre className="mt-2 bg-slate-50 dark:bg-slate-950/60 rounded-xl p-3 text-[11px] font-mono text-slate-600 dark:text-slate-400 overflow-x-auto">
                          {JSON.stringify(row.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {rows.length > 0 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              onPrev={() => setPage((p) => Math.max(0, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              testIdPrefix="audit"
            />
          )}
        </div>
      </div>
    </>
  );
}

function FilterChip({
  label,
  value,
  current,
  onSelect
}: {
  label: string;
  value: string;
  current: string;
  onSelect: (value: string) => void;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      data-testid={`audit-filter-${value || "all"}`}
      onClick={() => onSelect(value)}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border ${
        active
          ? "bg-brand text-white border-brand"
          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand/40"
      }`}
    >
      {label}
    </button>
  );
}
