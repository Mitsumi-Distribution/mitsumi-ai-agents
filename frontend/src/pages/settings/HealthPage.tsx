import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Database,
  HardDrive,
  Loader2,
  MessageSquareWarning,
  RefreshCw,
  Server,
  Sparkles,
  Wrench,
  XCircle,
  Zap
} from "lucide-react";
import { TopBar } from "../../components/layout/TopBar";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { apiFetch } from "../../api/client";
import { useToast } from "../../store/toast";
import { cn } from "../../lib/cn";

type ServiceStatus = "up" | "down" | "warning" | "unknown";
type ServiceCategory = "core" | "workers" | "integrations";

type HealthService = {
  key: string;
  label: string;
  status: ServiceStatus;
  detail: string;
  hint?: string | null;
  latency_ms?: number | null;
  meta?: Record<string, unknown>;
  category: ServiceCategory;
};

type HealthReport = {
  overall: "healthy" | "degraded" | "down";
  generated_at: string;
  services: HealthService[];
};

const ICON_FOR_KEY: Record<string, React.ReactNode> = {
  backend: <Server className="w-4 h-4" />,
  mongodb: <Database className="w-4 h-4" />,
  redis: <HardDrive className="w-4 h-4" />,
  agent_worker: <Zap className="w-4 h-4" />,
  llm: <Sparkles className="w-4 h-4" />,
  resend: <MessageSquareWarning className="w-4 h-4" />,
  tavily: <Wrench className="w-4 h-4" />,
  google: <Wrench className="w-4 h-4" />
};

