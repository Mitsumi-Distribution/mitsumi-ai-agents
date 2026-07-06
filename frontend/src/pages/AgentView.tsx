import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileText, Lock, MessageSquare } from "lucide-react";
import { AgentChat } from "../components/chat/AgentChat";
import { ChatHistorySidebar } from "../components/chat/ChatHistorySidebar";
import { ChatDocsPanel } from "../components/chat/ChatDocsPanel";
import { useAgent } from "../hooks/useAgent";
import { useWebSocket } from "../hooks/useWebSocket";
import { canAccessModule, useSessionStore } from "../store/session";
import { EmptyState } from "../components/ui/EmptyState";
import { useNavigate, useParams } from "react-router-dom";
import { createChat, deleteChat, getChat, listChats, pinChat, renameChat } from "../api/client";
import { useChatStore } from "../store/chat";
import { cn } from "../lib/cn";
import { ThemeToggle } from "../components/layout/ThemeToggle";

const EMPTY_CHATS: never[] = [];

export function AgentView() {
  const { name } = useAgent();
  const params = useParams();
  const chatId = params.chatId ?? "";
  const navigate = useNavigate();
  const user = useSessionStore((state) => state.user);
  const hydrate = useChatStore((state) => state.hydrate);
  const setChats = useChatStore((state) => state.setChats);
  const setActive = useChatStore((state) => state.setActive);
  const upsertChat = useChatStore((state) => state.upsertChat);
  const removeChat = useChatStore((state) => state.removeChat);
  const chatsByAgent = useChatStore((state) => state.chatsByAgent);
  const chats = useMemo(() => chatsByAgent[name] ?? EMPTY_CHATS, [chatsByAgent, name]);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rightPanel, setRightPanel] = useState<"none" | "docs">("none");
  const { connected, llmReady, modelName, modelTier, sendMessage, sendControl } = useWebSocket(name, chatId);
  // When the WS hasn't yet emitted a `ready` frame (e.g. no chat selected, or
  // WS still connecting), fall back to the server flag on the CurrentUser
  // payload so the chat header / banner still surfaces the LLM-missing state.
  const effectiveLlmReady: boolean | null =
    llmReady !== null ? llmReady : user?.server_flags?.llm_ready ?? null;

  const agentLabel = name.charAt(0).toUpperCase() + name.slice(1);
  const allowed = canAccessModule(user, `agent:${name}`);

  useEffect(() => {
    if (!allowed || !chatId) return;
    setActive(chatId);
    let cancelled = false;
    async function hydrateChat() {
      try {
        const detail = await getChat(chatId);
        if (cancelled) return;
        hydrate(
          chatId,
          (detail.messages ?? []).map((m) => ({
            role: m.role,
            content: m.content
          }))
        );
        upsertChat(name, detail);
      } catch {
        if (!cancelled) navigate(`/agent/${name}`, { replace: true });
      }
    }
    hydrateChat();
    return () => {
      cancelled = true;
    };
  }, [allowed, chatId, hydrate, navigate, name, setActive, upsertChat]);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    async function loadChats() {
      const rows = await listChats(name, query);
      if (!cancelled) setChats(name, rows);
    }
    loadChats();
    return () => {
      cancelled = true;
    };
  }, [allowed, name, query, setChats]);

  if (!allowed) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center px-6 gap-4">
        <EmptyState
          icon={<Lock className="w-6 h-6" />}
          title="You don't have access to this agent"
          description="Ask a super admin to grant you the module permission for this agent."
        />
        <button
          type="button"
          onClick={() => navigate("/")}
          className="text-sm font-semibold text-brand hover:underline"
        >
          ← Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Mini topbar — just Back + title + theme */}
      <header
        className="shrink-0 flex items-center gap-3 px-3 md:px-5 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800"
        data-testid={`agent-page-topbar-${name}`}
      >
        <button
          type="button"
          onClick={() => navigate("/")}
          data-testid="agent-page-back-btn"
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0">
          <p className="text-sm font-display font-semibold text-slate-900 dark:text-white truncate">
            {agentLabel} Agent
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
            {chatId ? `Chat ${chatId.slice(0, 8)}` : "No chat selected"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      {/* Body — sidebar + chat (sidebar collapses to drawer on mobile) */}
      <div className="flex-1 min-h-0 flex relative overflow-hidden">
        {/* Sidebar */}
        <aside
          className={cn(
            "md:relative md:translate-x-0 md:block absolute inset-y-0 left-0 z-30 w-[85%] max-w-sm transform transition-transform duration-200",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
          data-testid="agent-page-sidebar"
        >
          <ChatHistorySidebar
            agentName={name}
            activeChatId={chatId}
            chats={chats}
            query={query}
            onQueryChange={setQuery}
            onCreate={async () => {
              const newChat = await createChat(name);
              upsertChat(name, newChat);
              setSidebarOpen(false);
              navigate(`/agent/${name}/c/${newChat.id}`);
            }}
            onRename={async (id, title) => {
              const updated = await renameChat(id, title);
              upsertChat(name, updated);
            }}
            onTogglePin={async (id, pinned) => {
              const updated = await pinChat(id, !pinned);
              upsertChat(name, updated);
            }}
            onDelete={async (id) => {
              await deleteChat(id);
              removeChat(name, id);
              if (id === chatId) {
                navigate(`/agent/${name}`, { replace: true });
              }
            }}
          />
        </aside>
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close chats drawer"
            className="md:hidden absolute inset-0 bg-slate-950/40 z-20"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Chat pane */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Mobile: open-sidebar toggle */}
          <div className="md:hidden flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <button type="button" data-testid="agent-page-open-sidebar-btn" onClick={() => setSidebarOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-brand">
              <MessageSquare className="w-3.5 h-3.5" /> Chats
            </button>
            <button type="button" onClick={() => setRightPanel(rightPanel === "docs" ? "none" : "docs")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-brand">
              <FileText className="w-3.5 h-3.5" /> Docs
            </button>
          </div>
          <div className="flex-1 min-h-0 flex overflow-hidden">
            <div className="flex-1 min-w-0 h-full">
              <AgentChat
                agentName={name}
                chatId={chatId}
                connected={connected}
                llmReady={effectiveLlmReady}
                modelName={modelName}
                modelTier={modelTier}
                docsOpen={rightPanel === "docs"}
                onToggleDocs={() => setRightPanel(rightPanel === "docs" ? "none" : "docs")}
                sendMessage={sendMessage}
                sendControl={sendControl}
              />
            </div>
            {/* Docs & Notes panel (right) */}
            {rightPanel === "docs" && (
              <aside className="w-72 border-l border-slate-200 dark:border-slate-800 hidden md:block">
                <ChatDocsPanel chatId={chatId} agentName={name} />
              </aside>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
