import { AlertOctagon, ArrowDownCircle, BanknoteIcon, CreditCard } from "lucide-react";
import { StatCard } from "../dashboard/StatCard";
import { DataTable } from "../shared/DataTable";
import { Badge } from "../ui/Badge";
import type { DepartmentOverview } from "../../types";
import { formatCurrency, formatDate } from "../../lib/format";

type Props = { data: DepartmentOverview };

const statusTone: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  paid: "success",
  outstanding: "warning",
  overdue: "danger"
};

export function FinanceDepartment({ data }: Props) {
  const k = data.kpis as Record<string, number>;
  const aging = data.aging ?? [];
  const overdue = (data.top_overdue ?? []) as any[];
  const recent = (data.recent_invoices ?? []) as any[];
  const maxAging = Math.max(1, ...aging.map((a) => a.total));

  return (
    <div className="space-y-6" id="finance-detail">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard
          label="Booked Revenue"
          value={formatCurrency(k.revenue_total ?? 0)}
          icon={<BanknoteIcon className="w-4 h-4" />}
          accent="success"
        />
        <StatCard
          label="AR Outstanding"
          value={formatCurrency(k.outstanding_total ?? 0)}
          icon={<CreditCard className="w-4 h-4" />}
          deltaLabel={`${k.outstanding_count ?? 0} invoices`}
          accent="brand"
        />
        <StatCard
          label="Overdue Balance"
          value={formatCurrency(k.overdue_total ?? 0)}
          icon={<AlertOctagon className="w-4 h-4" />}
          deltaLabel={`${k.overdue_count ?? 0} invoices`}
          accent="warning"
        />
        <StatCard
          label="Paid YTD"
          value={formatCurrency(k.paid_total ?? 0)}
          icon={<ArrowDownCircle className="w-4 h-4" />}
          accent="accent"
        />
      </div>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-6 shadow-sm">
        <div className="mb-5">
          <h3 className="text-sm font-display font-semibold text-slate-900 dark:text-white">
            AR aging
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Outstanding balances bucketed by days overdue
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {aging.map((row) => (
            <div
              key={row.bucket}
              className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2"
            >
              <p className="text-xs uppercase tracking-wider text-slate-400">{row.bucket}</p>
              <p className="text-lg font-display font-semibold text-slate-900 dark:text-white tabular-nums">
                {formatCurrency(row.total)}
              </p>
              <p className="text-[11px] text-slate-500">{row.count} invoices</p>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-danger"
                  style={{ width: `${Math.min(100, (row.total / maxAging) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <DataTable
        testId="finance-overdue-table"
        title="Top overdue invoices"
        subtitle="Escalate collections starting from the top"
        rows={overdue}
        emptyMessage="No overdue invoices."
        columns={[
          { key: "invoice_id", label: "Invoice" },
          { key: "customer_name", label: "Customer" },
          { key: "due_at", label: "Due", render: (row) => formatDate(row.due_at as string) },
          { key: "days_overdue", label: "Days overdue", align: "right", render: (row) => <Badge tone="danger">{row.days_overdue as number}d</Badge> },
          { key: "amount", label: "Amount", align: "right", render: (row) => formatCurrency(row.amount as number) }
        ]}
      />

      <DataTable
        testId="finance-recent-invoices-table"
        title="Recent invoices"
        rows={recent}
        emptyMessage="No invoices issued."
        columns={[
          { key: "invoice_id", label: "Invoice" },
          { key: "customer_name", label: "Customer" },
          { key: "issued_at", label: "Issued", render: (row) => formatDate(row.issued_at as string) },
          {
            key: "status",
            label: "Status",
            render: (row) => (
              <Badge tone={statusTone[(row.status as string) ?? ""] ?? "neutral"} className="capitalize">
                {row.status as string}
              </Badge>
            )
          },
          { key: "amount", label: "Amount", align: "right", render: (row) => formatCurrency(row.amount as number) }
        ]}
      />
    </div>
  );
}