const STATUS_META: Record<ServiceStatus, { tone: "success" | "warning" | "danger" | "neutral"; label: string; icon: React.ReactNode }> = {
  up: { tone: "success", label: "Up", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  warning: { tone: "warning", label: "Needs attention", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  down: { tone: "danger", label: "Down", icon: <XCircle className="w-3.5 h-3.5" /> },
  unknown: { tone: "neutral", label: "Unknown", icon: <AlertTriangle className="w-3.5 h-3.5" /> }
};

const OVERALL_META: Record<HealthReport["overall"], { tone: "success" | "warning" | "danger"; label: string; hint: string }> = {
  healthy: {
    tone: "success",
    label: "All systems operational",
    hint: "Every service is responding and all API keys are configured."
  },
  degraded: {
    tone: "warning",
    label: "Degraded — action needed",
    hint: "Some services need attention (usually a missing API key)."
  },
  down: {
    tone: "danger",
    label: "Outage — critical services are down",
    hint: "One or more core services failed their health probe."
  }
};

const CATEGORY_META: Record<ServiceCategory, { label: string; description: string }> = {
  core: { label: "Core services", description: "The platform cannot run without these." },
  workers: { label: "Workers & queues", description: "Background job runners and schedulers." },
  integrations: { label: "Integrations & keys", description: "Third-party services (LLM, email, calendar, web search)." }
};

export function HealthPage() {
  const toast = useToast();
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const data = await apiFetch<HealthReport>("/health");
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load health");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(load, 15000);
    return () => window.clearInterval(id);
  }, [autoRefresh, load]);

  const grouped = (report?.services ?? []).reduce<Record<ServiceCategory, HealthService[]>>(
    (acc, svc) => {
      (acc[svc.category] ||= []).push(svc);
      return acc;
    },
    { core: [], workers: [], integrations: [] }
  );

  const counts = (report?.services ?? []).reduce(
    (acc, svc) => {
      acc[svc.status] = (acc[svc.status] ?? 0) + 1;
      return acc;
    },
    { up: 0, warning: 0, down: 0, unknown: 0 } as Record<ServiceStatus, number>
  );

  return (
    <>
      <TopBar
        title="System Health"
        subtitle="Live status of every moving part — auto-refresh or ping on demand"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setAutoRefresh((v) => !v)}
              data-testid="health-auto-refresh-toggle"
              className={cn(
                "text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors",
                autoRefresh
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                  : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-brand/40"
              )}
            >
              {autoRefresh ? "Auto-refresh · 15s" : "Auto-refresh off"}
            </button>
            <Button size="sm" onClick={load} disabled={refreshing} data-testid="health-refresh-btn">
              <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        }
      />
      <div className="flex-1 flex justify-center">
        <div className="w-full max-w-5xl px-4 md:px-10 py-6 md:py-8 space-y-5">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-16 flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-brand" /> Probing services…
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-danger/30 bg-danger/5 text-danger px-5 py-4 text-sm">
              {error}
            </div>
          ) : report ? (
            <>
              <OverallCard report={report} counts={counts} />

              {(Object.keys(grouped) as ServiceCategory[]).map((category) => {
                const services = grouped[category];
                if (!services?.length) return null;
                const meta = CATEGORY_META[category];
                return (
                  <section
                    key={category}
                    data-testid={`health-category-${category}`}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-sm"
                  >
                    <header className="px-5 md:px-6 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-baseline justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-sm font-display font-semibold text-slate-900 dark:text-white">{meta.label}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{meta.description}</p>
                      </div>
                      <Badge tone="neutral" className="font-mono">{services.length}</Badge>
                    </header>
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                      {services.map((svc) => (
                        <ServiceRow key={svc.key} svc={svc} onCopy={(text) => {
                          navigator.clipboard?.writeText(text).then(() => toast.success("Copied")).catch(() => {});
                        }} />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </>
          ) : null}

          {report && (
            <p className="text-center text-[11px] text-slate-400 font-mono pt-2">
              Last check: {new Date(report.generated_at).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

function OverallCard({ report, counts }: { report: HealthReport; counts: Record<ServiceStatus, number> }) {
  const meta = OVERALL_META[report.overall];
  const toneClasses = {
    success: "from-emerald-500/20 via-white to-white dark:from-emerald-500/10 dark:via-slate-900 dark:to-slate-900 border-emerald-500/30",
    warning: "from-amber-500/20 via-white to-white dark:from-amber-500/10 dark:via-slate-900 dark:to-slate-900 border-amber-500/30",
    danger: "from-danger/20 via-white to-white dark:from-danger/10 dark:via-slate-900 dark:to-slate-900 border-danger/30"
  }[meta.tone];
  const dotClasses = {
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-danger"
  }[meta.tone];
  return (
    <section
      className={cn(
        "rounded-2xl border p-5 md:p-6 shadow-sm bg-gradient-to-br",
        toneClasses
      )}
      data-testid="health-overall-card"
    >
      <div className="flex items-center gap-3 flex-wrap">
        <span className={cn("inline-block w-3 h-3 rounded-full animate-pulse", dotClasses)} />
        <h2 className="text-lg md:text-xl font-display font-semibold text-slate-900 dark:text-white">
          {meta.label}
        </h2>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 max-w-2xl">{meta.hint}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
        <Stat label="Up" value={counts.up} tone="success" />
        <Stat label="Attention" value={counts.warning} tone="warning" />
        <Stat label="Down" value={counts.down} tone="danger" />
        <Stat label="Unknown" value={counts.unknown} tone="neutral" />
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "success" | "warning" | "danger" | "neutral" }) {
  const bg = {
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    danger: "bg-danger/10 text-danger",
    neutral: "bg-slate-200/60 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
  }[tone];
  return (
    <div className={cn("rounded-xl px-3 py-2.5", bg)}>
      <p className="text-[11px] uppercase tracking-widest font-semibold opacity-75">{label}</p>
      <p className="text-2xl font-display font-bold">{value}</p>
    </div>
  );
}

function ServiceRow({ svc, onCopy }: { svc: HealthService; onCopy: (text: string) => void }) {
  const meta = STATUS_META[svc.status];
  const toneBorder = {
    success: "border-emerald-500/30 bg-emerald-500/5",
    warning: "border-amber-500/30 bg-amber-500/5",
    danger: "border-danger/30 bg-danger/5",
    neutral: "border-slate-200 bg-slate-100/40 dark:border-slate-700 dark:bg-slate-800/20"
  }[meta.tone];
  return (
    <li
      className="px-5 md:px-6 py-3.5 flex items-start gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors"
      data-testid={`health-row-${svc.key}`}
    >
      <div className={cn("mt-0.5 w-9 h-9 shrink-0 rounded-xl border flex items-center justify-center text-slate-700 dark:text-slate-200", toneBorder)}>
        {ICON_FOR_KEY[svc.key] ?? <Server className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{svc.label}</p>
          <Badge tone={meta.tone} className="inline-flex items-center gap-1 capitalize">
            {meta.icon}
            {meta.label}
          </Badge>
          {svc.latency_ms != null && (
            <span className="text-[11px] font-mono text-slate-400">{svc.latency_ms}ms</span>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{svc.detail}</p>
        {svc.hint && (
          <div className="mt-2 flex items-start gap-2 rounded-lg bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-slate-600 dark:text-slate-300">{svc.hint}</p>
            </div>
            <button
              type="button"
              onClick={() => onCopy(svc.hint ?? "")}
              data-testid={`health-copy-${svc.key}`}
              title="Copy hint"
              className="shrink-0 w-6 h-6 rounded-md text-slate-400 hover:text-brand hover:bg-brand/10 flex items-center justify-center"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
