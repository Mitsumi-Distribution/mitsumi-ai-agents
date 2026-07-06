import { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Calendar,
  Check,
  Clock,
  Globe2,
  Laptop,
  Loader2,
  Mail,
  MapPin,
  Moon,
  Save,
  ShieldCheck,
  Sun,
  Unplug,
  User as UserIcon
} from "lucide-react";
import { TopBar } from "../../components/layout/TopBar";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { apiFetch, fetchPreferences, fetchRegions, updatePreferences } from "../../api/client";
import type { RegionInfo, UserPreferences } from "../../types";
import { useToast } from "../../store/toast";
import { useSessionStore } from "../../store/session";
import { useTheme, type Theme } from "../../hooks/useTheme";
import { persistThemeToServer } from "../../hooks/persistTheme";
import { cn } from "../../lib/cn";

// A curated list of common timezones. Falls back to Intl.supportedValuesOf if
// the browser supports it (Chrome 99+), otherwise uses the static list.
function loadTimezones(): string[] {
  try {
    const supported = (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone");
    if (supported && supported.length > 0) return supported;
  } catch {
    /* fall through */
  }
  return [
    "UTC",
    "Africa/Nairobi",
    "Africa/Kampala",
    "Africa/Dar_es_Salaam",
    "Africa/Kigali",
    "Africa/Addis_Ababa",
    "Africa/Johannesburg",
    "Africa/Lagos",
    "Africa/Cairo",
    "Asia/Dubai",
    "Asia/Riyadh",
    "Asia/Qatar",
    "Asia/Kolkata",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Istanbul",
    "America/New_York",
    "America/Chicago",
    "America/Los_Angeles",
    "America/Sao_Paulo"
  ];
}

const TZ_LIST = loadTimezones();

export function PreferencesPage() {
  const toast = useToast();
  const user = useSessionStore((s) => s.user);
  const { theme, setTheme } = useTheme();
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [regions, setRegions] = useState<RegionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [p, r] = await Promise.all([fetchPreferences(), fetchRegions()]);
        setPrefs(p);
        setRegions(r.regions);
        // Apply stored server-side theme to the document on first load.
        if (p.theme && ["light", "dark", "system"].includes(p.theme)) {
          setTheme(p.theme as Theme);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load preferences");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateField<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    setPrefs((prev) => (prev ? { ...prev, [key]: value } : prev));
    setDirty(true);
  }

  function updateNotifications(key: "email" | "in_app", value: boolean) {
    setPrefs((prev) =>
      prev
        ? { ...prev, notifications: { ...prev.notifications, [key]: value } }
        : prev
    );
    setDirty(true);
  }

  async function onSave() {
    if (!prefs) return;
    setSaving(true);
    try {
      const saved = await updatePreferences(prefs);
      setPrefs(saved);
      setTheme(saved.theme as Theme);
      setDirty(false);
      toast.success("Preferences saved", "Your choices are synced across devices");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save");
    } finally {
      setSaving(false);
    }
  }

  function onThemePick(next: Theme) {
    // Apply locally, persist to the server in the background so the topbar
    // toggle and this page stay in sync without requiring a Save click.
    setPrefs((prev) => (prev ? { ...prev, theme: next } : prev));
    setTheme(next);
    persistThemeToServer(next);
  }

  const availableCountries = useMemo(
    () => regions.find((r) => r.key === prefs?.default_region)?.countries ?? [],
    [regions, prefs?.default_region]
  );

  return (
    <>
      <TopBar
        title="Settings"
        subtitle="Make the platform feel like yours"
        actions={
          <Button
            onClick={onSave}
            disabled={!dirty || saving || !prefs}
            data-testid="preferences-save-btn"
            size="sm"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {dirty ? "Save changes" : "Saved"}
          </Button>
        }
      />
      <div className="flex-1 flex justify-center">
        <div className="w-full max-w-4xl px-4 md:px-10 py-6 md:py-8 space-y-5">
          {loading || !prefs ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-16 flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-brand" /> Loading your preferences…
            </div>
          ) : (
            <>
              {/* Profile card */}
              {user && (
                <section
                  className="bg-gradient-to-br from-brand/10 via-white to-white dark:from-brand/15 dark:via-slate-900 dark:to-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-5 md:p-6 shadow-sm flex items-center gap-4 flex-wrap"
                  data-testid="preferences-profile-card"
                >
                  <div className="w-14 h-14 rounded-2xl bg-brand text-white flex items-center justify-center font-display font-bold text-lg shadow-md shadow-brand/30">
                    {(user.name || user.email).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-display font-semibold text-slate-900 dark:text-white truncate">
                      {user.name || user.email}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono">{user.email}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(user.roles ?? []).map((r) => (
                        <Badge key={r} tone="brand" className="capitalize inline-flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          {r.replace(/_/g, " ")}
                        </Badge>
                      ))}
                      {user.region && (
                        <Badge tone="info" className="capitalize inline-flex items-center gap-1">
                          <Globe2 className="w-3 h-3" />
                          {user.region}
                        </Badge>
                      )}
                      {user.country && (
                        <Badge tone="neutral" className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {user.country}
                        </Badge>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* Appearance */}
              <Section
                title="Appearance"
                description="Choose how Mitsumi AI looks on this device."
              >
                <div className="grid grid-cols-3 gap-3">
                  <ThemeChoice
                    active={theme === "light"}
                    icon={<Sun className="w-4 h-4" />}
                    label="Light"
                    description="Clean and bright"
                    onClick={() => onThemePick("light")}
                    testId="preferences-theme-light"
                  />
                  <ThemeChoice
                    active={theme === "dark"}
                    icon={<Moon className="w-4 h-4" />}
                    label="Dark"
                    description="Easy on the eyes"
                    onClick={() => onThemePick("dark")}
                    testId="preferences-theme-dark"
                  />
                  <ThemeChoice
                    active={theme === "system"}
                    icon={<Laptop className="w-4 h-4" />}
                    label="System"
                    description="Follow my OS"
                    onClick={() => onThemePick("system")}
                    testId="preferences-theme-system"
                  />
                </div>
              </Section>

              {/* Time & locale */}
              <Section
                title="Time & locale"
                description="Dates, due times and calendar events use this timezone."
                icon={<Clock className="w-4 h-4 text-brand" />}
              >
                <div className="relative">
                  <select
                    data-testid="preferences-timezone-select"
                    value={prefs.timezone || "UTC"}
                    onChange={(e) => updateField("timezone", e.target.value)}
                    className="w-full md:max-w-sm px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm"
                  >
                    {TZ_LIST.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Current local time: {new Date().toLocaleTimeString(undefined, { timeZone: prefs.timezone || "UTC" })}
                  </p>
                </div>
              </Section>

              {/* Default scope */}
              <Section
                title="Default data scope"
                description="Dashboards and agents open pre-filtered to this region/country."
                icon={<Globe2 className="w-4 h-4 text-brand" />}
              >
                <div className="grid md:grid-cols-2 gap-4">
                  <label className="space-y-1 block">
                    <span className="text-xs uppercase tracking-widest text-slate-400">Region</span>
                    <select
                      data-testid="preferences-region-select"
                      value={prefs.default_region ?? ""}
                      onChange={(e) => {
                        const region = e.target.value || null;
                        setPrefs((p) => (p ? { ...p, default_region: region, default_country: null } : p));
                        setDirty(true);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm"
                    >
                      <option value="">(Use my assigned region)</option>
                      {regions.map((r) => (
                        <option key={r.key} value={r.key}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 block">
                    <span className="text-xs uppercase tracking-widest text-slate-400">Country</span>
                    <select
                      data-testid="preferences-country-select"
                      value={prefs.default_country ?? ""}
                      onChange={(e) => updateField("default_country", e.target.value || null)}
                      disabled={!availableCountries.length}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm disabled:opacity-60"
                    >
                      <option value="">(All countries in region)</option>
                      {availableCountries.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name} · {c.code}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
                  Super admins see all data by default. Choosing a region/country here narrows every
                  dashboard, agent answer and task list to that scope (you can still override per-page).
                </p>
              </Section>

              {/* Notifications */}
              <Section
                title="Notifications"
                description="Choose how the platform reaches you."
                icon={<BellRing className="w-4 h-4 text-brand" />}
              >
                <Toggle
                  label="Email notifications"
                  description="Critical alerts, invites and weekly digests."
                  value={prefs.notifications?.email ?? true}
                  onChange={(v) => updateNotifications("email", v)}
                  testId="preferences-notify-email"
                />
                <Toggle
                  label="In-app notifications"
                  description="Toasts when an agent job finishes or a mention arrives."
                  value={prefs.notifications?.in_app ?? true}
                  onChange={(v) => updateNotifications("in_app", v)}
                  testId="preferences-notify-inapp"
                />
              </Section>

              {/* Google Integration */}
              <GoogleConnectionCard />

              {dirty && (
                <div
                  className="sticky bottom-4 flex items-center justify-between gap-3 rounded-2xl border border-brand/30 bg-brand/10 dark:bg-brand/20 text-slate-800 dark:text-white px-4 py-3 shadow-lg shadow-brand/10 backdrop-blur"
                  data-testid="preferences-dirty-banner"
                >
                  <span className="text-xs font-medium">You have unsaved changes</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => window.location.reload()}>
                      Discard
                    </Button>
                    <Button size="sm" onClick={onSave} disabled={saving}>
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save changes
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Section({
  title,
  description,
  icon,
  children
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-5 md:p-6 shadow-sm">
      <header className="mb-4 flex items-start gap-3">
        {icon && (
          <div className="w-8 h-8 rounded-xl bg-brand-subtle dark:bg-brand-glow flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-sm font-display font-semibold text-slate-900 dark:text-white">{title}</h3>
          {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
        </div>
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ThemeChoice({
  active,
  icon,
  label,
  description,
  onClick,
  testId
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "relative rounded-2xl border p-4 text-left transition-all group",
        active
          ? "border-brand bg-brand/5 shadow-sm ring-2 ring-brand/20"
          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-brand/40 hover:shadow-sm"
      )}
    >
      {active && (
        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center">
          <Check className="w-3 h-3" />
        </span>
      )}
      <div
        className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center mb-3",
          active ? "bg-brand text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:text-brand"
        )}
      >
        {icon}
      </div>
      <p className="text-sm font-semibold text-slate-900 dark:text-white">{label}</p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
    </button>
  );
}

function Toggle({
  label,
  description,
  value,
  onChange,
  testId
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  testId?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{label}</p>
        {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        data-testid={testId}
        className={cn(
          "shrink-0 w-11 h-6 rounded-full relative transition-colors",
          value ? "bg-brand" : "bg-slate-300 dark:bg-slate-700"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform",
            value ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
    </div>
  );
}


function GoogleConnectionCard() {
  const [status, setStatus] = useState<{ connected: boolean; google_email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    apiFetch<{ connected: boolean; google_email?: string }>("/auth/google/status")
      .then(setStatus)
      .catch(() => setStatus({ connected: false }))
      .finally(() => setLoading(false));

    // Check for callback success
    const params = new URLSearchParams(window.location.search);
    if (params.get("google_connected") === "true") {
      toast.success("Google account connected!");
      window.history.replaceState({}, "", window.location.pathname);
      apiFetch<{ connected: boolean; google_email?: string }>("/auth/google/status").then(setStatus).catch(() => {});
    }
    if (params.get("google_error")) {
      toast.error(`Google connection failed: ${params.get("google_error")}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function handleConnect() {
    try {
      const { url } = await apiFetch<{ url: string }>("/auth/google/auth-url");
      window.location.href = url;
    } catch (e: any) {
      toast.error(e.message || "Failed to start Google connection");
    }
  }

  async function handleDisconnect() {
    try {
      await apiFetch("/auth/google/disconnect", { method: "POST" });
      setStatus({ connected: false });
      toast.success("Google account disconnected");
    } catch {}
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-6 shadow-sm" data-testid="google-connection-card">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-red-500 flex items-center justify-center text-white shrink-0">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-display font-semibold text-slate-900 dark:text-white">Google Workspace</h3>
          <p className="text-xs text-slate-500 mt-0.5">Connect Google Calendar & Gmail for scheduling and email</p>

          {loading ? (
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-3 h-3 animate-spin" /> Checking connection…
            </div>
          ) : status?.connected ? (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Check className="w-3 h-3" /> Connected
                </span>
                <span className="text-xs text-slate-500">{status.google_email}</span>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> Calendar</span>
                <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> Gmail</span>
              </div>
              <button onClick={handleDisconnect} data-testid="google-disconnect-btn"
                className="inline-flex items-center gap-1 text-xs text-danger hover:underline mt-1">
                <Unplug className="w-3 h-3" /> Disconnect
              </button>
            </div>
          ) : (
            <button onClick={handleConnect} data-testid="google-connect-btn"
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-brand/40 hover:shadow-md transition-all">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Connect Google Account
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
