import { Menu } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Toaster } from "../ui/Toaster";

type ShellCtx = {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
};

const ShellContext = createContext<ShellCtx>({ mobileOpen: false, setMobileOpen: () => {} });

export function useAppShell() {
  return useContext(ShellContext);
}

type Props = { children: ReactNode };

export function AppShell({ children }: Props) {
  const [mobileOpen, setMobileOpenState] = useState(false);
  const location = useLocation();

  const setMobileOpen = useCallback((open: boolean) => setMobileOpenState(open), []);

  // Close drawer on route change
  useEffect(() => {
    setMobileOpenState(false);
  }, [location.pathname]);

  // Prevent background scroll while drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [mobileOpen]);

  const value = useMemo(() => ({ mobileOpen, setMobileOpen }), [mobileOpen, setMobileOpen]);

  return (
    <ShellContext.Provider value={value}>
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex font-body text-slate-800 dark:text-slate-200">
        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 lg:hidden"
            role="dialog"
            aria-modal="true"
            data-testid="mobile-sidebar-drawer"
          >
            <button
              type="button"
              aria-label="Close navigation"
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
              data-testid="mobile-sidebar-overlay"
            />
            <div className="relative h-full w-[min(18rem,80vw)] shadow-2xl animate-slide-in-left">
              <Sidebar onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        <main className="flex-1 min-w-0 flex flex-col">
          <MobileTopButton />
          {children}
        </main>
        <Toaster />
      </div>
    </ShellContext.Provider>
  );
}

function MobileTopButton() {
  const { setMobileOpen } = useAppShell();
  return (
    <button
      type="button"
      data-testid="mobile-menu-btn"
      onClick={() => setMobileOpen(true)}
      className="lg:hidden fixed top-3 left-3 z-30 w-10 h-10 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-lg shadow-slate-300/30 dark:shadow-slate-950/40 backdrop-blur"
      aria-label="Open navigation"
    >
      <Menu className="w-5 h-5 text-slate-700 dark:text-slate-200" />
    </button>
  );
}
