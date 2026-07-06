import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, Bot, Info, Sparkles, Wrench, X } from "lucide-react";
import { Link } from "react-router-dom";
import { fetchAgentTools } from "../../api/client";
import type { AgentToolInfo } from "../../types";
import { cn } from "../../lib/cn";

type AccentKey = "brand" | "accent" | "success" | "warning";

type Props = {
  agentName: string;
  departmentLabel: string;
  accent: AccentKey;
};

const ACCENT_MAP: Record<AccentKey, { ring: string; pill: string; halo: string; chip: string }> = {
  brand: {
    ring: "ring-brand/20",
    pill: "bg-brand/10 text-brand",
    halo: "from-brand/20 via-brand/5 to-transparent",
    chip: "bg-brand/5 text-brand border-brand/20 hover:bg-brand/10",
  },
  accent: {
    ring: "ring-accent/20",
    pill: "bg-accent/10 text-accent",
    halo: "from-accent/20 via-accent/5 to-transparent",
    chip: "bg-accent/5 text-accent border-accent/20 hover:bg-accent/10",
  },
  success: {
    ring: "ring-emerald-400/20",
    pill: "bg-emerald-500/10 text-emerald-500",
    halo: "from-emerald-400/20 via-emerald-400/5 to-transparent",
    chip: "bg-emerald-500/5 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/10",
  },
  warning: {
    ring: "ring-amber-400/25",
    pill: "bg-amber-500/10 text-amber-500",
    halo: "from-amber-400/25 via-amber-400/5 to-transparent",
    chip: "bg-amber-500/5 text-amber-600 border-amber-500/20 hover:bg-amber-500/10",
  },
};

const AGENT_BLURBS: Record<string, string> = {
  sales: "A senior sales analyst that triages your pipeline, prices deals and drafts outreach.",
  marketing: "A growth marketer that pulls campaign performance and writes next-step copy.",
  finance: "An AR controller that reads invoices, aging and quietly nags slow payers.",
  ops: "An operations lead that watches tickets, shipments and stock positions in real time.",
};

export function DepartmentAgentCard({ agentName, departmentLabel, accent }: Props) {
  const [tools, setTools] = useState<AgentToolInfo[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchAgentTools(agentName)
      .then((res) => {
        if (!alive) return;
        setTools(res.tools);
        setErr(null);
      })
      .catch((e: Error) => {
        if (!alive) return;
        setErr(e.message || "Failed to load agent tools");
      });
    return () => {
      alive = false;
    };
  }, [agentName]);

  // Close on ESC
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  const accentCls = ACCENT_MAP[accent];
  const blurb = AGENT_BLURBS[agentName] ?? "An AI agent with tools for this department.";

  return (
    <>
      <section
        className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:p-5 shadow-sm"
        data-testid={`department-${agentName}-agent-card`}
      >
        <div className={cn("absolute inset-0 bg-gradient-to-br", accentCls.halo)} aria-hidden />
        <div className="relative flex items-center gap-4">
          <div
            className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center ring-4 shadow shrink-0",
              accentCls.ring,
              accentCls.pill
            )}
          >
            <Bot className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-semibold">Agent</p>
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live actions in chat
              </span>
            </div>
            <h3 className="text-base md:text-lg font-display font-semibold text-slate-900 dark:text-white truncate">
              {departmentLabel} Agent
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{blurb}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              data-testid={`department-${agentName}-agent-info-btn`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <Info className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">View capabilities</span>
              <span className="sm:hidden">Info</span>
              {tools ? (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-white dark:bg-slate-900 text-[10px] font-mono">
                  {tools.length}
                </span>
              ) : null}
            </button>
            <Link
              to={`/agent/${agentName}`}
              data-testid={`department-${agentName}-agent-open-link`}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-transform hover:scale-[1.02]",
                accentCls.pill
              )}
            >
              Open chat
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {modalOpen &&
        createPortal(
          <AgentInfoModal
            agentName={agentName}
            departmentLabel={departmentLabel}
            accent={accent}
            blurb={blurb}
            tools={tools}
            err={err}
            onClose={() => setModalOpen(false)}
          />,
          document.body
        )}
    </>
  );
}

function AgentInfoModal({
  agentName,
  departmentLabel,
  accent,
  blurb,
  tools,
  err,
  onClose,
}: {
  agentName: string;
  departmentLabel: string;
  accent: AccentKey;
  blurb: string;
  tools: AgentToolInfo[] | null;
  err: string | null;
  onClose: () => void;
}) {
  const accentCls = ACCENT_MAP[accent];
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-up"
      role="dialog"
      aria-modal="true"
      aria-labelledby="agent-info-title"
      data-testid={`department-${agentName}-agent-modal`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={onClose}
        data-testid={`department-${agentName}-agent-modal-backdrop`}
      />
      {/* Panel */}
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700/60 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn("relative px-6 pt-6 pb-5 bg-gradient-to-br", accentCls.halo)}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-testid={`department-${agentName}-agent-modal-close`}
            className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center ring-4 shadow",
                accentCls.ring,
                accentCls.pill
              )}
            >
              <Bot className="w-6 h-6" />
            </div>
            <div className="min-w-0 pr-8">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-semibold">Agent</p>
              <h2 id="agent-info-title" className="text-xl font-display font-bold text-slate-900 dark:text-white">
                {departmentLabel} Agent
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{blurb}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-semibold flex items-center gap-1.5 mb-2">
              <Wrench className="w-3 h-3" />
              Capabilities
              {tools ? <span className="text-slate-300 dark:text-slate-600">· {tools.length}</span> : null}
            </p>
            {err ? (
              <p className="text-xs text-slate-400">{err}</p>
            ) : !tools ? (
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <span key={i} className="h-6 w-24 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse" />
                ))}
              </div>
            ) : tools.length === 0 ? (
              <p className="text-xs text-slate-400">No tools configured.</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5" data-testid={`department-${agentName}-agent-tools`}>
                {tools.map((t) => (
                  <li key={t.name}>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors",
                        accentCls.chip
                      )}
                      title={t.description || ""}
                    >
                      <Sparkles className="w-3 h-3 opacity-70" />
                      {t.label}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Actions + tool results stream live into the chat
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
              Region-scoped to your access
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
          <Link
            to={`/agent/${agentName}`}
            onClick={onClose}
            data-testid={`department-${agentName}-agent-modal-open`}
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-transform hover:scale-[1.02]",
              accentCls.pill
            )}
          >
            Open chat
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
