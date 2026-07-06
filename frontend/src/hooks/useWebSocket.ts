import { useEffect, useRef, useState } from "react";
import { useSessionStore } from "../store/session";
import { useChatStore } from "../store/chat";
import { WsEvent } from "../types";

const WS_BASE = import.meta.env.VITE_WS_BASE ?? "ws://localhost:8000";

const RECONNECT_DELAYS = [2000, 4000, 8000, 15000, 15000, 30000]; // backoff steps
const PING_INTERVAL = 20000;

export function useWebSocket(agentName: string, chatId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [llmReady, setLlmReady] = useState<boolean | null>(null);
  const [modelName, setModelName] = useState<string>("");
  const [modelTier, setModelTier] = useState<string>("");

  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const closedRef = useRef(false); // true once cleanup runs

  // Stable refs for values that change but shouldn't trigger reconnect
  const agentRef = useRef(agentName);
  const chatRef = useRef(chatId);
  const tokenRef = useRef(useSessionStore.getState().token);
  agentRef.current = agentName;
  chatRef.current = chatId;
  tokenRef.current = useSessionStore.getState().token;

  useEffect(() => {
    closedRef.current = false;

    function cleanup() {
      closedRef.current = true;
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null; }
      if (wsRef.current) {
        try { wsRef.current.onclose = null; wsRef.current.close(); } catch {}
        wsRef.current = null;
      }
      setConnected(false);
      setLlmReady(null);
    }

    function open() {
      if (closedRef.current) return;
      const tok = tokenRef.current;
      const cid = chatRef.current;
      const agent = agentRef.current;
      if (!tok || !cid) return;

      // Tear down any previous socket cleanly
      if (wsRef.current) {
        try { wsRef.current.onclose = null; wsRef.current.close(); } catch {}
        wsRef.current = null;
      }

      const url = `${WS_BASE}/api/ws/${agent}/chat/${cid}?token=${encodeURIComponent(tok)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (closedRef.current) { ws.close(); return; }
        setConnected(true);
        attemptRef.current = 0;

        // Keepalive pings
        if (pingRef.current) clearInterval(pingRef.current);
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try { ws.send(JSON.stringify({ _ping: true })); } catch {}
          }
        }, PING_INTERVAL);
      };

      ws.onclose = () => {
        if (closedRef.current) return;
        setConnected(false);
        if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null; }

        // Schedule reconnect with backoff
        const idx = Math.min(attemptRef.current, RECONNECT_DELAYS.length - 1);
        const delay = RECONNECT_DELAYS[idx];
        attemptRef.current++;
        timerRef.current = setTimeout(() => {
          if (!closedRef.current) open();
        }, delay);
      };

      ws.onerror = () => {
        // onclose fires after onerror — handled there
      };

      ws.onmessage = (evt) => {
        if (closedRef.current) return;
        try {
          const data = JSON.parse(evt.data);
          if (data.type === "ready") {
            setLlmReady(Boolean(data.llm));
            if (data.model) setModelName(data.model);
            if (data.model_tier) setModelTier(data.model_tier);
            return;
          }
          if (data.type === "pong") return;
          if (data.type === "title") {
            const store = useChatStore.getState();
            const cur = (store.chatsByAgent[agentRef.current] ?? []).find((c) => c.id === data.chat_id);
            if (cur) store.upsertChat(agentRef.current, { ...cur, title: data.value });
            return; // Don't add title events to the chat events array
          }
          // Use getState() to avoid stale closure
          useChatStore.getState().addEvent(chatRef.current, data);
        } catch {}
      };
    }

    open();
    return cleanup;
    // Only reconnect when agent or chatId *actually* change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentName, chatId]);

  function sendMessage(message: string) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ message }));
    }
  }

  function sendControl(action: "pause" | "resume" | "stop") {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action }));
    }
  }

  return { connected, llmReady, modelName, modelTier, sendMessage, sendControl };
}
