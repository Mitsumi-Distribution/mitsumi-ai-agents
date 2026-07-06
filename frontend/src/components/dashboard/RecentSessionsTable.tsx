import { Filter, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, BadgeTone } from "../ui/Badge";
import { cn } from "../../lib/cn";

type SessionStatus = "active" | "closed" | "failed";

type SessionRow = {
  id: string;
  query: string;
  agent: string;
  score: number;
  rating: number;
  time: string;
  status: SessionStatus;
};

const rows: SessionRow[] = [
  {
    id: "sess_9f2a",
    query: "Quarterly DELL quote follow-up with Nairobi reseller",
    agent: "sales",
    score: 0.94,
    rating: 4,
    time: "14:32",
    status: "active"
  },
  {
    id: "sess_7c10",
    query: "Draft Q4 marketing email for enterprise segment",
    agent: "marketing",
    score: 0.88,
    rating: 5,
    time: "13:04",
    status: "closed"
  },
  {
    id: "sess_3b81",
    query: "Reconcile October invoice #INV-2041",
    agent: "finance",
    score: 0.72,
    rating: 3,
    time: "11:52",
    status: "closed"
  },
  {
    id: "sess_2dfe",
    query: "Inventory check: HP laptops, Mombasa warehouse",
    agent: "ops",
    score: 0.61,
    rating: 2,
    time: "10:18",
    status: "failed"
  },
  {
    id: "sess_1a4c",
    query: "Pipeline health summary vs last week",
    agent: "sales",
    score: 0.91,
    rating: 5,
    time: "09:06",
    status: "active"
  }
];

const statusTone: Record<SessionStatus, BadgeTone> = {
  active: "success",
  closed: "neutral",
  failed: "danger"
};

function renderRating(value: number): string {
  return "★".repeat(value) + "☆".repeat(5 - value);
}

export function RecentSessionsTable() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-display font-semibold text-slate-900 dark:text-white">
            Recent Conversations
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Last 24 hours across all agents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              placeholder="Search…"
              className="pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand/30 w-44 transition-all placeholder:text-slate-400"
            />
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Filter className="w-3.5 h-3.5" />
            Filter
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800">
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                Session
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                Query
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                Agent
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                Rating
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">
                Time
              </th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
                <td className="px-6 py-4 font-mono text-xs text-slate-400 whitespace-nowrap">
                  #{row.id}
                </td>
                <td className="px-6 py-4 text-slate-800 dark:text-slate-200 font-body max-w-xs">
                  <div className="flex items-center gap-2">
                    <span className="truncate" title={row.query}>
                      {row.query}
                    </span>
                    <Badge tone={statusTone[row.status]} dot pulse={row.status === "active"} className="shrink-0">
                      {row.status}
                    </Badge>
                  </div>
                </td>
                <td className="px-6 py-4 capitalize text-slate-600 dark:text-slate-400">{row.agent}</td>
                <td className="px-6 py-4">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-mono",
                      row.score >= 0.85
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                        : row.score >= 0.7
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400"
                          : "bg-danger/10 text-danger"
                    )}
                  >
                    {row.score.toFixed(2)}
                  </span>
                </td>
                <td className="px-6 py-4 text-amber-400 font-mono text-xs tracking-widest">
                  {renderRating(row.rating)}
                </td>
                <td className="px-6 py-4 font-mono text-xs text-slate-400 whitespace-nowrap">
                  {row.time} today
                </td>
                <td className="px-6 py-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link to={`/agent/${row.agent}`} className="text-xs text-brand hover:underline font-medium">
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <p className="text-xs text-slate-400 font-body">
          Showing <span className="text-slate-600 dark:text-slate-300 font-medium">1–5</span> of 2,841
        </p>
        <div className="flex items-center gap-1">
          <button
            className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors text-sm"
            aria-label="Previous page"
          >
            ‹
          </button>
          <button className="w-8 h-8 rounded-lg bg-brand text-white flex items-center justify-center text-xs font-semibold">
            1
          </button>
          <button className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-xs">
            2
          </button>
          <button className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-xs">
            3
          </button>
          <button
            className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors text-sm"
            aria-label="Next page"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
