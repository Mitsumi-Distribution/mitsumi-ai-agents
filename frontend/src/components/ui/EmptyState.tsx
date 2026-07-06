import { ReactNode } from "react";
import { cn } from "../../lib/cn";

type Props = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, action, className }: Props) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-20 px-8 text-center", className)}>
      <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-3xl text-slate-500 dark:text-slate-400 mb-5">
        {icon ?? "✨"}
      </div>
      <h3 className="text-lg font-display font-semibold text-slate-800 dark:text-white">{title}</h3>
      {description && (
        <p className="text-sm font-body text-slate-500 mt-2 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
