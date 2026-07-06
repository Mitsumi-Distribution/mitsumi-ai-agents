import { FormEvent, useEffect, useMemo, useState } from "react";
import { Globe2, Loader2, MapPin, Pencil, Plus, Trash2, X } from "lucide-react";
import { TopBar } from "../../components/layout/TopBar";
import { EmptyState } from "../../components/ui/EmptyState";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import {
  addRegionCountry,
  createRegion,
  deleteRegion,
  fetchCountryCatalog,
  fetchRegions,
  removeRegionCountry,
  updateRegion
} from "../../api/client";
import type { CountryCatalogEntry, RegionInfo } from "../../types";
import { useSessionStore } from "../../store/session";
import { useToast } from "../../store/toast";

// Summarise a cascade delete response for a human-readable toast description.
function _summariseCascade(result: { cascade: boolean; affected: Record<string, number>; users_nulled: number }): string | undefined {
  if (!result.cascade) return undefined;
  const entries = Object.entries(result.affected || {});
  const parts: string[] = [];
  if (entries.length) {
    const total = entries.reduce((sum, [, n]) => sum + n, 0);
    parts.push(`${total} records removed across ${entries.length} collection${entries.length === 1 ? "" : "s"}`);
  }
  if (result.users_nulled) {
    parts.push(`${result.users_nulled} user${result.users_nulled === 1 ? "" : "s"} unassigned`);
  }
  return parts.length ? parts.join(" · ") : undefined;
}

export function RegionsPage() {
  const toast = useToast();
  const user = useSessionStore((s) => s.user);
  const isAdmin = Boolean(user?.is_super_admin) || (user?.roles ?? []).some((r) => r.includes("admin") || r === "regional_head");  const [regions, setRegions] = useState<RegionInfo[]>([]);
  const [catalog, setCatalog] = useState<CountryCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regionFormOpen, setRegionFormOpen] = useState(false);
  const [editing, setEditing] = useState<RegionInfo | null>(null);

  async function load() {
    try {
      const [{ regions }, { countries }] = await Promise.all([fetchRegions(), fetchCountryCatalog()]);
      setRegions(regions);
      setCatalog(countries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load regions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const usedCodes = useMemo(() => new Set(regions.flatMap((r) => r.countries.map((c) => c.code))), [regions]);

  return (
    <>
      <TopBar
        title="Regions"
        subtitle="Dynamic region catalogue — countries map to the ISO 3166-1 list"
        actions={
          isAdmin ? (
            <Button size="sm" onClick={() => setRegionFormOpen(true)} data-testid="regions-add-btn">
              <Plus className="w-3.5 h-3.5" />
              Add region
            </Button>
          ) : null
        }
      />
      <div className="flex-1 flex justify-center">
        <div className="w-full max-w-5xl px-4 md:px-10 py-6 md:py-8 space-y-4">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-16 flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-brand" /> Loading regions…
            </div>
          ) : error ? (
            <EmptyState icon={<Globe2 className="w-6 h-6" />} title="Couldn't load regions" description={error} />
          ) : regions.length === 0 ? (
            <EmptyState
              icon={<Globe2 className="w-6 h-6" />}
              title="No regions configured"
              description={isAdmin ? "Add your first region to start scoping data." : "An admin hasn't set up any regions yet."}
            />
          ) : (
            regions.map((region) => (
              <RegionCard
                key={region.key}
                region={region}
                isAdmin={isAdmin}
                catalog={catalog}
                usedCodes={usedCodes}
                onEdit={() => setEditing(region)}
                onDelete={async () => {
                  if (!confirm(`Remove region "${region.label}"?`)) return;
                  try {
                    const result = await deleteRegion(region.key);
                    setRegions((prev) => prev.filter((r) => r.key !== region.key));
                    toast.success("Region removed", _summariseCascade(result));
                  } catch (err) {
                    // Handle "users assigned" case — offer to cascade.
                    const msg = err instanceof Error ? err.message : "Delete failed";
                    const wantsCascade =
                      msg.includes("cascade=true") &&
                      confirm(
                        `${msg}\n\nProceed with a cascade delete? ` +
                          `This will null the region on affected users and delete all scoped data.`
                      );
                    if (!wantsCascade) {
                      toast.error(msg);
                      return;
                    }
                    try {
                      const result = await deleteRegion(region.key, true);
                      setRegions((prev) => prev.filter((r) => r.key !== region.key));
                      toast.success("Region removed", _summariseCascade(result));
                    } catch (err2) {
                      toast.error(err2 instanceof Error ? err2.message : "Cascade delete failed");
                    }
                  }
                }}
                onAddCountry={async (payload) => {
                  try {
                    const updated = await addRegionCountry(region.key, payload);
                    setRegions((prev) => prev.map((r) => (r.key === updated.key ? updated : r)));
                    toast.success("Country added");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Add failed");
                  }
                }}
                onRemoveCountry={async (code) => {
                  try {
                    const updated = await removeRegionCountry(region.key, code);
                    setRegions((prev) => prev.map((r) => (r.key === updated.key ? updated : r)));
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Remove failed");
                  }
                }}
              />
            ))
          )}
        </div>
      </div>

      {(regionFormOpen || editing) && (
        <RegionFormModal
          initial={editing ?? undefined}
          onClose={() => {
            setRegionFormOpen(false);
            setEditing(null);
          }}
          onSubmit={async (payload) => {
            try {
              if (editing) {
                const updated = await updateRegion(editing.key, { label: payload.label });
                setRegions((prev) => prev.map((r) => (r.key === updated.key ? updated : r)));
                toast.success("Region updated");
              } else {
                const created = await createRegion({ key: payload.key, label: payload.label });
                setRegions((prev) => [...prev, created]);
                toast.success("Region created");
              }
              setRegionFormOpen(false);
              setEditing(null);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Save failed");
            }
          }}
        />
      )}
    </>
  );
}

