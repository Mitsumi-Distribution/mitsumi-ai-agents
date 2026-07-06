import { useMemo, useState, useEffect } from "react";
import { fetchRegions } from "../api/client";
import type { RegionInfo } from "../types";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowUpRight, Bot, ListPlus, Loader2, MessageSquare, RefreshCw } from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { StatCard } from "../components/dashboard/StatCard";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Badge } from "../components/ui/Badge";
import { useDepartmentOverview } from "../hooks/useDepartmentOverview";
import { DepartmentMeta, DEPARTMENTS, findDepartment } from "../lib/departments";
import { canAccessModule, useSessionStore } from "../store/session";
import { SalesDepartment } from "../components/department/SalesDepartment";
import { MarketingDepartment } from "../components/department/MarketingDepartment";
import { FinanceDepartment } from "../components/department/FinanceDepartment";
import { OpsDepartment } from "../components/department/OpsDepartment";
import { DepartmentAgentCard } from "../components/department/DepartmentAgentCard";
import { cn } from "../lib/cn";

export function DepartmentPage({ departmentKey }: { departmentKey?: string }) {
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);
  const meta = useMemo(() => findDepartment(departmentKey), [departmentKey]);

  if (!meta) {
    return <UnknownDepartment />;
  }

  if (!canAccessModule(user, meta.module)) {
    return (
      <>
        <TopBar title={`${meta.label} Department`} />
        <div className="flex-1 px-6 md:px-10 py-10 max-w-7xl w-full mx-auto">
          <EmptyState
            icon={<AlertTriangle className="w-6 h-6" />}
            title="You don't have access to this department"
            description="Ask a super admin to grant you the module permission."
          />
        </div>
      </>
    );
  }

  return <DepartmentPageInner meta={meta} onOpenChat={() => navigate(`/agent/${meta.key}`)} />;
}

function DepartmentPageInner({ meta, onOpenChat }: { meta: DepartmentMeta; onOpenChat: () => void }) {
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);
  const [region, setRegion] = useState<string>("");
  const [country, setCountry] = useState<string>("");
  const [regions, setRegions] = useState<RegionInfo[]>([]);
  const canPickScope = Boolean(user?.is_super_admin);

  useEffect(() => {
    if (!canPickScope) return;
    fetchRegions()
      .then((r) => setRegions(r.regions))
      .catch(() => {});
  }, [canPickScope]);

  const { data, loading, error, refresh } = useDepartmentOverview(meta.key, { region: region || null, country: country || null });

  const countries = useMemo(() => regions.find((r) => r.key === region)?.countries ?? [], [region, regions]);

  return (
    <>
      <TopBar
        title={`${meta.label} Department`}
        subtitle={
          data?.generated_at
            ? `Live data · updated ${new Date(data.generated_at).toLocaleTimeString()}`
            : meta.tagline
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              onClick={refresh}
              data-testid={`department-${meta.key}-refresh-btn`}
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/tasks?department=${meta.key}&new=1`)}
              data-testid={`department-${meta.key}-create-task-btn`}
            >
              <ListPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Create task</span>
            </Button>
            <Button
              size="sm"
              onClick={onOpenChat}
              data-testid={`department-${meta.key}-open-chat-btn`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ask Agent</span>
            </Button>
          </div>
        }
      />

      <div className="flex-1 flex justify-center" data-testid={`department-${meta.key}-page`}>
        <div className="w-full max-w-7xl px-4 md:px-10 py-6 md:py-8 space-y-6">
          <DepartmentHero meta={meta} onOpenChat={onOpenChat} />

          <DepartmentAgentCard agentName={meta.key} departmentLabel={meta.label} accent={meta.accent} />

          {canPickScope && (
            <section
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 md:p-5 shadow-sm flex flex-col md:flex-row md:items-center gap-3"
              data-testid={`department-${meta.key}-scope`}
            >
              <span className="text-xs uppercase tracking-widest text-slate-400 shrink-0">Data scope</span>
              <select
                data-testid={`department-${meta.key}-region-select`}
                value={region}
                onChange={(e) => {
                  setRegion(e.target.value);
                  setCountry("");
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm"
              >
                <option value="">All regions</option>
                {regions.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
              <select
                data-testid={`department-${meta.key}-country-select`}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                disabled={!countries.length}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm disabled:opacity-60"
              >
                <option value="">All countries</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
              {(region || country) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRegion("");
                    setCountry("");
                  }}
                >
                  Reset
                </Button>
              )}
            </section>
          )}

          {error && (
            <div
              className="bg-danger/5 border border-danger/20 rounded-2xl px-5 py-4 text-sm text-danger flex items-center justify-between gap-3"
              data-testid={`department-${meta.key}-error`}
            >
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {error}
              </span>
              <Button variant="secondary" size="sm" onClick={refresh}>
                Retry
              </Button>
            </div>
          )}

          {loading && !data ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-16">
              <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-brand" />
                <p className="text-xs">Loading {meta.label} overview…</p>
              </div>
            </div>
          ) : data ? (
            <>
              {meta.key === "sales" && <SalesDepartment data={data} />}
              {meta.key === "marketing" && <MarketingDepartment data={data} />}
              {meta.key === "finance" && <FinanceDepartment data={data} />}
              {meta.key === "ops" && <OpsDepartment data={data} />}
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}

function DepartmentHero({ meta, onOpenChat }: { meta: DepartmentMeta; onOpenChat: () => void }) {
  const Icon = meta.icon;
  const accentMap: Record<DepartmentMeta["accent"], string> = {
    brand: "from-brand/20 via-brand/5 to-transparent",
    accent: "from-accent/20 via-accent/5 to-transparent",
    success: "from-emerald-400/25 via-emerald-400/5 to-transparent",
    warning: "from-amber-400/25 via-amber-400/5 to-transparent"
  };
  const iconMap: Record<DepartmentMeta["accent"], string> = {
    brand: "bg-brand text-white",
    accent: "bg-accent text-white",
    success: "bg-emerald-500 text-white",
    warning: "bg-amber-500 text-white"
  };
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start md:items-center shadow-sm",
      )}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-tr", accentMap[meta.accent])} aria-hidden />
      <div
        className={cn(
          "relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-300/40 dark:shadow-slate-950/60",
          iconMap[meta.accent]
        )}
      >
        <Icon className="w-6 h-6" />
      </div>
      <div className="relative min-w-0 flex-1">
        <Badge tone="neutral" className="mb-2 uppercase tracking-widest text-[10px]">
          Department
        </Badge>
        <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white">
          {meta.label} at Mitsumi Distribution
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">{meta.tagline}</p>
      </div>
      <div className="relative flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            const anchor = document.getElementById(`${meta.key}-detail`);
            anchor?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          View details
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Button>
        <Button size="sm" onClick={onOpenChat} data-testid={`department-${meta.key}-hero-chat-btn`}>
          <Bot className="w-3.5 h-3.5" />
          Open {meta.label} Agent
        </Button>
      </div>
    </section>
  );
}

function UnknownDepartment() {
  return (
    <>
      <TopBar title="Department not found" />
      <div className="flex-1 px-6 md:px-10 py-10 max-w-5xl w-full mx-auto">
        <EmptyState
          icon={<AlertTriangle className="w-6 h-6" />}
          title="We couldn't find that department"
          description={`Try one of: ${DEPARTMENTS.map((d) => d.label).join(", ")}.`}
        />
      </div>
    </>
  );
}

// Re-export the stat card used across department sections so section files stay lean.
export { StatCard };
