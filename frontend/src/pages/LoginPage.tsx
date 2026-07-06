import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  Eye,
  EyeOff,
  Loader2,
  Lock
} from "lucide-react";
import { directLogin, fetchMe } from "../api/client";
import { useSessionStore } from "../store/session";

export function LoginPage() {
  const token = useSessionStore((s) => s.token);
  const user = useSessionStore((s) => s.user);
  const setToken = useSessionStore((s) => s.setToken);
  const setUser = useSessionStore((s) => s.setUser);

  const [email, setEmail] = useState(import.meta.env.VITE_DEV_AUTO_LOGIN_EMAIL ?? "");
  const [password, setPassword] = useState(import.meta.env.VITE_DEV_AUTO_LOGIN_PASSWORD ?? "");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [status, setStatus] = useState<"idle" | "loading" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);

  if (token && user) return <Navigate to="/" replace />;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setError(null);
    try {
      const res = await directLogin(email, password);
      setToken(res.access_token);
      if (res.user) {
        setUser(res.user);
      } else {
        const me = await fetchMe();
        setUser(me);
      }
      setStatus("idle");
    } catch (err) {
      setStatus("failed");
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <div className="min-h-screen w-screen flex bg-white dark:bg-slate-950 overflow-hidden">
      {/* Left: form */}
      <section className="relative flex-1 flex flex-col justify-between px-6 md:px-14 lg:px-24 py-8 bg-white dark:bg-slate-950">
        {/* Brand */}
        <header className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center shadow-md shadow-brand/30">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-display font-semibold text-slate-900 dark:text-white">Mitsumi AI</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">agent platform</p>
          </div>
        </header>

        {/* Main form block, vertically centered */}
        <div className="max-w-md w-full mx-auto lg:mx-0 lg:max-w-sm">
          <div className="space-y-1 mb-8">
            <h1 className="text-4xl sm:text-5xl font-display font-bold text-slate-900 dark:text-white leading-tight">
              Welcome back
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Sign in to continue to your workspace.
            </p>
          </div>

          <form className="space-y-5" onSubmit={onSubmit}>
            <label className="space-y-1.5 block">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Email address
              </span>
              <input
                data-testid="login-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-brand focus:ring-4 focus:ring-brand/10"
              />
            </label>

            <label className="space-y-1.5 block">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Password
                </span>
                <button
                  type="button"
                  className="text-[11px] font-semibold text-brand hover:underline"
                  data-testid="login-forgot-link"
                  onClick={() =>
                    alert("Reach out to your Mitsumi admin to reset your password.")
                  }
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  data-testid="login-password-input"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-brand focus:ring-4 focus:ring-brand/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  data-testid="login-toggle-password"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </label>

            <label className="flex items-center gap-2 select-none cursor-pointer text-xs text-slate-600 dark:text-slate-400">
              <input
                type="checkbox"
                data-testid="login-remember"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-brand focus:ring-brand accent-brand"
              />
              Keep me signed in
            </label>

            <button
              type="submit"
              data-testid="login-submit-btn"
              disabled={status === "loading"}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-br from-brand to-brand-dark hover:brightness-110 text-white text-sm font-semibold rounded-xl shadow-md shadow-brand/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {status === "loading" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {status === "failed" && error && (
              <div
                data-testid="login-error"
                className="rounded-xl border border-danger/20 bg-danger/5 text-danger text-xs px-4 py-2.5 flex items-start gap-2"
              >
                <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </form>

          <div className="mt-10 text-center text-xs text-slate-400">
            <span>Need assistance? </span>
            <span className="text-brand font-semibold">Contact your administrator</span>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-[11px] text-slate-400 flex items-center justify-between flex-wrap gap-2">
          <span>© {new Date().getFullYear()} Mitsumi Distribution</span>
          <span>All rights reserved.</span>
        </footer>
      </section>

      {/* Right: subtle brand panel */}
      <aside className="hidden md:flex flex-[1.1] relative overflow-hidden bg-slate-950 text-white">
        {/* Layered gradient backdrop */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.28),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(14,165,233,0.22),transparent_50%)]" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
            backgroundSize: "48px 48px"
          }}
        />
        {/* Orbs */}
        <div className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full bg-brand/25 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 w-[420px] h-[420px] rounded-full bg-sky-500/15 blur-3xl" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-10 lg:p-14 w-full">
          <div />

          <div className="space-y-5">
            <h2 className="text-4xl lg:text-5xl font-display font-bold leading-tight max-w-md">
              Mitsumi Distribution
            </h2>
            <p className="text-white/70 text-sm max-w-sm leading-relaxed">
              Your unified workspace for Sales, Marketing, Finance and Operations across the region.
            </p>
          </div>

          <div className="text-[11px] text-white/40 font-mono">
            © {new Date().getFullYear()} Mitsumi Distribution · Internal use only
          </div>
        </div>
      </aside>
    </div>
  );
}
