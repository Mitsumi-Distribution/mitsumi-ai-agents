import { Check, ChevronDown, ChevronRight, Clock, Database, Loader2, Search, Wrench } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/cn";

type Props = {
  tool: string;
  payload: unknown;
  kind?: "call" | "result";
  latencyMs?: number;
  rows?: number;
};

const TOOL_ICONS: Record<string, string> = {
  crm_search: "search", customer_analytics: "chart", order_search: "search",
  sales_pipeline_summary: "chart", sales_forecast: "chart", data_comparison: "chart",
  invoice_search: "search", finance_aging_report: "chart", quote_search: "search",
  campaign_list: "chart", ticket_search: "search", shipment_status: "search",
  low_stock_report: "chart", erp_query: "search", rag_search: "search",
  document_search: "search", file_gen: "file", excel_export: "file",
  send_email: "action", gmail_send: "action", gmail_read: "search",
  google_calendar_create: "action", google_calendar_list: "search",
  schedule_meeting: "action", task_creator: "action", request_approval: "action",
  web_search: "search", mitsumi_pricing: "search", crm_update: "action",
  calendar_event: "action",
};

export function ToolResultCard({ tool, payload, kind = "result", latencyMs, rows }: Props) {
  const [open, setOpen] = useState(false);
  const isCall = kind === "call";
  const isResult = kind === "result";
  const toolType = TOOL_ICONS[tool] || "search";

  // Friendly label
  const label = tool.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div
      className={cn(
        "rounded-xl border overflow-hidden animate-fade-up transition-all",
        isCall
          ? "border-brand/20 bg-brand/[0.03] dark:bg-brand/[0.05]"
          : "border-emerald-500/20 bg-emerald-500/[0.03] dark:bg-emerald-500/[0.05]"
      )}
      data-testid={`tool-${kind}-${tool}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left group"
        aria-expanded={open}
        data-testid={`tool-${kind}-toggle-${tool}`}
      >
        {/* Icon */}
        <div className={cn(
          "w-6 h-6 rounded-md flex items-center justify-center shrink-0",
          isCall ? "bg-brand/10 text-brand" : "bg-emerald-500/10 text-emerald-500"
        )}>
          {isCall ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Check className="w-3 h-3" />
          )}
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-xs font-medium truncate",
            isCall ? "text-brand" : "text-emerald-600 dark:text-emerald-400"
          )}>
            {isCall ? `Using ${label}…` : label}
          </p>
        </div>

        {/* Meta badges */}
        {isResult && (
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            {latencyMs != null && (
              <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded-md", latencyCls(latencyMs))}
                data-testid={`tool-result-latency-${tool}`}>
                {formatLatency(latencyMs)}
              </span>
            )}
            {rows != null && (
              <span className="text-[10px] font-mono text-slate-500 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800"
                data-testid={`tool-result-rows-${tool}`}>
                {formatRows(rows)}
              </span>
            )}
          </div>
        )}

        <ChevronDown className={cn(
          "w-3.5 h-3.5 text-slate-400 transition-transform",
          !open && "-rotate-90"
        )} />
      </button>

      {/* Collapsible content */}
      {open && (
        <div className="border-t border-slate-200/50 dark:border-slate-700/50">
          <pre className="px-3 py-2.5 text-[11px] font-mono text-slate-600 dark:text-slate-400 overflow-x-auto bg-white/50 dark:bg-slate-950/30 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
            {formatPayload(payload)}
          </pre>
        </div>
      )}
    </div>
  );
}

function formatPayload(payload: unknown): string {
  if (typeof payload === "string") {
    try {
      const parsed = JSON.parse(payload);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return payload;
    }
  }
  return JSON.stringify(payload, null, 2);
}

function formatLatency(ms?: number): string | null {
  if (ms == null || Number.isNaN(ms)) return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
}

function latencyCls(ms?: number): string {
  if (ms == null) return "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";
  if (ms < 500) return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (ms < 2000) return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  if (ms < 5000) return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  return "bg-danger/10 text-danger";
}

function formatRows(n: number): string {
  if (n < 1000) return `${n} ${n === 1 ? "row" : "rows"}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k rows`;
  return `${(n / 1_000_000).toFixed(1)}M rows`;
}
