import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { ReactNode } from "react";
import { Toast, ToastTone, useToastStore } from "../../store/toast";
import { cn } from "../../lib/cn";

const iconMap: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 className="w-4 h-4" />,
  error: <XCircle className="w-4 h-4" />,
  info: <Info className="w-4 h-4" />,
  warning: <AlertTriangle className="w-4 h-4" />
};

const toneMap: Record<ToastTone, { iconBg: string; iconText: string; border: string }> = {
  success: {
    iconBg: "bg-emerald-50 dark:bg-emerald-500/10",
    iconText: "text-emerald-500",
    border: "border-slate-200 dark:border-slate-700"
  },
  error: {
    iconBg: "bg-danger/10",
    iconText: "text-danger",
    border: "border-danger/20"
  },
  info: {
    iconBg: "bg-blue-50 dark:bg-blue-500/10",
    iconText: "text-blue-500",
    border: "border-slate-200 dark:border-slate-700"
  },
  warning: {
    iconBg: "bg-amber-50 dark:bg-amber-400/10",
    iconText: "text-amber-500",
    border: "border-slate-200 dark:border-slate-700"
  }
};

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const tone = toneMap[toast.tone];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-3 px-4 py-3 bg-white dark:bg-slate-900 border rounded-2xl shadow-xl shadow-slate-200/60 dark:shadow-slate-950/60 min-w-72 max-w-sm animate-slide-in-right",
        tone.border
      )}
    >
      <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", tone.iconBg, tone.iconText)}>
        {iconMap[toast.tone]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 dark:text-white">{toast.title}</p>
        {toast.description && (
          <p className="text-xs text-slate-500 mt-0.5">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label="Dismiss notification"
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} />
        </div>
      ))}
    </div>
  );
}
