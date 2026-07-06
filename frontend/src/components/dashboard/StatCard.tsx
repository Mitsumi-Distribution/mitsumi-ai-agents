import { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "../../lib/cn";

type Props = {
  label: string;
  value: string;
  icon: ReactNode;
  delta?: number;
  deltaLabel?: string;
  accent?: "brand" | "accent" | "success" | "warning";
  className?: string;
};

const accentMap: Record<NonNullable<Props["accent"]>, { bg: string; fg: string }> = {
  brand: { bg: "bg-brand-subtle dark:bg-brand-glow", fg: "text-brand" },
  accent: { bg: "bg-accent/10 dark:bg-accent/15", fg: "text-accent" },
  success: { bg: "bg-emerald-50 dark:bg-emerald-500/10", fg: "text-emerald-500" },
  warning: { bg: "bg-amber-50 dark:bg-amber-400/10", fg: "text-amber-500" }
};

export function StatCard({ label, value, icon, delta, deltaLabel, accent = "brand", className }: Props) {
  const tone = accentMap[accent];
  const isPositive = delta != null && delta >= 0;
  return (
    <div
      className={cn(
        "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-6 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow duration-200 animate-fade-up",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-body font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest">
          {label}
        </span>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", tone.bg, tone.fg)}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-display font-bold text-slate-900 dark:text-white tabular-nums">
        {value}
      </p>
      {delta != null && (
        <p
          className={cn(
            "text-xs font-body flex items-center gap-1",
            isPositive ? "text-emerald-500" : "text-danger"
          )}
        >
          {isPositive ? (
            <ArrowUpRight className="w-3 h-3" />
          ) : (
            <ArrowDownRight className="w-3 h-3" />
          )}
          {Math.abs(delta).toFixed(1)}%
          {deltaLabel && <span className="text-slate-400">{deltaLabel}</span>}
        </p>
      )}
    </div>
  );
}
