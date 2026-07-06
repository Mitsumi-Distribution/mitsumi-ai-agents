import { useEffect, useState } from "react";
import { BarChart3, Cpu, DollarSign, Zap } from "lucide-react";
import { apiFetch } from "../../api/client";
import { cn } from "../../lib/cn";

type UsageRow = {
  department: string;
  model: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
};

type UsageSummary = {
  period_days: number;
  total_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  by_department_model: UsageRow[];
};

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  haiku: { input: 0.80, output: 4.0 },
  sonnet: { input: 3.0, output: 15.0 },
  opus: { input: 15.0, output: 75.0 },
};

function estimateCost(row: UsageRow): number {
  const rates = MODEL_COSTS[row.model] || { input: 1, output: 5 };
  return (row.input_tokens / 1_000_000) * rates.input + (row.output_tokens / 1_000_000) * rates.output;
}

function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

function formatCost(n: number): string {
  if (n < 0.01) return "<$0.01";
  return `$${n.toFixed(2)}`;
}

const DEPT_COLORS: Record<string, string> = {
  sales: "bg-brand",
  marketing: "bg-emerald-500",
  finance: "bg-amber-500",
  ops: "bg-purple-500",
};

export function TokenUsagePage() {
  const [data, setData] = useState<UsageSummary | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<UsageSummary>(`/settings/token-usage?days=${days}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  const totalCost = data?.by_department_model.reduce((sum, r) => sum + estimateCost(r), 0) ?? 0;

  // Group by department for the bar chart
  const byDept: Record<string, { calls: number; tokens: number; cost: number }> = {};
  (data?.by_department_model ?? []).forEach((r) => {
    if (!byDept[r.department]) byDept[r.department] = { calls: 0, tokens: 0, cost: 0 };
    byDept[r.department].calls += r.calls;
    byDept[r.department].tokens += r.total_tokens;
    byDept[r.department].cost += estimateCost(r);
  });
  const maxTokens = Math.max(...Object.values(byDept).map((d) => d.tokens), 1);

  return (
    <div className="flex-1 px-4 md:px-10 py-8 max-w-5xl w-full mx-auto space-y-8" data-testid="token-usage-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold text-slate-900 dark:text-white">Token Usage</h1>
          <p className="text-sm text-slate-500 mt-1">Monitor API usage and estimated costs by department and model.</p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          data-testid="token-usage-period"
          className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map((k) => <div key={k} className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl" />)}</div>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<Zap className="w-4 h-4" />} label="Total Calls" value={String(data?.total_calls ?? 0)} color="bg-brand" />
            <StatCard icon={<Cpu className="w-4 h-4" />} label="Input Tokens" value={formatTokens(data?.total_input_tokens ?? 0)} color="bg-emerald-500" />
            <StatCard icon={<BarChart3 className="w-4 h-4" />} label="Output Tokens" value={formatTokens(data?.total_output_tokens ?? 0)} color="bg-amber-500" />
            <StatCard icon={<DollarSign className="w-4 h-4" />} label="Est. Cost" value={formatCost(totalCost)} color="bg-purple-500" />
          </div>

          {/* Department breakdown */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-display font-semibold text-slate-900 dark:text-white mb-4">Usage by Department</h2>
            {Object.keys(byDept).length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">No usage data yet. Start chatting with an agent!</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(byDept).map(([dept, d]) => (
                  <div key={dept} className="flex items-center gap-4" data-testid={`usage-dept-${dept}`}>
                    <span className="w-20 text-sm font-semibold text-slate-700 dark:text-slate-300 capitalize">{dept}</span>
                    <div className="flex-1 h-7 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden relative">
                      <div
                        className={cn("h-full rounded-lg transition-all duration-500", DEPT_COLORS[dept] || "bg-slate-500")}
                        style={{ width: `${Math.max(2, (d.tokens / maxTokens) * 100)}%` }}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-500">
                        {formatTokens(d.tokens)}
                      </span>
                    </div>
                    <span className="w-16 text-right text-xs font-mono text-slate-500">{d.calls} calls</span>
                    <span className="w-16 text-right text-xs font-mono text-slate-700 dark:text-slate-300">{formatCost(d.cost)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detailed table */}
          {(data?.by_department_model ?? []).length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-base font-display font-semibold text-slate-900 dark:text-white">Detailed Breakdown</h2>
              </div>
              <table className="w-full text-sm" data-testid="token-usage-table">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">Model</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-widest text-slate-400">Calls</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-widest text-slate-400">Input</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-widest text-slate-400">Output</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-widest text-slate-400">Est. Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data!.by_department_model.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-3 capitalize font-medium text-slate-800 dark:text-slate-200">{r.department}</td>
                      <td className="px-6 py-3 capitalize text-slate-600 dark:text-slate-400">{r.model}</td>
                      <td className="px-6 py-3 text-right font-mono">{r.calls}</td>
                      <td className="px-6 py-3 text-right font-mono text-slate-500">{formatTokens(r.input_tokens)}</td>
                      <td className="px-6 py-3 text-right font-mono text-slate-500">{formatTokens(r.output_tokens)}</td>
                      <td className="px-6 py-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">{formatCost(estimateCost(r))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Cost note */}
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-5 text-xs text-slate-500 dark:text-slate-400">
            <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">How costs are estimated</p>
            <p>
              Token counts are approximated from word counts (not exact API billing). Actual AWS Bedrock costs may differ.
              For precise billing, check <a href="https://console.aws.amazon.com/bedrock" target="_blank" rel="noopener" className="text-brand hover:underline">AWS Console</a>.
              Rates: Haiku $0.80/$4, Sonnet $3/$15, Opus $15/$75 per 1M input/output tokens.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-5 shadow-sm" data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">{label}</span>
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-white", color)}>{icon}</div>
      </div>
      <p className="text-2xl font-display font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
