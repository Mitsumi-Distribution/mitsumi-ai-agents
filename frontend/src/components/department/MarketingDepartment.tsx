import { CalendarRange, Megaphone, Target, TrendingUp } from "lucide-react";
import { StatCard } from "../dashboard/StatCard";
import { DataTable } from "../shared/DataTable";
import { Badge } from "../ui/Badge";
import type { DepartmentOverview } from "../../types";
import { formatCurrency, formatDate, formatNumber } from "../../lib/format";

type Props = { data: DepartmentOverview };

const statusTone: Record<string, "success" | "warning" | "info" | "neutral"> = {
  active: "success",
  planned: "info",
  completed: "neutral",
  paused: "warning"
};

export function MarketingDepartment({ data }: Props) {
  const k = data.kpis as Record<string, number>;
  const channels = data.channel_breakdown ?? [];
  const active = (data.active_campaigns ?? []) as any[];
  const upcoming = (data.upcoming_campaigns ?? []) as any[];

  const maxChannel = Math.max(1, ...channels.map((c) => c.pipeline));

  return (
    <div className="space-y-6" id="marketing-detail">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard
          label="Active Campaigns"
          value={String(k.active_campaigns ?? 0)}
          icon={<Megaphone className="w-4 h-4" />}
          accent="brand"
        />
        <StatCard
          label="Leads Generated"
          value={formatNumber(k.total_leads ?? 0)}
          icon={<Target className="w-4 h-4" />}
          accent="accent"
        />
        <StatCard
          label="Pipeline Influenced"
          value={formatCurrency(k.pipeline_influenced ?? 0)}
          icon={<TrendingUp className="w-4 h-4" />}
          accent="success"
        />
        <StatCard
          label="Campaign Spend"
          value={formatCurrency(k.total_spend ?? 0)}
          icon={<CalendarRange className="w-4 h-4" />}
          deltaLabel={`ROI ${k.roi_ratio ?? 0}x`}
          accent="warning"
        />
      </div>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-6 shadow-sm">
        <div className="mb-5">
          <h3 className="text-sm font-display font-semibold text-slate-900 dark:text-white">
            Performance by channel
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Leads and pipeline sourced by campaign channel
          </p>
        </div>
        <div className="space-y-4">
          {channels.length === 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">No campaign data yet.</p>
          )}
          {channels.map((row) => (
            <div key={row.channel} className="grid grid-cols-[110px_1fr_120px] items-center gap-3 text-xs">
              <Badge tone="brand" className="capitalize justify-self-start">
                {row.channel}
              </Badge>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent via-brand to-brand-light"
                  style={{ width: `${Math.min(100, (row.pipeline / maxChannel) * 100)}%` }}
                />
              </div>
              <div className="text-right tabular-nums font-mono text-slate-700 dark:text-slate-200">
                {formatCurrency(row.pipeline)}
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {row.leads} leads · {formatCurrency(row.spend)} spend
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <DataTable
        testId="marketing-active-campaigns-table"
        title="Active campaigns"
        subtitle="Running campaigns with pipeline already influenced"
        rows={active}
        emptyMessage="No active campaigns."
        columns={[
          { key: "name", label: "Campaign" },
          { key: "channel", label: "Channel", render: (row) => <Badge tone="neutral" className="capitalize">{row.channel as string}</Badge> },
          { key: "principal", label: "Principal" },
          {
            key: "status",
            label: "Status",
            render: (row) => (
              <Badge tone={statusTone[(row.status as string) ?? ""] ?? "neutral"} className="capitalize">
                {row.status as string}
              </Badge>
            )
          },
          { key: "leads_generated", label: "Leads", align: "right", render: (row) => formatNumber(row.leads_generated as number) },
          { key: "pipeline_value", label: "Pipeline", align: "right", render: (row) => formatCurrency(row.pipeline_value as number) }
        ]}
      />

      <DataTable
        testId="marketing-upcoming-campaigns-table"
        title="Upcoming campaigns"
        rows={upcoming}
        emptyMessage="Nothing planned yet."
        columns={[
          { key: "name", label: "Campaign" },
          { key: "channel", label: "Channel", render: (row) => <Badge tone="neutral" className="capitalize">{row.channel as string}</Badge> },
          { key: "principal", label: "Principal" },
          { key: "start_at", label: "Starts", render: (row) => formatDate(row.start_at as string) },
          { key: "owner", label: "Owner", render: (row) => <span className="text-xs">{(row.owner as string) ?? "—"}</span> }
        ]}
      />
    </div>
  );
}
