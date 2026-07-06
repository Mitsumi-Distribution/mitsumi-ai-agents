import { Search } from "lucide-react";
import { ReactNode } from "react";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

function formatDate(date: Date): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
  return `${fmt.format(date)} · EAT`;
}

export function TopBar({ title, subtitle, actions }: Props) {
  return (
    <header className="sticky top-0 z-10 bg-slate-100/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60">
      <div className="max-w-7xl mx-auto px-4 md:px-10 py-3 md:py-4 flex items-center justify-between gap-3 pl-14 lg:pl-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-base md:text-xl font-display font-semibold text-slate-900 dark:text-white truncate">
            {title}
          </h1>
          <p className="text-[11px] md:text-xs text-slate-400 font-mono mt-0.5 truncate">
            {subtitle ?? formatDate(new Date())}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {actions}
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-500 dark:text-slate-400 min-w-[220px]">
            <Search className="w-4 h-4" />
            <input
              type="search"
              placeholder="Search sessions, tasks…"
              className="bg-transparent outline-none text-sm flex-1 placeholder:text-slate-400 text-slate-800 dark:text-slate-100"
            />
            <kbd className="hidden xl:inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700">
              ⌘K
            </kbd>
          </div>
          <NotificationBell />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
