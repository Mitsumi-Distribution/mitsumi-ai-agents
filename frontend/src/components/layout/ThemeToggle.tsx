import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { persistThemeToServer } from "../../hooks/persistTheme";

export function ThemeToggle() {
  const { resolved, setTheme } = useTheme();
  const isDark = resolved === "dark";
  function handleToggle() {
    const next = isDark ? "light" : "dark";
    setTheme(next);
    persistThemeToServer(next);
  }
  return (
    <button
      type="button"
      onClick={handleToggle}
      data-testid="topbar-theme-toggle"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:focus-visible:ring-offset-slate-950"
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
