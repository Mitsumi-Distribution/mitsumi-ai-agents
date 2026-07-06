import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "theme";

function getSystemResolved(): "light" | "dark" {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStored(): Theme {
  if (typeof localStorage === "undefined") return "system";
  const v = localStorage.getItem(THEME_STORAGE_KEY);
  if (v === "dark" || v === "light" || v === "system") return v;
  return "system";
}

function resolveTheme(theme: Theme): "light" | "dark" {
  return theme === "system" ? getSystemResolved() : theme;
}

function applyToDocument(theme: Theme) {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(theme);
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readStored);

  const applyTheme = useCallback((next: Theme, persist = true) => {
    applyToDocument(next);
    if (persist) {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        /* noop */
      }
    }
    setThemeState(next);
  }, []);

  // Re-apply on first mount so SSR defaults get corrected.
  useEffect(() => {
    applyToDocument(theme);
  }, [theme]);

  // React to OS theme changes when in "system" mode.
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyToDocument("system");
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [theme]);

  // Cross-tab sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && (e.newValue === "dark" || e.newValue === "light" || e.newValue === "system")) {
        applyTheme(e.newValue, false);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [applyTheme]);

  const toggleTheme = useCallback(() => {
    applyTheme(resolveTheme(theme) === "dark" ? "light" : "dark");
  }, [applyTheme, theme]);

  return { theme, resolved: resolveTheme(theme), toggleTheme, setTheme: applyTheme };
}
