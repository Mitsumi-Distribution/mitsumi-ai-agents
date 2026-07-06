import { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral" | "brand";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  dot?: boolean;
  pulse?: boolean;
  icon?: ReactNode;
};

const toneMap: Record<BadgeTone, string> = {
  success:
    "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  warning:
    "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-400/10 dark:text-amber-400 dark:border-amber-400/20",
  danger:
    "bg-danger/10 text-danger border border-danger/20",
  info:
    "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
  neutral:
    "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
  brand:
    "bg-brand-subtle text-brand border border-brand/20 dark:bg-brand-glow dark:border-brand/30"
};

const dotMap: Record<BadgeTone, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-danger",
  info: "bg-blue-500",
  neutral: "bg-slate-400",
  brand: "bg-brand"
};

export function Badge({
  tone = "neutral",
  dot = false,
  pulse = false,
  icon,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap",
        toneMap[tone],
        className
      )}
      {...rest}
    >
      {dot && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            dotMap[tone],
            pulse && "animate-pulse"
          )}
        />
      )}
      {icon}
      {children}
    </span>
  );
}