function RegionCard({
  region,
  isAdmin,
  catalog,
  usedCodes,
  onEdit,
  onDelete,
  onAddCountry,
  onRemoveCountry
}: {
  region: RegionInfo;
  isAdmin: boolean;
  catalog: CountryCatalogEntry[];
  usedCodes: Set<string>;
  onEdit: () => void;
  onDelete: () => void;
  onAddCountry: (payload: { code: string; name: string }) => Promise<void>;
  onRemoveCountry: (code: string) => Promise<void>;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const regionCodes = useMemo(() => new Set(region.countries.map((c) => c.code)), [region.countries]);

  const available = useMemo(() => {
    // show everything NOT yet in this region (but may be in another region -
    // we surface a warning badge on the row).
    return catalog
      .filter((c) => !regionCodes.has(c.code))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog, regionCodes]);

  return (
    <section
      data-testid={`region-card-${region.key}`}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-5 md:p-6 shadow-sm"
    >
      <header className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-subtle dark:bg-brand-glow text-brand flex items-center justify-center">
            <Globe2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-display font-semibold text-slate-900 dark:text-white">{region.label}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              {region.key} · {region.countries.length} countr{region.countries.length === 1 ? "y" : "ies"}
            </p>
          </div>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onEdit}
              data-testid={`region-edit-${region.key}`}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-brand hover:bg-brand/10"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              data-testid={`region-delete-${region.key}`}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-danger hover:bg-danger/10"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {region.countries.map((c) => (
          <div
            key={c.code}
            className="group flex items-center gap-3 px-3 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl"
            data-testid={`region-country-${c.code}`}
          >
            <MapPin className="w-4 h-4 text-slate-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{c.name}</p>
              <p className="text-[11px] text-slate-400 font-mono">{c.code}</p>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => onRemoveCountry(c.code)}
                data-testid={`region-country-remove-${c.code}`}
                className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-md text-slate-400 hover:text-danger hover:bg-danger/10 flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}

        {isAdmin && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              data-testid={`region-add-country-${region.key}`}
              className="w-full flex items-center gap-2 px-3 py-2.5 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-500 hover:text-brand hover:border-brand/40 transition-colors text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              Add country
            </button>
            {pickerOpen && (
              <CountryPicker
                countries={available}
                usedCodes={usedCodes}
                onClose={() => setPickerOpen(false)}
                onSelect={async (c) => {
                  await onAddCountry(c);
                  setPickerOpen(false);
                }}
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function CountryPicker({
  countries,
  usedCodes,
  onSelect,
  onClose
}: {
  countries: CountryCatalogEntry[];
  usedCodes: Set<string>;
  onSelect: (c: CountryCatalogEntry) => Promise<void> | void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => (query ? countries.filter((c) => `${c.code} ${c.name}`.toLowerCase().includes(query.toLowerCase())) : countries),
    [query, countries]
  );
  return (
    <>
      <div className="fixed inset-0 z-30" aria-hidden="true" onClick={onClose} />
      <div
        className="absolute left-0 right-0 top-full mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-40 overflow-hidden"
        data-testid="region-country-picker"
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search country…"
          className="w-full px-3 py-2 text-xs border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60"
        />
        <div className="max-h-72 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-xs text-slate-400 text-center">No countries match</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => onSelect(c)}
                data-testid={`region-country-picker-${c.code}`}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center gap-2"
              >
                <span className="font-mono text-[11px] text-slate-400 w-8">{c.code}</span>
                <span className="text-xs text-slate-700 dark:text-slate-200 truncate flex-1">{c.name}</span>
                {usedCodes.has(c.code) && <Badge tone="warning">in another region</Badge>}
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function RegionFormModal({
  initial,
  onClose,
  onSubmit
}: {
  initial?: RegionInfo;
  onClose: () => void;
  onSubmit: (values: { key: string; label: string }) => Promise<void> | void;
}) {
  const [key, setKey] = useState(initial?.key ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit({ key: key.trim().toLowerCase(), label: label.trim() });
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <form
        data-testid="region-form-modal"
        onSubmit={handleSubmit}
        className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-5 md:p-6 space-y-4 animate-fade-up"
      >
        <h3 className="text-base font-display font-semibold text-slate-900 dark:text-white">
          {initial ? "Edit region" : "Add region"}
        </h3>
        <label className="space-y-1 block">
          <span className="text-xs uppercase tracking-wider text-slate-400">Key</span>
          <input
            required
            disabled={Boolean(initial)}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="e.g. europe"
            data-testid="region-form-key"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm font-mono disabled:opacity-60"
          />
        </label>
        <label className="space-y-1 block">
          <span className="text-xs uppercase tracking-wider text-slate-400">Label</span>
          <input
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Europe"
            data-testid="region-form-label"
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm"
          />
        </label>
        <footer className="flex items-center justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" disabled={submitting} data-testid="region-form-submit">
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            {initial ? "Save changes" : "Create region"}
          </Button>
        </footer>
      </form>
    </div>
  );
}
