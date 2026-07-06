import { KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { AtSign, Loader2 } from "lucide-react";
import { cn } from "../../lib/cn";
import { searchMentionCandidates, type MentionCandidate } from "../../api/client";

type Props = {
  /** The raw @query currently under the caret (e.g. "fran"). `null` when the user isn't mentioning. */
  query: string | null;
  /** Fired when user picks a teammate. `email` is the value that should replace the @token. */
  onPick: (candidate: MentionCandidate) => void;
  /** Dismiss request (ESC, blur, successful pick). */
  onClose: () => void;
  /**
   * External key-events forwarded from the textarea (ArrowUp / ArrowDown / Enter / Escape)
   * when the popover is open. Returns true if the popover consumed the event.
   */
  keyHandlerRef: React.MutableRefObject<((e: ReactKeyboardEvent<HTMLTextAreaElement>) => boolean) | null>;
};

/**
 * Dropdown anchored above the chat composer — pops when the user types `@` in
 * the textarea. Debounces the fetch, supports arrow/enter/escape navigation and
 * reuses an in-memory cache for the common "empty query" case.
 */
export function MentionAutocomplete({ query, onPick, onClose, keyHandlerRef }: Props) {
  const [items, setItems] = useState<MentionCandidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const cacheRef = useRef<Map<string, MentionCandidate[]>>(new Map());

  const debouncedQuery = useDebounced(query ?? "", 150);

  useEffect(() => {
    if (query === null) {
      setItems(null);
      return;
    }
    const key = debouncedQuery.toLowerCase();
    const cached = cacheRef.current.get(key);
    if (cached) {
      setItems(cached);
      setActive(0);
      return;
    }
    let alive = true;
    setLoading(true);
    searchMentionCandidates(debouncedQuery)
      .then((res) => {
        if (!alive) return;
        cacheRef.current.set(key, res);
        setItems(res);
        setActive(0);
      })
      .catch(() => {
        if (!alive) return;
        setItems([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [query, debouncedQuery]);

  const resolvedItems = useMemo(() => items ?? [], [items]);

  // Register the key handler with the parent. It mutates the ref so the
  // textarea's own onKeyDown can consult it synchronously.
  useEffect(() => {
    keyHandlerRef.current = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (query === null) return false;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => (resolvedItems.length ? (i + 1) % resolvedItems.length : 0));
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (resolvedItems.length ? (i - 1 + resolvedItems.length) % resolvedItems.length : 0));
        return true;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        if (resolvedItems.length === 0) return false;
        e.preventDefault();
        onPick(resolvedItems[active]);
        return true;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return true;
      }
      return false;
    };
    return () => {
      keyHandlerRef.current = null;
    };
  }, [active, query, resolvedItems, onPick, onClose, keyHandlerRef]);

  if (query === null) return null;

  return (
    <div
      data-testid="mention-autocomplete"
      role="listbox"
      className="absolute left-2 right-2 sm:left-14 sm:right-14 bottom-full mb-2 z-30 origin-bottom rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden animate-fade-up"
    >
      <div className="px-3 py-2 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
        <AtSign className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold flex-1">
          Mention a teammate
        </span>
        {loading && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
      </div>
      {resolvedItems.length === 0 ? (
        <div className="px-4 py-5 text-xs text-slate-400 text-center">
          {loading ? "Searching…" : query ? `No teammates matching "${query}"` : "Start typing a name or email"}
        </div>
      ) : (
        <ul className="max-h-60 overflow-y-auto py-1" data-testid="mention-autocomplete-list">
          {resolvedItems.map((item, idx) => (
            <li key={item.email}>
              <button
                type="button"
                role="option"
                aria-selected={idx === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(item);
                }}
                onMouseEnter={() => setActive(idx)}
                data-testid={`mention-autocomplete-item-${item.email}`}
                className={cn(
                  "w-full text-left px-3 py-2 flex items-center gap-3 transition-colors",
                  idx === active ? "bg-brand/10 dark:bg-brand/15" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
                )}
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand/30 to-brand/10 flex items-center justify-center text-xs font-semibold text-brand shrink-0">
                  {initials(item.name || item.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {item.name || item.email.split("@")[0]}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono">
                    {item.email}
                  </p>
                </div>
                {(item.region || item.country) && (
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono shrink-0">
                    {item.country || item.region}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex items-center gap-3 text-[10px] text-slate-400 font-mono">
        <span><kbd className="px-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">↑</kbd> <kbd className="px-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">↓</kbd> navigate</span>
        <span><kbd className="px-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">enter</kbd> pick</span>
        <span><kbd className="px-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">esc</kbd> cancel</span>
      </div>
    </div>
  );
}

function initials(src: string): string {
  const cleaned = src.replace(/@.+$/, "").replace(/[^a-z\s]/gi, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}
