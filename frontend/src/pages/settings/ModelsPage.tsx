import { useEffect, useState } from "react";
import { Bot, Check, Cpu, Zap } from "lucide-react";
import { fetchModelConfig, setDepartmentModel } from "../../api/client";
import { useToast } from "../../store/toast";
import type { ModelConfig } from "../../types";
import { cn } from "../../lib/cn";

const TIER_ICONS: Record<string, typeof Zap> = { fast: Zap, balanced: Cpu, powerful: Bot };
const TIER_COLORS: Record<string, string> = {
  fast: "from-emerald-500 to-emerald-600",
  balanced: "from-brand to-brand-dark",
  powerful: "from-amber-500 to-orange-500",
};
const TIER_BG: Record<string, string> = {
  fast: "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400",
  balanced: "bg-brand/10 border-brand/20 text-brand",
  powerful: "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400",
};
const DEPARTMENTS = ["sales", "marketing", "finance", "ops"];

export function ModelsPage() {
  const toast = useToast();
  const [config, setConfig] = useState<ModelConfig | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchModelConfig().then(setConfig).catch(() => toast.error("Failed to load model configuration"));
  }, []);

  async function handleAssign(dept: string, key: string) {
    setSaving(dept);
    try {
      const updated = await setDepartmentModel(dept, key);
      setConfig(updated);
      toast.success(`${dept} now uses ${config?.catalogue[key]?.name || key}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to update model");
    } finally {
      setSaving(null);
    }
  }

  if (!config) {
    return (
      <div className="flex-1 px-4 md:px-10 py-8 max-w-5xl w-full mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-48" />
          <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  const catalogue = Object.entries(config.catalogue);

  return (
    <div className="flex-1 px-4 md:px-10 py-8 max-w-5xl w-full mx-auto space-y-8" data-testid="models-page">
      <div>
        <h1 className="text-2xl font-display font-semibold text-slate-900 dark:text-white">Model Configuration</h1>
        <p className="text-sm text-slate-500 mt-1">
          Choose which Claude model powers each department agent. Haiku is fast & cheap, Opus is the most capable.
        </p>
      </div>

      {/* Model cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {catalogue.map(([key, model]) => {
          const Icon = TIER_ICONS[model.tier] || Cpu;
          const gradient = TIER_COLORS[model.tier] || "from-slate-500 to-slate-600";
          const deptCount = Object.values(config.assignments).filter((v) => v === key).length;
          return (
            <div
              key={key}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-5 shadow-sm"
              data-testid={`model-card-${key}`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shadow-md", gradient)}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-display font-semibold text-slate-900 dark:text-white">{model.name}</p>
                  <p className="text-[10px] uppercase tracking-widest text-slate-400">{model.tier}</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{model.description}</p>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                <div>
                  <span className="block text-slate-400 uppercase tracking-wider">Input</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">${model.input_cost_per_1m}/1M tok</span>
                </div>
                <div>
                  <span className="block text-slate-400 uppercase tracking-wider">Output</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">${model.output_cost_per_1m}/1M tok</span>
                </div>
              </div>
              <div className="text-xs text-slate-500">
                <span className="font-semibold text-slate-700 dark:text-slate-300">{deptCount}</span> department{deptCount !== 1 ? "s" : ""} using this model
              </div>
            </div>
          );
        })}
      </div>

      {/* Department assignments */}
      <div>
        <h2 className="text-lg font-display font-semibold text-slate-900 dark:text-white mb-4">Department Assignments</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DEPARTMENTS.map((dept) => {
            const currentKey = config.assignments[dept] || config.default;
            return (
              <div
                key={dept}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-5 shadow-sm"
                data-testid={`dept-model-${dept}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-display font-semibold text-slate-900 dark:text-white capitalize">{dept}</h3>
                  {saving === dept && (
                    <span className="text-[10px] text-brand animate-pulse">Saving…</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {catalogue.map(([key, model]) => {
                    const isActive = currentKey === key;
                    const tierCls = TIER_BG[model.tier] || "";
                    return (
                      <button
                        key={key}
                        onClick={() => !isActive && handleAssign(dept, key)}
                        disabled={saving === dept}
                        data-testid={`dept-model-${dept}-${key}`}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all",
                          isActive
                            ? cn(tierCls, "ring-2 ring-offset-1 ring-offset-white dark:ring-offset-slate-900",
                                model.tier === "fast" ? "ring-emerald-500/40" :
                                model.tier === "balanced" ? "ring-brand/40" : "ring-amber-500/40")
                            : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500"
                        )}
                      >
                        {isActive && <Check className="w-3 h-3" />}
                        {model.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cost estimation note */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-5 text-xs text-slate-500 dark:text-slate-400">
        <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Cost estimation</p>
        <p>
          Monitor your AWS Bedrock usage in the{" "}
          <a href="https://console.aws.amazon.com/bedrock" target="_blank" rel="noopener" className="text-brand hover:underline">
            AWS Console → Bedrock → Usage
          </a>.
          Haiku ($0.80/1M input) is ~19x cheaper than Opus ($15/1M input). Use Haiku for routine lookups, switch to Sonnet or Opus for complex analysis.
        </p>
      </div>
    </div>
  );
}
