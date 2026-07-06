import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Bot,
  CheckCircle2,
  Circle,
  ListTodo,
  Loader2,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Wrench,
  X
} from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import {
  createTask,
  deleteTask,
  fetchAgentTools,
  listTasks,
  runTaskWithAgent,
  updateTask
} from "../api/client";
import type { AgentToolInfo, TaskRecord } from "../types";
import { useToast } from "../store/toast";
import { canAccessModule, useSessionStore } from "../store/session";
import { cn } from "../lib/cn";
import { AgentJobsPanel } from "../components/tasks/AgentJobsPanel";
import { friendlyToolLabel } from "../lib/toolLabels";

const STATUSES: TaskRecord["status"][] = ["todo", "in_progress", "done"];

const PRIORITY_TONE: Record<string, "danger" | "warning" | "info" | "neutral"> = {
  critical: "danger",
  high: "warning",
  medium: "info",
  low: "neutral"
};

const DEPARTMENTS = ["sales", "marketing", "finance", "ops"];

export function TaskView() {
  const toast = useToast();
  const user = useSessionStore((s) => s.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | TaskRecord["status"]>("all");
  const [tab, setTab] = useState<"manual" | "agent">("manual");
  const [composer, setComposer] = useState<{ open: boolean; department: string; nonce: number }>({
    open: false,
    department: "",
    nonce: 0
  });

  const openComposer = (dept = "") => {
    setComposer((s) => ({ open: true, department: dept, nonce: s.nonce + 1 }));
  };
  const closeComposer = () => setComposer((s) => ({ ...s, open: false }));

  // Auto-open composer on ?new=1 (e.g. deep-link from a department page).
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      const dept = searchParams.get("department") ?? "";
      openComposer(dept);
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      next.delete("department");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const allowedDepartments = useMemo(() => {
    if (!user) return [] as string[];
    if (user.is_super_admin) return DEPARTMENTS;
    return DEPARTMENTS.filter((d) => canAccessModule(user, `department:${d}`));
  }, [user]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const rows = await listTasks();
      setTasks(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const g: Record<string, TaskRecord[]> = { todo: [], in_progress: [], done: [] };
    for (const t of tasks) {
      (g[t.status] ?? g.todo).push(t);
    }
    return g;
  }, [tasks]);

  const counts = {
    all: tasks.length,
    todo: grouped.todo.length,
    in_progress: grouped.in_progress.length,
    done: grouped.done.length
  };

  async function onToggle(task: TaskRecord) {
    const next: TaskRecord["status"] = task.status === "done" ? "todo" : task.status === "todo" ? "in_progress" : "done";
    try {
      const updated = await updateTask(task.id, { status: next });
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function onDelete(task: TaskRecord) {
    try {
      await deleteTask(task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      toast.success("Task removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function onRunAgent(task: TaskRecord) {
    try {
      const { task: updated } = await runTaskWithAgent(task.id);
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      toast.success("Agent run started");
      setTab("jobs");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Run failed");
    }
  }

  const visible = filter === "all" ? tasks : grouped[filter] ?? [];

  return (
    <>
      <TopBar
        title="Tasks"
        subtitle={`${counts.all} task${counts.all !== 1 ? "s" : ""} · ${tab === "jobs" ? "agent jobs" : "task list"}`}
        actions={
          <div className="flex items-center gap-2">
            {tab === "tasks" && (
              <Button size="sm" onClick={() => openComposer("")} data-testid="tasks-new-open-btn">
                <Plus className="w-3.5 h-3.5" /> New task
              </Button>
            )}
          </div>
        }
      />
      <div className="flex-1 flex justify-center">
        <div className="w-full max-w-5xl px-4 md:px-10 py-6 md:py-8 space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            <TabButton active={tab === "tasks"} onClick={() => setTab("tasks")} testId="tasks-tab-tasks" icon={<ListTodo className="w-3.5 h-3.5" />}>
              Tasks
            </TabButton>
            <TabButton active={tab === "jobs"} onClick={() => setTab("jobs")} testId="tasks-tab-agent" icon={<Bot className="w-3.5 h-3.5" />}>
              Agent Jobs
            </TabButton>
          </div>

          {tab === "jobs" ? (
            <AgentJobsPanel />
          ) : (
            <>
              {allowedDepartments.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] uppercase tracking-widest text-slate-400">Quick create</span>
                  {allowedDepartments.map((dept) => (
                    <button
                      key={dept}
                      type="button"
                      data-testid={`tasks-quick-${dept}`}
                      onClick={() => openComposer(dept)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-brand/40 hover:text-brand transition-colors capitalize"
                    >
                      <Sparkles className="w-3 h-3" />
                      {dept}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 overflow-x-auto">
                <FilterChip current={filter} value="all" count={counts.all} onClick={() => setFilter("all")} label="All" />
                {STATUSES.map((s) => (
                  <FilterChip
                    key={s}
                    current={filter}
                    value={s}
                    count={counts[s]}
                    onClick={() => setFilter(s)}
                    label={s === "in_progress" ? "In progress" : s === "todo" ? "To do" : "Done"}
                  />
                ))}
              </div>

              {loading ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-16 flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin text-brand" /> Loading tasks…
                </div>
              ) : error ? (
                <EmptyState icon={<Trash2 className="w-6 h-6" />} title="Couldn't load tasks" description={error} />
              ) : visible.length === 0 ? (
                <EmptyState title="No tasks yet" description="Create your first task above to start tracking work." />
              ) : (
                <ul className="space-y-2" data-testid="tasks-list">
                  {visible.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onToggle={() => onToggle(task)}
                      onDelete={() => onDelete(task)}
                      onRunAgent={() => onRunAgent(task)}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

      {composer.open && (
        <TaskComposerModal
          key={composer.nonce}
          allowedDepartments={allowedDepartments}
          initialDepartment={composer.department}
          onClose={closeComposer}
          onSubmit={async (payload) => {
            try {
              const task = await createTask(payload);
              setTasks((prev) => [task, ...prev]);
              toast.success("Task created");
              closeComposer();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Create failed");
            }
          }}
        />
      )}
    </>
  );
}

function TaskRow({
  task,
  onToggle,
  onDelete,
  onRunAgent
}: {
  task: TaskRecord;
  onToggle: () => void;
  onDelete: () => void;
  onRunAgent: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasAgentContext =
    Boolean((task.agent_prompt && task.agent_prompt.length > 0) || (task.tools && task.tools.length > 0)) ||
    Boolean(task.agent_result);
  return (
    <li
      data-testid={`task-row-${task.id}`}
      className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl px-4 py-3 flex items-start gap-3 hover:shadow-md transition-shadow"
    >
      <button
        type="button"
        aria-label="Toggle"
        onClick={onToggle}
        data-testid={`task-toggle-${task.id}`}
        className={cn(
          "mt-0.5 w-6 h-6 rounded-full flex items-center justify-center transition-colors",
          task.status === "done"
            ? "bg-emerald-500 text-white"
            : task.status === "in_progress"
              ? "bg-brand text-white"
              : "border border-slate-300 dark:border-slate-600 text-slate-300"
        )}
      >
        {task.status === "done" ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : task.status === "in_progress" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Circle className="w-4 h-4 opacity-0 group-hover:opacity-100" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-medium text-slate-800 dark:text-slate-100 truncate",
            task.status === "done" && "line-through text-slate-400"
          )}
        >
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <Badge tone={PRIORITY_TONE[task.priority] ?? "neutral"} className="uppercase">
            {task.priority}
          </Badge>
          {task.department && (
            <Badge tone="brand" className="capitalize">
              {task.department}
            </Badge>
          )}
          {task.tools && task.tools.length > 0 && (
            <Badge tone="info" className="inline-flex items-center gap-1">
              <Wrench className="w-2.5 h-2.5" />
              {task.tools.length} tool{task.tools.length === 1 ? "" : "s"}
            </Badge>
          )}
          <span className="text-[11px] text-slate-400 font-mono">{new Date(task.created_at).toLocaleDateString()}</span>
          {hasAgentContext && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              data-testid={`task-expand-${task.id}`}
              className="text-[11px] text-brand hover:underline font-semibold"
            >
              {open ? "Hide" : "Show"} agent context
            </button>
          )}
        </div>
        {open && hasAgentContext && (
          <div
            className="mt-2 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 p-3 space-y-2"
            data-testid={`task-agent-context-${task.id}`}
          >
            {task.agent_prompt && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Agent prompt</p>
                <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{task.agent_prompt}</p>
              </div>
            )}
            {task.tools && task.tools.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Tools</p>
                <div className="flex flex-wrap gap-1">
                  {task.tools.map((t) => (
                    <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-brand/10 text-brand">{friendlyToolLabel(t)}</span>
                  ))}
                </div>
              </div>
            )}
            {task.agent_result && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Agent result</p>
                <pre className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg p-2 max-h-56 overflow-auto">{task.agent_result}</pre>
              </div>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        data-testid={`task-delete-${task.id}`}
        className="w-8 h-8 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/10 transition-colors flex items-center justify-center"
        aria-label="Delete"
      >
        <Trash2 className="w-4 h-4" />
      </button>
      {task.agent_prompt && (
        <button
          type="button"
          onClick={onRunAgent}
          data-testid={`task-run-agent-${task.id}`}
          title="Run this task with the agent"
          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-semibold text-brand bg-brand/10 hover:bg-brand/20 transition-colors"
          aria-label="Run with agent"
        >
          <Play className="w-3.5 h-3.5" />
          Run
        </button>
      )}
    </li>
  );
}

function TaskComposerModal({
  allowedDepartments,
  initialDepartment,
  onClose,
  onSubmit
}: {
  allowedDepartments: string[];
  initialDepartment?: string;
  onClose: () => void;
  onSubmit: (payload: { title: string; priority: string; department?: string; agent_prompt?: string; tools?: string[] }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [department, setDepartment] = useState(initialDepartment || "");
  const [agentPrompt, setAgentPrompt] = useState("");
  const [pickedTools, setPickedTools] = useState<string[]>([]);
  const [tools, setTools] = useState<AgentToolInfo[]>([]);
  const [toolPickerOpen, setToolPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Keep the select in sync when the prop changes (e.g. different chip clicked).
  useEffect(() => {
    setDepartment(initialDepartment || "");
  }, [initialDepartment]);

  useEffect(() => {
    if (!department) {
      setTools([]);
      setPickedTools([]);
      return;
    }
    fetchAgentTools(department)
      .then((r) => setTools(r.tools))
      .catch(() => setTools([]));
    setPickedTools([]);
  }, [department]);

  function toggleTool(name: string) {
    setPickedTools((prev) => (prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    await onSubmit({
      title: title.trim(),
      priority,
      department: department || undefined,
      agent_prompt: agentPrompt.trim() || undefined,
      tools: pickedTools.length > 0 ? pickedTools : undefined
    });
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <form
        onSubmit={handleSubmit}
        data-testid="tasks-composer-modal"
        className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-5 md:p-6 space-y-4 animate-fade-up"
      >
        <header className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-display font-semibold text-slate-900 dark:text-white">New task</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Scoped to your role and department access</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </header>

        <label className="space-y-1 block">
          <span className="text-xs uppercase tracking-wider text-slate-400">Title</span>
          <input
            required
            data-testid="tasks-composer-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to get done?"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-wider text-slate-400">Priority</span>
            <select
              data-testid="tasks-composer-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-wider text-slate-400">Department</span>
            <select
              data-testid="tasks-composer-department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm"
            >
              <option value="">General (no dept)</option>
              {allowedDepartments.map((d) => (
                <option key={d} value={d} className="capitalize">{d}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-slate-400">
              Agent prompt {department && <span className="normal-case text-slate-400 italic">(for {department} agent)</span>}
            </span>
            {department && (
              <div className="relative">
                <button
                  type="button"
                  data-testid="tasks-composer-add-tool-btn"
                  onClick={() => setToolPickerOpen((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                >
                  <Plus className="w-3 h-3" />
                  Add tool
                </button>
                {toolPickerOpen && (
                  <ToolPopover
                    tools={tools}
                    picked={pickedTools}
                    onToggle={toggleTool}
                    onClose={() => setToolPickerOpen(false)}
                  />
                )}
              </div>
            )}
          </div>
          <textarea
            data-testid="tasks-composer-prompt"
            value={agentPrompt}
            onChange={(e) => setAgentPrompt(e.target.value)}
            rows={4}
            placeholder={
              department
                ? `Instruct the ${department} agent… e.g. "Summarise overdue invoices over $10k, draft a follow-up email."`
                : "Optional — pick a department first to enable agent tools"
            }
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm resize-y"
          />
          {pickedTools.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1" data-testid="tasks-composer-picked-tools">
              {pickedTools.map((name) => {
                const label = tools.find((t) => t.name === name)?.label || name;
                return (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleTool(name)}
                  data-testid={`tasks-composer-picked-tool-${name}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20"
                >
                  <Wrench className="w-3 h-3" />
                  {label}
                  <X className="w-3 h-3" />
                </button>
                );
              })}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 pt-1">
          <Button variant="secondary" size="sm" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" disabled={submitting || !title.trim()} data-testid="tasks-composer-submit">
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Create task
          </Button>
        </footer>
      </form>
    </div>
  );
}

function ToolPopover({
  tools,
  picked,
  onToggle,
  onClose
}: {
  tools: AgentToolInfo[];
  picked: string[];
  onToggle: (name: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-[90]" onClick={onClose} aria-hidden />
      <div
        className="absolute right-0 top-6 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-[100] overflow-hidden"
        data-testid="tasks-composer-tool-popover"
      >
        <div className="max-h-72 overflow-y-auto py-1">
          {tools.length === 0 ? (
            <p className="px-3 py-6 text-xs text-slate-400 text-center">No tools available</p>
          ) : (
            tools.map((tool) => {
              const active = picked.includes(tool.name);
              return (
                <button
                  key={tool.name}
                  type="button"
                  onClick={() => onToggle(tool.name)}
                  data-testid={`tasks-composer-tool-${tool.name}`}
                  className={cn(
                    "w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-start gap-2 transition-colors",
                    active && "bg-brand/5"
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 w-6 h-6 rounded-md shrink-0 flex items-center justify-center",
                      active ? "bg-brand text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                    )}
                  >
                    <Wrench className="w-3 h-3" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{tool.label || tool.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{tool.description}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
  icon,
  testId
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-colors",
        active
          ? "bg-brand-subtle dark:bg-brand-glow text-brand"
          : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function FilterChip({
  current,
  value,
  count,
  onClick,
  label
}: {
  current: string;
  value: string;
  count: number;
  onClick: () => void;
  label: string;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`tasks-filter-${value}`}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border",
        active
          ? "bg-brand text-white border-brand"
          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand/40"
      )}
    >
      {label} · {count}
    </button>
  );
}
