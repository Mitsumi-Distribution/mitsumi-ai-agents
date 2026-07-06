import { BriefcaseBusiness, DollarSign, Target, TrendingUp } from "lucide-react";
import { StatCard } from "../dashboard/StatCard";
import { DataTable } from "../shared/DataTable";
import { Badge } from "../ui/Badge";
import type { DepartmentOverview } from "../../types";
import { formatCurrency, formatRelative } from "../../lib/format";

type Props = { data: DepartmentOverview };

const stageTone: Record<string, "brand" | "info" | "warning" | "success"> = {
  open: "info",
  qualified: "brand",
  proposal: "warning",
  negotiation: "warning",
  won: "success"
};

export function SalesDepartment({ data }: Props) {
  const k = data.kpis as Record<string, number>;
  const stages = data.stage_breakdown ?? [];
  const deals = (data.top_deals ?? []) as any[];
  const orders = (data.recent_orders ?? []) as any[];

  const maxStageValue = Math.max(1, ...stages.map((s) => s.value));

  return (
    <div className="space-y-6" id="sales-detail">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard
          label="Open Pipeline"
          value={formatCurrency(k.pipeline_value ?? 0)}
          icon={<TrendingUp className="w-4 h-4" />}
          accent="brand"
        />
        <StatCard
          label="Weighted Forecast"
          value={formatCurrency(k.weighted_pipeline ?? 0)}
          icon={<Target className="w-4 h-4" />}
          accent="accent"
        />
        <StatCard
          label="Closed-Won Value"
          value={formatCurrency(k.won_deals_value ?? 0)}
          icon={<BriefcaseBusiness className="w-4 h-4" />}
          accent="success"
        />
        <StatCard
          label="Fulfilled Orders"
          value={formatCurrency(k.orders_total_value ?? 0)}
          icon={<DollarSign className="w-4 h-4" />}
          deltaLabel={`${k.orders_count ?? 0} orders`}
          accent="warning"
        />
      </div>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h3 className="text-sm font-display font-semibold text-slate-900 dark:text-white">
              Pipeline by stage
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Open opportunities broken down by sales stage (USD)
            </p>
          </div>
        </div>
        <div className="space-y-4">
          {stages.length === 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">No open deals.</p>
          )}
          {stages.map((row) => (
            <div key={row.stage} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <Badge tone={stageTone[row.stage] ?? "neutral"} className="capitalize">
                    {row.stage}
                  </Badge>
                  <span className="text-slate-500 dark:text-slate-400">{row.count} deals</span>
                </span>
                <span className="tabular-nums font-mono text-slate-700 dark:text-slate-200">
                  {formatCurrency(row.value)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand to-brand-light"
                  style={{ width: `${Math.min(100, (row.value / maxStageValue) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <DataTable
        testId="sales-top-deals-table"
        title="Top open deals"
        subtitle="Ranked by contract value"
        rows={deals}
        emptyMessage="No open deals."
        columns={[
          { key: "customer_name", label: "Customer" },
          { key: "principal", label: "Principal" },
          {
            key: "stage",
            label: "Stage",
            render: (row) => (
              <Badge tone={stageTone[row.stage as string] ?? "neutral"} className="capitalize">
                {row.stage as string}
              </Badge>
            )
          },
          { key: "owner", label: "Owner", render: (row) => <span className="text-xs">{(row.owner as string) ?? "—"}</span> },
          { key: "amount", label: "Value", align: "right", render: (row) => formatCurrency(row.amount as number) }
        ]}
      />

      <DataTable
        testId="sales-recent-orders-table"
        title="Recent fulfilled orders"
        subtitle="Revenue already booked"
        rows={orders}
        emptyMessage="No recent orders."
        columns={[
          { key: "order_id", label: "Order" },
          { key: "customer_name", label: "Customer" },
          { key: "principal", label: "Principal" },
          { key: "closed_at", label: "Closed", render: (row) => formatRelative(row.closed_at as string) },
          { key: "amount", label: "Amount", align: "right", render: (row) => formatCurrency(row.amount as number) }
        ]}
      />
    </div>
  );
}
