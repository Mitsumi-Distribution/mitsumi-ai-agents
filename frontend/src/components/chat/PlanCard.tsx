import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { cn } from "../../lib/cn";

type PlanToolCall = { name?: string; args?: Record<string, unknown> };
type Props = { content: string; toolCalls?: PlanToolCall[]; defaultOpen?: boolean };

export function PlanCard({ content, toolCalls, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const firstLine = content.split("\n").find((l) => l.trim().length > 0) ?? "Planning";
  const preview = firstLine.length > 100 ? firstLine.slice(0, 97) + "…" : firstLine;
  const tools = (toolCalls || []).map((c) => c.name).filter(Boolean);

  return (
    <div data-testid="agent-chat-plan-card"
      className="rounded-xl border border-amber-500/15 bg-amber-500/[0.03] dark:bg-amber-500/[0.04] animate-fade-up overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        data-testid="agent-chat-plan-toggle"
        className="w-full flex items-center gap-2 px-3 py-2 text-left group">
        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
            {tools.length > 0 ? `Planning → ${tools.join(", ")}` : "Thinking…"}
          </span>
          {!open && <span className="text-[11px] text-amber-700/50 dark:text-amber-400/50 ml-2 truncate">{preview}</span>}
        </div>
        <ChevronDown className={cn("w-3.5 h-3.5 text-amber-500/50 transition-transform", !open && "-rotate-90")} />
      </button>
      {open && (
        <div data-testid="agent-chat-plan-body"
          className="px-3 pb-2.5 text-xs text-amber-900/70 dark:text-amber-200/60 whitespace-pre-wrap break-words border-t border-amber-500/10">
          <div className="pt-2">{content}</div>
        </div>
      )}
    </div>
  );
}
