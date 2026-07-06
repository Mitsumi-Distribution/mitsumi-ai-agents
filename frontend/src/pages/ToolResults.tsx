import { useEffect, useState } from "react";
import { Loader2, Sparkles, Wrench } from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { listRecentTools } from "../api/client";
import type { ToolRun } from "../types";
import { formatRelative } from "../lib/format";
import { Link } from "react-router-dom";

export function ToolResults() {
  const [rows, setRows] = useState<ToolRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const list = await listRecentTools(60);
        if (!cancelled) setRows(list);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load tool runs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <TopBar title="Tool Results" subtitle={`${rows.length} recent agent tool run${rows.length === 1 ? "" : "s"}`} />
      <div className="flex-1 flex justify-center">
        <div className="w-full max-w-6xl px-4 md:px-10 py-6 md:py-8 space-y-4">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-16 flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-brand" /> Loading agent tool runs…
            </div>
          ) : error ? (
            <EmptyState icon={<Wrench className="w-6 h-6" />} title="Couldn't load tool runs" description={error} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="w-6 h-6" />}
              title="No tool runs yet"
              description="Once you chat with an agent and it calls a tool, the run will appear here."
            />
          ) : (
            <ol className="relative border-l border-slate-200 dark:border-slate-800 pl-6 space-y-4">
              {rows.map((row, idx) => (
                <li key={idx} data-testid={`tool-run-${idx}`} className="ml-1">
                  <span className="absolute -left-[7px] w-3.5 h-3.5 rounded-full bg-brand border-2 border-white dark:border-slate-950" />
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 md:p-5 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge tone="brand" className="font-mono">
                        {row.tool_name ?? "unknown"}
                      </Badge>
                      <Badge tone={row.status === "error" ? "danger" : "success"} className="capitalize">
                        {row.status}
                      </Badge>
                      <span className="text-[11px] text-slate-400 font-mono">{formatRelative(row.created_at)}</span>
                      <span className="text-[11px] text-slate-400 font-mono">· {(row.chat.agent_name as string) ?? "agent"}</span>
                      {row.chat.chat_id && (
                        <Link
                          to={`/agent/${row.chat.agent_name as string}/c/${row.chat.chat_id as string}`}
                          className="text-[11px] text-brand hover:underline ml-auto"
                        >
                          Open chat →
                        </Link>
                      )}
                    </div>
                    {row.args ? (
                      <pre className="bg-slate-50 dark:bg-slate-950/60 rounded-xl p-3 text-[11px] font-mono text-slate-600 dark:text-slate-400 overflow-x-auto max-h-40">
                        {JSON.stringify(row.args, null, 2)}
                      </pre>
                    ) : null}
                    {row.result_preview && (
                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap line-clamp-6">
                        {row.result_preview}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </>
  );
}
