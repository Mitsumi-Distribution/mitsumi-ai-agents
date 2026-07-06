import { useMemo, useState } from "react";
import { MessageSquarePlus, Search } from "lucide-react";
import { NavLink } from "react-router-dom";
import { AgentChatRecord } from "../../types";
import { ChatRowMenu } from "./ChatRowMenu";
import { cn } from "../../lib/cn";

/** Strip markdown syntax for preview text (sidebar) */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")  // bold
    .replace(/\*(.+?)\*/g, "$1")       // italic
    .replace(/`([^`]+)`/g, "$1")       // code
    .replace(/^#{1,4}\s+/gm, "")       // headings
    .replace(/^\s*[-*]\s+/gm, "")      // bullets
    .replace(/^\s*\d+\.\s+/gm, "");    // numbered
}

type Props = {
  agentName: string;
  activeChatId: string;
  chats: AgentChatRecord[];
  query: string;
  onQueryChange: (query: string) => void;
  onCreate: () => void;
  onRename: (chatId: string, title: string) => Promise<void>;
  onTogglePin: (chatId: string, pinned: boolean) => Promise<void>;
  onDelete: (chatId: string) => Promise<void>;
};

type Group = { title: string; chats: AgentChatRecord[] };

function dayDiff(from: Date, to: Date): number {
  const midnightA = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const midnightB = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.floor((midnightA - midnightB) / (1000 * 60 * 60 * 24));
}

export function ChatHistorySidebar({
  agentName,
  activeChatId,
  chats,
  query,
  onQueryChange,
  onCreate,
  onRename,
  onTogglePin,
  onDelete
}: Props) {
  const [localQuery, setLocalQuery] = useState(query);

  const pinned = chats.filter((chat) => chat.pinned);
  const grouped = useMemo<Group[]>(() => {
    const now = new Date();
    const buckets: Record<string, AgentChatRecord[]> = {
      Today: [],
      Yesterday: [],
      "Previous 7 days": [],
      Older: []
    };
    chats
      .filter((chat) => !chat.pinned)
      .forEach((chat) => {
        const d = dayDiff(now, new Date(chat.updated_at));
        if (d <= 0) buckets.Today.push(chat);
        else if (d === 1) buckets.Yesterday.push(chat);
        else if (d <= 7) buckets["Previous 7 days"].push(chat);
        else buckets.Older.push(chat);
      });
    return Object.entries(buckets)
      .map(([title, items]) => ({ title, chats: items }))
      .filter((group) => group.chats.length > 0);
  }, [chats]);

  return (
    <aside className="w-full md:w-[290px] h-full border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
      <div className="sticky top-0 z-10 backdrop-blur-sm bg-white/90 dark:bg-slate-900/90 p-3 border-b border-slate-100 dark:border-slate-800 space-y-2">
        <button
          type="button"
          onClick={onCreate}
          data-testid={`agent-chat-new-chat-btn`}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand hover:bg-brand-light text-white text-sm font-semibold"
        >
          <MessageSquarePlus className="w-4 h-4" />
          New chat
        </button>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onQueryChange(localQuery);
            }}
            onBlur={() => onQueryChange(localQuery)}
            placeholder={`Search ${agentName} chats`}
            className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {pinned.length > 0 && (
          <section className="space-y-1">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Pinned</p>
            {pinned.map((chat) => (
              <ChatRow
                key={chat.id}
                chat={chat}
                active={chat.id === activeChatId}
                onRename={(title) => onRename(chat.id, title)}
                onTogglePin={() => onTogglePin(chat.id, chat.pinned)}
                onDelete={() => onDelete(chat.id)}
              />
            ))}
          </section>
        )}

        {grouped.map((group) => (
          <section key={group.title} className="space-y-1">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">{group.title}</p>
            {group.chats.map((chat) => (
              <ChatRow
                key={chat.id}
                chat={chat}
                active={chat.id === activeChatId}
                onRename={(title) => onRename(chat.id, title)}
                onTogglePin={() => onTogglePin(chat.id, chat.pinned)}
                onDelete={() => onDelete(chat.id)}
              />
            ))}
          </section>
        ))}
      </div>
    </aside>
  );
}

function ChatRow({
  chat,
  active,
  onRename,
  onTogglePin,
  onDelete
}: {
  chat: AgentChatRecord;
  active: boolean;
  onRename: (title: string) => Promise<void>;
  onTogglePin: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  return (
    <NavLink
      to={`/agent/${chat.agent_name}/c/${chat.id}`}
      className={cn(
        "group relative flex items-start gap-2 rounded-lg px-2 py-2 border border-transparent",
        active
          ? "bg-brand-subtle dark:bg-brand-glow/30 text-brand"
          : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
      )}
    >
      {active && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-brand" aria-hidden />}
      <div className="min-w-0 flex-1 pl-1">
        <p className="truncate text-xs font-semibold">{chat.title || "Untitled chat"}</p>
        <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
          {stripMarkdown(chat.last_message_preview || "No messages yet")}
        </p>
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <ChatRowMenu
          pinned={chat.pinned}
          title={chat.title}
          onRename={onRename}
          onTogglePin={onTogglePin}
          onDelete={onDelete}
        />
      </div>
    </NavLink>
  );
}
