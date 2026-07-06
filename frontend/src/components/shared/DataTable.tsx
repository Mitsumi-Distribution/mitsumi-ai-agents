import { ReactNode } from "react";
import { cn } from "../../lib/cn";

type DataRow = Record<string, unknown>;

type Column<T extends DataRow> = {
  key: keyof T | string;
  label: string;
  align?: "left" | "right";
  render?: (row: T) => ReactNode;
  className?: string;
};

type Props<T extends DataRow> = {
  title: string;
  subtitle?: string;
  rows: T[];
  columns: Column<T>[];
  emptyMessage?: string;
  action?: ReactNode;
  testId?: string;
};

export function DataTable<T extends DataRow>({
  title,
  subtitle,
  rows,
  columns,
  emptyMessage = "No records yet.",
  action,
  testId
}: Props<T>) {
  return (
    <section
      data-testid={testId}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-sm"
    >
      <header className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-display font-semibold text-slate-900 dark:text-white">{title}</h3>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>

      {rows.length === 0 ? (
        <div className="px-6 py-10 text-center text-xs text-slate-500 dark:text-slate-400">{emptyMessage}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                {columns.map((col) => (
                  <th
                    key={String(col.key)}
                    className={cn(
                      "px-6 py-3 text-xs font-semibold uppercase tracking-widest text-slate-400",
                      col.align === "right" ? "text-right" : "text-left"
                    )}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((row, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  {columns.map((col) => {
                    const raw = row[col.key as keyof T];
                    const content = col.render ? col.render(row) : ((raw as ReactNode) ?? "—");
                    return (
                      <td
                        key={String(col.key)}
                        className={cn(
                          "px-6 py-3 text-slate-700 dark:text-slate-300 font-body whitespace-nowrap",
                          col.align === "right" ? "text-right tabular-nums" : "text-left",
                          col.className
                        )}
                      >
                        {content as ReactNode}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
