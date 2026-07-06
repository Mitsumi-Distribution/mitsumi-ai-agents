import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle, Bell, BellOff, CheckCircle2, ChevronDown, ChevronRight,
  CircleStop, ClipboardCopy, Loader2, Pause, Play, PlayCircle,
  Plus, RotateCcw, XCircle
} from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
import {
  cancelAgentJob, enqueueAgentJob, listAgentJobKinds,
  listAgentJobs, retryAgentJob
} from "../../api/client";
import type { AgentJob, AgentJobStatus } from "../../types";
import { useToast } from "../../store/toast";
import { formatRelative } from "../../lib/format";
import { cn } from "../../lib/cn";

const STATUS_META: Record<AgentJobStatus, { label: string; tone: "info" | "warning" | "success" | "danger" | "neutral"; icon: React.ReactNode }> = {
  pending: { label: "Pending", tone: "neutral", icon: <Loader2 className="w-3.5 h-3.5 animate-spin" /> },
  running: { label: "Running", tone: "info", icon: <Loader2 className="w-3.5 h-3.5 animate-spin" /> },
  succeeded: { label: "Succeeded", tone: "success", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  failed: { label: "Failed", tone: "danger", icon: <AlertCircle className="w-3.5 h-3.5" /> },
  cancelled: { label: "Cancelled", tone: "warning", icon: <XCircle className="w-3.5 h-3.5" /> }
};

const PAGE_SIZE = 10;

/** Strip markdown for plain text */
function stripMd(t: string): string {
  return t.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/^#+\s*/gm, "");
}

/** Render markdown text as clean JSX — handles tables, headings, bold, lists, separators */
function MarkdownOutput({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Empty line
    if (!trimmed) { i++; continue; }

    // Horizontal rule
    if (/^[-_*]{3,}\s*$/.test(trimmed)) {
      elements.push(<hr key={key++} className="border-slate-200 dark:border-slate-700 my-3" />);
      i++; continue;
    }

    // Heading (strip ** inside headings too)
    const hMatch = trimmed.match(/^(#{1,4})\s+(.+)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const text = hMatch[2].replace(/\*\*/g, "");
      elements.push(
        <p key={key++} className={cn(
          "font-display font-semibold text-slate-900 dark:text-white",
          level <= 2 ? "text-sm mt-3 mb-1" : "text-xs mt-2 mb-0.5"
        )}>{text}</p>
      );
      i++; continue;
    }

    // Table: detect header row followed by separator
    if (trimmed.includes("|") && i + 1 < lines.length && /^\|?\s*[-:|]+\s*\|/.test(lines[i + 1]?.trim() || "")) {
      const headers = trimmed.split("|").map(c => c.trim().replace(/\*\*/g, "")).filter(Boolean);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes("|") && !/^\|?\s*[-:|]+\s*\|$/.test(lines[i].trim())) {
        const cells = lines[i].split("|").map(c => c.trim().replace(/\*\*/g, "")).filter(Boolean);
        if (cells.length > 0) rows.push(cells);
        i++;
      }
      elements.push(
        <div key={key++} className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 my-2">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                {headers.map((h, hi) => (
                  <th key={hi} className="px-2.5 py-1.5 text-left font-semibold text-slate-600 dark:text-slate-300">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 1 ? "bg-slate-50 dark:bg-slate-800/30" : ""}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-2.5 py-1.5 text-slate-700 dark:text-slate-300">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Standalone table row (no header) — render as inline
    if (trimmed.startsWith("|") && trimmed.endsWith("|") && /^\|?\s*[-:|]+\s*\|$/.test(trimmed)) {
      i++; continue; // skip separator rows
    }

    // Unordered list
    if (/^[-*]\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i]?.trim() || "")) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, "").replace(/\*\*(.+?)\*\*/g, "$1"));
        i++;
      }
      elements.push(
        <ul key={key++} className="pl-4 space-y-0.5 my-1">
          {items.map((item, ii) => <li key={ii} className="text-xs text-slate-700 dark:text-slate-300 list-disc">{item}</li>)}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i]?.trim() || "")) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, "").replace(/\*\*(.+?)\*\*/g, "$1"));
        i++;
      }
      elements.push(
        <ol key={key++} className="pl-4 space-y-0.5 my-1">
          {items.map((item, ii) => <li key={ii} className="text-xs text-slate-700 dark:text-slate-300 list-decimal">{item}</li>)}
        </ol>
      );
      continue;
    }

    // Regular paragraph — strip markdown, render as text
    const cleaned = trimmed.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/`([^`]+)`/g, "$1");
    elements.push(<p key={key++} className="text-xs text-slate-700 dark:text-slate-300 my-0.5">{cleaned}</p>);
    i++;
  }

  return <div className="space-y-0.5">{elements}</div>;
}

export function AgentJobsPanel() {
  const toast = useToast();
  const [jobs, setJobs] = useState<AgentJob[]>([]);
  const [kinds, setKinds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [enqueueOpen, setEnqueueOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [notifState, setNotifState] = useState<"default" | "granted" | "denied" | "unsupported">("default");
  const pollRef = useRef<number | null>(null);
  const prevStatuses = useRef<Map<string, AgentJobStatus>>(new Map());

  useEffect(() => {
    if (typeof Notification !== "undefined") setNotifState(Notification.permission as any);
    else setNotifState("unsupported");
  }, []);

  async function load() {
    try {
      const [list, k] = await Promise.all([listAgentJobs({ limit: 200 }), listAgentJobKinds()]);
      setJobs(list);
      setKinds(k.kinds);
      list.forEach((j) => prevStatuses.current.set(j.id, j.status));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load agent jobs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    for (const job of jobs) {
      const prev = prevStatuses.current.get(job.id);
      if (prev && prev !== job.status) {
        if (job.status === "succeeded") toast.success(`${job.title} finished`);
        else if (job.status === "failed") toast.error(`${job.title} failed`, job.error ?? "See logs");
      }
      prevStatuses.current.set(job.id, job.status);
    }
  }, [jobs, toast]);

  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === "pending" || j.status === "running");
    if (!hasActive) {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }
    if (pollRef.current) return;
    pollRef.current = window.setInterval(async () => {
      try {
        const fresh = await listAgentJobs({ limit: 200 });
        setJobs(fresh);
      } catch {}
    }, 2000);
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); pollRef.current = null; };
  }, [jobs]);

  const grouped = useMemo(() => ({
    active: jobs.filter((j) => j.status === "pending" || j.status === "running"),
    finished: jobs.filter((j) => j.status !== "pending" && j.status !== "running")
  }), [jobs]);

  const totalPages = Math.ceil(grouped.finished.length / PAGE_SIZE);
  const paginatedFinished = grouped.finished.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-base font-display font-semibold text-slate-900 dark:text-white">Agent Jobs</h2>
          <p className="text-xs text-slate-500">Long-running work queued on the agent worker pool</p>
        </div>
        <div className="flex items-center gap-2">
          {notifState !== "unsupported" && (
            <button type="button" onClick={notifState === "granted" ? undefined : async () => {
              const perm = await Notification.requestPermission();
              setNotifState(perm as any);
            }} data-testid="agent-jobs-notifications-btn"
            className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
              notifState === "granted" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 cursor-default" : "bg-white dark:bg-slate-900 text-slate-600 border-slate-200 dark:border-slate-700 hover:border-brand/40"
            )}>
              {notifState === "granted" ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
              {notifState === "granted" ? "Notifications on" : "Enable"}
            </button>
          )}
          <Button size="sm" onClick={() => setEnqueueOpen(true)} data-testid="agent-jobs-enqueue-btn">
            <Plus className="w-3.5 h-3.5" /> New job
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-white dark:bg-slate-900 py-16 flex items-center justify-center gap-2 text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-brand" /> Loading…
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState icon={<PlayCircle className="w-6 h-6" />} title="No agent jobs yet" description="Create a task with an agent prompt and run it, or click New job." />
      ) : (
        <div className="space-y-5" data-testid="agent-jobs-list">
          {grouped.active.length > 0 && (
            <section className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Active ({grouped.active.length})</p>
              {grouped.active.map((job) => (
                <JobCard key={job.id} job={job} onCancel={async () => {
                  try { const u = await cancelAgentJob(job.id); setJobs((p) => p.map((j) => j.id === job.id ? u : j)); } catch (e: any) { toast.error(e.message); }
                }} onRefresh={load} />
              ))}
            </section>
          )}
          {paginatedFinished.length > 0 && (
            <section className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">History ({grouped.finished.length})</p>
              {paginatedFinished.map((job) => (
                <JobCard key={job.id} job={job}
                  onRetry={job.status === "failed" || job.status === "cancelled" ? async () => {
                    try { const f = await retryAgentJob(job.id); setJobs((p) => [f, ...p]); toast.success("Retry enqueued"); } catch (e: any) { toast.error(e.message); }
                  } : undefined}
                  onRefresh={load}
                />
              ))}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-slate-400">Page {page + 1} of {totalPages}</p>
                  <div className="flex gap-1">
                    <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
                      className="px-3 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800">Prev</button>
                    <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
                      className="px-3 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800">Next</button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {enqueueOpen && (
        <NewJobModal kinds={kinds} onClose={() => setEnqueueOpen(false)} onSubmit={async (payload) => {
          try {
            const job = await enqueueAgentJob(payload);
            setJobs((p) => [job, ...p]);
            setEnqueueOpen(false);
            setPage(0); // jump to first page to see the new job
            toast.success("Job started — tracking progress below");
          } catch (e: any) { toast.error(e.message); }
        }} />
      )}
    </>
  );
}

// ── Job Card ──────────────────────────────────────────────────────────
function JobCard({ job, onCancel, onRetry, onRefresh }: { job: AgentJob; onCancel?: () => void; onRetry?: () => void; onRefresh?: () => void }) {
  const meta = STATUS_META[job.status];
  const active = job.status === "running" || job.status === "pending";
  const succeeded = job.status === "succeeded";
  // Auto-show output for succeeded, logs for failed/active
  const [view, setView] = useState<"output" | "logs">(succeeded ? "output" : "logs");
  const [expanded, setExpanded] = useState(active || succeeded);
  const [copied, setCopied] = useState(false);
  const logs = job.logs ?? [];

  // Auto-switch to output when job succeeds
  useEffect(() => {
    if (succeeded) { setView("output"); setExpanded(true); }
  }, [succeeded]);

  function copyResult() {
    let text = "";
    try {
      const parsed = typeof job.result === "string" ? JSON.parse(job.result) : job.result;
      text = parsed?.preview || (typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2));
    } catch {
      text = typeof job.result === "string" ? job.result : JSON.stringify(job.result, null, 2);
    }
    // Strip markdown for clean clipboard
    text = stripMd(text);
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }

  // Format result nicely
  function renderResult() {
    if (!job.result) return <p className="text-xs text-slate-400 italic">No output</p>;
    let display = "";
    try {
      const parsed = typeof job.result === "string" ? JSON.parse(job.result) : job.result;
      if (parsed.preview) display = parsed.preview;
      else if (typeof parsed === "string") display = parsed;
      else display = JSON.stringify(parsed, null, 2);
    } catch {
      display = typeof job.result === "string" ? job.result : JSON.stringify(job.result, null, 2);
    }
    return <MarkdownOutput text={display} />;
  }

  return (
    <div data-testid={`agent-job-${job.id}`} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{job.title}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge tone={meta.tone} className="capitalize inline-flex items-center gap-1">{meta.icon}{meta.label}</Badge>
              <Badge tone="neutral" className="font-mono text-[10px]">{job.kind}</Badge>
              {job.department && <Badge tone="brand" className="capitalize">{job.department}</Badge>}
              <span className="text-[11px] font-mono text-slate-400">{formatRelative(job.created_at)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {active && onCancel && (
              <button type="button" onClick={onCancel} data-testid={`agent-job-cancel-${job.id}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-danger hover:bg-danger/10 px-2 py-1 rounded-lg transition-colors">
                <CircleStop className="w-3.5 h-3.5" /> Stop
              </button>
            )}
            {onRetry && (
              <button type="button" onClick={onRetry} data-testid={`agent-job-retry-${job.id}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:bg-brand/10 px-2 py-1 rounded-lg transition-colors">
                <RotateCcw className="w-3.5 h-3.5" /> Retry
              </button>
            )}
            {succeeded && job.result && (
              <button type="button" onClick={copyResult} data-testid={`agent-job-copy-${job.id}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded-lg transition-colors">
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div className={cn("h-full transition-all duration-500",
            job.status === "failed" ? "bg-danger" : job.status === "cancelled" ? "bg-amber-400" : job.status === "succeeded" ? "bg-emerald-500" : "bg-brand"
          )} style={{ width: `${job.progress}%` }} />
        </div>
        <div className="flex items-center justify-between mt-1.5 text-[11px] text-slate-400 font-mono">
          <span>{job.progress}%</span>
          {job.finished_at && <span>finished {formatRelative(job.finished_at)}</span>}
        </div>

        {/* Expandable section with tabs */}
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setExpanded((v) => !v)} data-testid={`agent-job-toggle-${job.id}`}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand transition-colors">
              {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              {expanded ? "Hide details" : "Show details"}
            </button>
            {expanded && (succeeded || logs.length > 0) && (
              <div className="flex gap-1 ml-2">
                {succeeded && (
                  <button onClick={() => setView("output")} data-testid={`agent-job-tab-output-${job.id}`}
                    className={cn("text-[10px] px-2 py-0.5 rounded-md font-semibold transition-colors",
                      view === "output" ? "bg-brand/10 text-brand" : "text-slate-400 hover:text-slate-600")}>
                    Output
                  </button>
                )}
                {logs.length > 0 && (
                  <button onClick={() => setView("logs")} data-testid={`agent-job-tab-logs-${job.id}`}
                    className={cn("text-[10px] px-2 py-0.5 rounded-md font-semibold transition-colors",
                      view === "logs" ? "bg-brand/10 text-brand" : "text-slate-400 hover:text-slate-600")}>
                    Logs ({logs.length})
                  </button>
                )}
              </div>
            )}
          </div>

          {expanded && (
            <div className="mt-2">
              {view === "output" && succeeded && (
                <div className="bg-slate-50 dark:bg-slate-950/60 rounded-xl p-4 max-h-64 overflow-y-auto" data-testid={`agent-job-output-${job.id}`}>
                  {renderResult()}
                </div>
              )}
              {view === "logs" && logs.length > 0 && (
                <ol className="relative space-y-1.5 pl-4 border-l border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto" data-testid={`agent-job-timeline-${job.id}`}>
                  {logs.slice(-20).map((line, i) => (
                    <li key={i} className="relative text-[11px] text-slate-500">
                      <span className="absolute -left-[7px] top-1.5 w-2.5 h-2.5 rounded-full bg-brand border-2 border-white dark:border-slate-900" />
                      <span className="font-mono text-slate-400">{new Date(line.at).toLocaleTimeString("en-GB", { timeZone: "Africa/Nairobi", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}</span>
                      <span className="ml-2 text-slate-600 dark:text-slate-300">{line.message}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>

        {job.error && (
          <p className="mt-3 text-xs text-danger font-mono bg-danger/5 rounded-xl px-3 py-2">{job.error}</p>
        )}
      </div>
    </div>
  );
}

// ── New Job Modal ──────────────────────────────────────
const PROMPT_TEMPLATES: Record<string, { label: string; prompt: string }[]> = {
  sales: [
    { label: "Pipeline report", prompt: "Generate a full pipeline report with deal values by stage, top deals, and recommendations. Generate a PDF report." },
    { label: "Customer analysis", prompt: "Run a 360-degree analysis on our Kenya customers — deals, invoices, tickets. Export as Excel." },
    { label: "Email pipeline update", prompt: "Draft and send a pipeline update email to francis@mitsumidistribution.com with current pipeline stats." },
  ],
  marketing: [
    { label: "Campaign ROI report", prompt: "Calculate ROI for all active campaigns, rank by performance, and generate a PDF report." },
    { label: "Email campaign blast", prompt: "Draft a product launch email about Fortinet security solutions and send to francis@mitsumidistribution.com." },
  ],
  finance: [
    { label: "AR aging report", prompt: "Generate a full AR aging report with overdue accounts and collection priorities. Create PDF and email to francis@mitsumidistribution.com." },
    { label: "Invoice export", prompt: "Export all outstanding invoices to Excel with customer names, amounts, and days overdue." },
  ],
  ops: [
    { label: "Ticket summary", prompt: "Summarize all P1/critical tickets with customer names and SLA status. Generate a PDF report." },
    { label: "Stock alert report", prompt: "Generate a low stock alert report with SKUs below reorder point. Export as Excel." },
  ],
};

function NewJobModal({ kinds, onClose, onSubmit }: {
  kinds: string[];
  onClose: () => void;
  onSubmit: (payload: { kind: string; title: string; department?: string | null; params?: Record<string, unknown> }) => Promise<void>;
}) {
  const [kind, setKind] = useState("run_agent_prompt");
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("sales");
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isAgentPrompt = kind === "run_agent_prompt";
  const isDeptReport = kind === "department_report";
  const templates = PROMPT_TEMPLATES[department] || [];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const finalTitle = title.trim() || (isAgentPrompt ? `Agent: ${prompt.slice(0, 40)}…` : isDeptReport ? `${department} Report` : kind);
    const params: Record<string, unknown> = {};
    if (isAgentPrompt) {
      params.agent_name = department;
      params.agent_prompt = prompt;
      params.department = department;
    } else if (isDeptReport) {
      params.department = department;
    } else if (kind === "bulk_email") {
      params.subject = title || "Mitsumi update";
      params.body = prompt || "Hi team,";
      params.region = "africa";
    } else if (kind === "demo_echo") {
      params.steps = 5;
      params.message = prompt || "hello";
    }
    setSubmitting(true);
    await onSubmit({ kind, title: finalTitle, department: department || null, params });
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog">
      <button type="button" className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSubmit} data-testid="agent-job-enqueue-modal"
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-4 animate-fade-up">
        <h3 className="text-base font-display font-semibold text-slate-900 dark:text-white">New Agent Job</h3>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Job Type</span>
            <select value={kind} onChange={(e) => setKind(e.target.value)} data-testid="agent-job-kind-select"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm">
              <option value="run_agent_prompt">Run Agent Prompt</option>
              <option value="department_report">Department Report</option>
              <option value="bulk_email">Bulk Email</option>
              <option value="demo_echo">Demo Echo</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Department</span>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} data-testid="agent-job-department-select"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm">
              <option value="sales">Sales</option>
              <option value="marketing">Marketing</option>
              <option value="finance">Finance</option>
              <option value="ops">Operations</option>
            </select>
          </label>
        </div>

        <label className="space-y-1 block">
          <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isAgentPrompt ? "e.g. Kenya pipeline review" : isDeptReport ? "e.g. Sales Report" : "Job title"}
            data-testid="agent-job-title-input" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm" />
        </label>

        {isAgentPrompt && templates.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Quick Templates</span>
            <div className="flex flex-wrap gap-1.5">
              {templates.map((t, i) => (
                <button key={i} type="button" onClick={() => { setPrompt(t.prompt); if (!title) setTitle(t.label); }}
                  data-testid={`job-template-${i}`}
                  className="text-[11px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-brand/40 hover:text-brand transition-colors">
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {(isAgentPrompt || kind === "bulk_email") && (
          <label className="space-y-1 block">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              {isAgentPrompt ? "Agent Prompt" : "Email Body"}
            </span>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4}
              placeholder={isAgentPrompt ? "e.g. Summarize the Kenya sales pipeline with deal values and recommendations" : "Email content…"}
              data-testid="agent-job-prompt-textarea"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm resize-none" />
          </label>
        )}

        <footer className="flex items-center justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" disabled={submitting || (isAgentPrompt && !prompt.trim())} data-testid="agent-job-submit-btn">
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
            Start Job
          </Button>
        </footer>
      </form>
    </div>
  );
}
