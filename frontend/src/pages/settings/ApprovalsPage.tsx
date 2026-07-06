import { useEffect, useState } from "react";
import { Check, Clock, Filter, Loader2, ShieldCheck, X } from "lucide-react";
import { apiFetch } from "../../api/client";
import { useToast } from "../../store/toast";
import { cn } from "../../lib/cn";

type Approval = {
  id: string; title: string; description: string; department: string;
  approver_email: string; amount: number; category: string; status: string;
  reviewer_email?: string; reviewer_note?: string;
  created_at: string; updated_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  rejected: "bg-danger/10 text-danger border-danger/20",
};
const CATEGORIES = ["all", "credit_hold", "deal_registration", "pricing_exception", "budget", "general"];

export function ApprovalsPage() {
  const toast = useToast();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("status", filter);
      if (catFilter !== "all") params.set("category", catFilter);
      const data = await apiFetch<Approval[]>(`/settings/approvals?${params}`);
      setApprovals(data);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [filter, catFilter]);

  async function handleAction(id: string, status: "approved" | "rejected") {
    try {
      await apiFetch(`/settings/approvals/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: "" }),
      });
      toast.success(`Request ${status}`);
      load();
    } catch (e: any) { toast.error(e.message); }
  }

  const counts = {
    all: approvals.length,
    pending: approvals.filter(a => a.status === "pending").length,
    approved: approvals.filter(a => a.status === "approved").length,
    rejected: approvals.filter(a => a.status === "rejected").length,
  };

  return (
    <div className="flex-1 px-4 md:px-10 py-8 max-w-5xl w-full mx-auto space-y-6" data-testid="approvals-page">
      <div>
        <h1 className="text-2xl font-display font-semibold text-slate-900 dark:text-white">Approvals</h1>
        <p className="text-sm text-slate-500 mt-1">Review and manage approval requests from agents and team members.</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {["all", "pending", "approved", "rejected"].map(s => (
          <button key={s} onClick={() => setFilter(s)} data-testid={`approval-filter-${s}`}
            className={cn("px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors capitalize",
              filter === s ? "bg-brand text-white border-brand" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand/40")}>
            {s} {s === "all" ? "" : `(${counts[s as keyof typeof counts] || 0})`}
          </button>
        ))}
        <div className="ml-2">
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            {CATEGORIES.map(c => <option key={c} value={c}>{c === "all" ? "All categories" : c.replace("_", " ")}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex items-center justify-center text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
        </div>
      ) : approvals.length === 0 ? (
        <div className="text-center py-16">
          <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No approval requests yet</p>
          <p className="text-xs text-slate-400 mt-1">Agents can submit approvals using the request_approval tool</p>
        </div>
      ) : (
        <div className="space-y-3" data-testid="approvals-list">
          {approvals.map(a => (
            <div key={a.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-5 shadow-sm" data-testid={`approval-${a.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize", STATUS_COLORS[a.status] || STATUS_COLORS.pending)}>
                      {a.status}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 capitalize">
                      {a.category.replace("_", " ")}
                    </span>
                    {a.department && <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand/10 text-brand capitalize">{a.department}</span>}
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{a.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">{a.description}</p>
                  {a.amount > 0 && <p className="text-xs font-mono text-slate-600 dark:text-slate-400 mt-1">Amount: ${a.amount.toLocaleString()}</p>}
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
                    {a.approver_email && <span>Approver: {a.approver_email}</span>}
                    <span>{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                  {a.reviewer_note && (
                    <p className="text-xs text-slate-500 mt-2 italic">Note: {a.reviewer_note}</p>
                  )}
                </div>
                {a.status === "pending" && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => handleAction(a.id, "approved")} data-testid={`approve-${a.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors">
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button onClick={() => handleAction(a.id, "rejected")} data-testid={`reject-${a.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-danger/10 text-danger hover:bg-danger/20 transition-colors">
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
