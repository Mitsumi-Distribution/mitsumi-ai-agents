import { AlertTriangle, CheckCircle2, PackageSearch, Truck } from "lucide-react";
import { StatCard } from "../dashboard/StatCard";
import { DataTable } from "../shared/DataTable";
import { Badge } from "../ui/Badge";
import type { DepartmentOverview } from "../../types";
import { formatCurrency, formatDate, formatNumber, formatRelative } from "../../lib/format";

type Props = { data: DepartmentOverview };

const priorityTone: Record<string, "danger" | "warning" | "info" | "neutral"> = {
  critical: "danger",
  high: "warning",
  medium: "info",
  low: "neutral"
};

const statusTone: Record<string, "warning" | "info" | "success" | "neutral"> = {
  open: "warning",
  in_progress: "info",
  resolved: "success",
  delivered: "success",
  in_transit: "info"
};

export function OpsDepartment({ data }: Props) {
  const k = data.kpis as Record<string, number>;
  const tickets = (data.open_tickets ?? []) as any[];
  const shipments = (data.shipments_in_transit ?? []) as any[];
  const lowStock = (data.low_stock ?? []) as any[];
  const priorities = data.tickets_by_priority ?? [];

  return (
    <div className="space-y-6" id="ops-detail">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard
          label="Open Tickets"
          value={formatNumber(k.tickets_open ?? 0)}
          icon={<AlertTriangle className="w-4 h-4" />}
          accent="warning"
        />
        <StatCard
          label="Shipments In Transit"
          value={formatNumber(k.shipments_in_transit ?? 0)}
          icon={<Truck className="w-4 h-4" />}
          accent="brand"
        />
        <StatCard
          label="Delivered"
          value={formatNumber(k.shipments_delivered ?? 0)}
          icon={<CheckCircle2 className="w-4 h-4" />}
          accent="success"
        />
        <StatCard
          label="SKUs Below Reorder"
          value={formatNumber(k.sku_low_stock ?? 0)}
          icon={<PackageSearch className="w-4 h-4" />}
          accent="accent"
        />
      </div>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-6 shadow-sm">
        <div className="mb-5">
          <h3 className="text-sm font-display font-semibold text-slate-900 dark:text-white">
            Open tickets by priority
          </h3>
        </div>
        <div className="flex flex-wrap gap-3">
          {priorities.length === 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">No open tickets.</p>
          )}
          {priorities.map((p) => (
            <div
              key={p.priority}
              className="flex items-center gap-3 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800"
            >
              <Badge tone={priorityTone[p.priority ?? ""] ?? "neutral"} className="uppercase">
                {p.priority}
              </Badge>
              <span className="text-sm font-display font-semibold text-slate-900 dark:text-white">
                {p.count}
              </span>
            </div>
          ))}
        </div>
      </section>

      <DataTable
        testId="ops-open-tickets-table"
        title="Open ops tickets"
        subtitle="Sorted by priority, most recent first"
        rows={tickets}
        emptyMessage="No open tickets — nice."
        columns={[
          { key: "ticket_id", label: "Ticket" },
          { key: "customer_name", label: "Customer" },
          { key: "subject", label: "Subject" },
          {
            key: "priority",
            label: "Priority",
            render: (row) => (
              <Badge tone={priorityTone[(row.priority as string) ?? ""] ?? "neutral"} className="uppercase">
                {row.priority as string}
              </Badge>
            )
          },
          {
            key: "status",
            label: "Status",
            render: (row) => (
              <Badge tone={statusTone[(row.status as string) ?? ""] ?? "neutral"} className="capitalize">
                {((row.status as string) ?? "").replace("_", " ")}
              </Badge>
            )
          },
          {
            key: "created_at",
            label: "Opened",
            align: "right",
            render: (row) => formatRelative(row.created_at as string)
          }
        ]}
      />

      <DataTable
        testId="ops-shipments-table"
        title="Shipments in transit"
        rows={shipments}
        emptyMessage="No active shipments."
        columns={[
          { key: "shipment_id", label: "Shipment" },
          { key: "customer_name", label: "Customer" },
          { key: "carrier", label: "Carrier" },
          { key: "tracking", label: "Tracking" },
          { key: "eta", label: "ETA", align: "right", render: (row) => formatDate(row.eta as string) }
        ]}
      />

      <DataTable
        testId="ops-low-stock-table"
        title="SKUs at or below reorder point"
        rows={lowStock}
        emptyMessage="Stock levels healthy."
        columns={[
          { key: "sku", label: "SKU" },
          { key: "product_name", label: "Product" },
          { key: "warehouse", label: "Warehouse" },
          { key: "quantity", label: "On hand", align: "right", render: (row) => <Badge tone="warning">{formatNumber(row.quantity as number)}</Badge> },
          { key: "reorder_point", label: "Reorder", align: "right", render: (row) => formatNumber(row.reorder_point as number) },
          { key: "eta_days", label: "ETA", align: "right", render: (row) => `${formatNumber(row.eta_days as number)}d` }
        ]}
      />
    </div>
  );
}
