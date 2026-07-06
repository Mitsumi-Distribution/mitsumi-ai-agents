import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  BellOff,
  BellRing,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ShieldCheck,
  Trash2,
  Zap,
  Info
} from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import {
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRecord
} from "../api/client";
import { useToast } from "../store/toast";
import { formatRelative } from "../lib/format";
import { cn } from "../lib/cn";

const PAGE_SIZE = 20;

type FilterKind = "all" | "job" | "task" | "user" | "system";

const KIND_META: Record<NotificationRecord["kind"], { label: string; icon: React.ReactNode; tone: "info" | "brand" | "warning" | "neutral" }> = {
  job: { label: "Job", icon: <Zap className="w-4 h-4" />, tone: "info" },
  task: { label: "Task", icon: <BellRing className="w-4 h-4" />, tone: "brand" },
  user: { label: "User", icon: <ShieldCheck className="w-4 h-4" />, tone: "warning" },
  system: { label: "System", icon: <Info className="w-4 h-4" />, tone: "neutral" }
};

export function NotificationsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [kind, setKind] = useState<FilterKind>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listNotifications({
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
        unread_only: unreadOnly,
        kind: kind === "all" ? undefined : kind
      });
      setItems(res.items);
      setTotal(res.total);
      setUnread(res.unread);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load notifications");
    } finally {
      setLoading(false);
    }
  }, [page, kind, unreadOnly, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function onItemClick(n: NotificationRecord) {
    if (!n.read) {
      try {
        await markNotificationRead(n.id);
        setItems((prev) => prev.map((it) => (it.id === n.id ? { ...it, read: true } : it)));
        setUnread((u) => Math.max(0, u - 1));
      } catch {
        /* ignore */
      }
    }
    if (n.link) navigate(n.link);
  }

  async function onMarkAll() {
    try {
      const res = await markAllNotificationsRead();
      setItems((prev) => prev.map((it) => ({ ...it, read: true })));
      setUnread(0);
      toast.success(`Marked ${res.updated} as read`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't mark all read");
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteNotification(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
      setTotal((t) => Math.max(0, t - 1));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete notification");
    }
  }

  return (
    <>
      <TopBar
        title="Notifications"
        subtitle={`${unread} unread · ${total} total`}
        actions={
          <Button
            size="sm"
            variant="secondary"
            onClick={onMarkAll}
            disabled={unread === 0}
            data-testid="notifications-mark-all-btn"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all read
          </Button>
        }
      />
      <div className="flex-1 flex justify-center">
        <div className="w-full max-w-4xl px-4 md:px-10 py-6 md:py-8 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap" data-testid="notifications-filters">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {(["all", "job", "task", "user", "system"] as FilterKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setKind(k);
                    setPage(0);
                  }}
                  data-testid={`notifications-filter-${k}`}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-semibold capitalize whitespace-nowrap transition-colors border",
                    kind === k
                      ? "bg-brand text-white border-brand"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-brand/40"
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => {
                  setUnreadOnly(e.target.checked);
                  setPage(0);
                }}
                data-testid="notifications-unread-only"
                className="accent-brand w-4 h-4 rounded border-slate-300 dark:border-slate-700"
              />
              Unread only
            </label>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-16 flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-brand" /> Loading notifications…
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<BellOff className="w-6 h-6" />}
              title={unreadOnly ? "All caught up!" : "No notifications yet"}
              description={
                unreadOnly
                  ? "You've read everything. Back to the work."
                  : "Agent jobs, teammates, and system events will show up here."
              }
            />
          ) : (
            <ul className="space-y-2" data-testid="notifications-list">
              {items.map((n) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  onClick={() => onItemClick(n)}
                  onDelete={() => onDelete(n.id)}
                />
              ))}
            </ul>
          )}

          {items.length > 0 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              onPrev={() => setPage((p) => Math.max(0, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              testIdPrefix="notifications"
            />
          )}
        </div>
      </div>
    </>
  );
}

function NotificationRow({
  n,
  onClick,
  onDelete
}: {
  n: NotificationRecord;
  onClick: () => void;
  onDelete: () => void;
}) {
  const meta = KIND_META[n.kind];
  return (
    <li
      data-testid={`notification-row-${n.id}`}
      className={cn(
        "group rounded-2xl border p-4 flex items-start gap-3 cursor-pointer transition-shadow hover:shadow-md",
        n.read
          ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/60"
          : "bg-brand/5 dark:bg-brand/10 border-brand/20"
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
          meta.tone === "info" && "bg-sky-500/10 text-sky-500",
          meta.tone === "brand" && "bg-brand/10 text-brand",
          meta.tone === "warning" && "bg-amber-500/10 text-amber-500",
          meta.tone === "neutral" && "bg-slate-200/60 dark:bg-slate-800 text-slate-500"
        )}
      >
        {meta.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p
            className={cn(
              "text-sm truncate",
              n.read ? "text-slate-700 dark:text-slate-200 font-medium" : "text-slate-900 dark:text-white font-semibold"
            )}
          >
            {n.title}
          </p>
          {!n.read && <Badge tone="brand">New</Badge>}
          <Badge tone="neutral" className="capitalize">
            {meta.label}
          </Badge>
          <span className="text-[11px] font-mono text-slate-400">{formatRelative(n.created_at)}</span>
        </div>
        {n.body && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{n.body}</p>}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        data-testid={`notification-delete-${n.id}`}
        className="w-8 h-8 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
        aria-label="Delete"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </li>
  );
}

export function Pagination({
  page,
  totalPages,
  onPrev,
  onNext,
  testIdPrefix
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  testIdPrefix: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-3" data-testid={`${testIdPrefix}-pagination`}>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Page <span className="font-mono">{page + 1}</span> of <span className="font-mono">{totalPages}</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={page === 0}
          data-testid={`${testIdPrefix}-prev-btn`}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:border-brand/40 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Prev
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= totalPages - 1}
          data-testid={`${testIdPrefix}-next-btn`}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:border-brand/40 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
