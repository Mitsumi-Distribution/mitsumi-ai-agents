import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Loader2, Wifi, WifiOff } from "lucide-react";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRecord
} from "../../api/client";
import { useSessionStore } from "../../store/session";
import { formatRelative } from "../../lib/format";
import { cn } from "../../lib/cn";

const WS_BASE = import.meta.env.VITE_WS_BASE ?? "ws://localhost:8000";

/** Play a notification sound using Web Audio API */
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = ctx.currentTime;

    // Three-tone ascending chime: C5 → E5 → G5
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      // Louder volume (0.3 instead of 0.15) with longer sustain
      gain.gain.setValueAtTime(0.3, now + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.4);
    });
    setTimeout(() => ctx.close(), 2000);
  } catch {
    // Fallback: try HTML5 Audio with a data URI beep
    try {
      const audio = new Audio("data:audio/wav;base64,UklGRl9vT19teleVuZGJHQVRh");
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch {}
  }
}

type BellMessage =
  | { type: "hello"; unread: number }
  | { type: "notification"; notification: NotificationRecord; unread: number };

export function NotificationBell() {
  const token = useSessionStore((s) => s.token);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const navigate = useNavigate();

  const wsUrl = useMemo(() => `${WS_BASE}/api/ws/notifications?token=${encodeURIComponent(token ?? "")}`, [token]);

  // Persistent WebSocket with exponential backoff reconnect.
  useEffect(() => {
    if (!token) return;
    let disposed = false;
    let attempts = 0;

    const connect = () => {
      if (disposed) return;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => {
        attempts = 0;
        setLiveConnected(true);
      };
      ws.onclose = () => {
        setLiveConnected(false);
        if (disposed) return;
        attempts += 1;
        const delay = Math.min(30000, 1000 * 2 ** Math.min(attempts, 5));
        reconnectTimer.current = window.setTimeout(connect, delay);
      };
      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* noop */
        }
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as BellMessage;
          if (msg.type === "hello") {
            setUnread(msg.unread);
          } else if (msg.type === "notification") {
            setUnread(msg.unread);
            setItems((prev) => [msg.notification, ...prev.filter((it) => it.id !== msg.notification.id)].slice(0, 8));
            // Play notification sound
            playNotificationSound();
          }
        } catch {
          /* ignore malformed payloads */
        }
      };
    };

    connect();
    return () => {
      disposed = true;
      if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
      try {
        wsRef.current?.close();
      } catch {
        /* noop */
      }
    };
  }, [token, wsUrl]);

  async function handleOpen() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    setOpen(true);
    setLoadingList(true);
    try {
      const res = await listNotifications({ limit: 8 });
      setItems(res.items);
      setUnread(res.unread);
    } catch {
      /* ignore */
    } finally {
      setLoadingList(false);
    }
  }

  const onClickItem = useCallback(
    async (n: NotificationRecord) => {
      if (!n.read) {
        try {
          await markNotificationRead(n.id);
          setItems((prev) => prev.map((it) => (it.id === n.id ? { ...it, read: true } : it)));
          setUnread((u) => Math.max(0, u - 1));
        } catch {
          /* ignore */
        }
      }
      setOpen(false);
      if (n.link) navigate(n.link);
    },
    [navigate]
  );

  const onMarkAll = useCallback(async () => {
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((it) => ({ ...it, read: true })));
      setUnread(0);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label="Notifications"
        data-testid="topbar-notifications-btn"
        onClick={() => (open ? setOpen(false) : handleOpen())}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span
            data-testid="topbar-notifications-badge"
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[10px] font-semibold font-mono flex items-center justify-center ring-2 ring-slate-100 dark:ring-slate-950"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
        {/* Tiny pulsing dot when live WS is connected */}
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ring-1 ring-slate-100 dark:ring-slate-950",
            liveConnected ? "bg-emerald-400 animate-pulse" : "bg-slate-300 dark:bg-slate-700"
          )}
          data-testid="topbar-notifications-live"
          aria-hidden="true"
        />
      </button>

      {open && pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[90]" onClick={() => setOpen(false)} aria-hidden />
            <div
              className="fixed z-[100] w-[380px] max-w-[92vw] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-fade-up"
              style={{ top: pos.top, right: pos.right }}
              data-testid="topbar-notifications-dropdown"
            >
              <header className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm font-display font-semibold text-slate-900 dark:text-white truncate">Notifications</p>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold",
                      liveConnected ? "text-emerald-500 bg-emerald-500/10" : "text-slate-400 bg-slate-200/50 dark:bg-slate-800"
                    )}
                    title={liveConnected ? "Real-time push is live" : "Reconnecting…"}
                  >
                    {liveConnected ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                    {liveConnected ? "Live" : "Offline"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onMarkAll}
                  disabled={unread === 0}
                  data-testid="topbar-notifications-markall"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline disabled:text-slate-400 disabled:no-underline"
                >
                  <CheckCheck className="w-3 h-3" />
                  Mark all read
                </button>
              </header>

              <div className="max-h-[420px] overflow-y-auto">
                {loadingList ? (
                  <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-brand" />
                    Loading…
                  </div>
                ) : items.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-400">No notifications yet</div>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {items.map((n) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => onClickItem(n)}
                          data-testid={`topbar-notif-item-${n.id}`}
                          className={cn(
                            "w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors flex items-start gap-3",
                            !n.read && "bg-brand/5 dark:bg-brand/10"
                          )}
                        >
                          <span className={cn("mt-1.5 w-2 h-2 rounded-full shrink-0", n.read ? "bg-transparent" : "bg-brand")} />
                          <div className="min-w-0 flex-1">
                            <p
                              className={cn(
                                "text-xs truncate",
                                n.read ? "text-slate-700 dark:text-slate-300" : "text-slate-900 dark:text-white font-semibold"
                              )}
                            >
                              {n.title}
                            </p>
                            {n.body && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{n.body}</p>
                            )}
                            <p className="text-[10px] text-slate-400 font-mono mt-1">{formatRelative(n.created_at)}</p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <footer className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    navigate("/notifications");
                  }}
                  data-testid="topbar-notifications-viewall"
                  className="w-full text-center text-xs font-semibold text-brand hover:underline py-1.5"
                >
                  View all notifications
                </button>
              </footer>
            </div>
          </>,
          document.body
        )}
    </>
  );
}
