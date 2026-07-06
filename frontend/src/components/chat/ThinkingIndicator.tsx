import { cn } from "../../lib/cn";

const MITSUMI_LOGO = "https://res.cloudinary.com/dunssu2gi/image/upload/v1767612787/blog-images/tfvwseshobpnx7blnimx.png";

type Props = {
  label?: string;
};

export function ThinkingIndicator({ label = "Thinking…" }: Props) {
  return (
    <div
      data-testid="agent-chat-thinking"
      className="group flex gap-3 md:gap-4 animate-fade-up"
    >
      <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl shrink-0 overflow-hidden shadow-sm bg-white dark:bg-slate-800 flex items-center justify-center">
        <img src={MITSUMI_LOGO} alt="Mitsumi AI" className="w-full h-full object-contain p-0.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-widest text-slate-400 mb-1">Mitsumi AI</p>
        <div className="inline-flex items-center gap-2 rounded-2xl rounded-tl-sm px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-1" aria-hidden>
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className={cn(
                  "w-1.5 h-1.5 rounded-full bg-brand animate-thinking-dot"
                )}
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
        </div>
      </div>
    </div>
  );
}
