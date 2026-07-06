import { ReactNode, useState } from "react";
import { Menu, MessagesSquare, X } from "lucide-react";
import { cn } from "../../lib/cn";

type Props = {
  sidebar: ReactNode;
  children: ReactNode;
};

export function AgentChatLayout({ sidebar, children }: Props) {
  const [mobileSidebar, setMobileSidebar] = useState(false);
  return (
    <div className="flex-1 px-0 md:px-6 lg:px-10 py-0 md:py-6 w-full max-w-7xl mx-auto min-h-0">
      <div className="h-[calc(100vh-124px)] min-h-[520px] bg-white dark:bg-slate-900 md:border border-slate-200 dark:border-slate-800 md:rounded-2xl overflow-hidden flex relative">
        {/* Sidebar — desktop + mobile drawer */}
        <aside
          className={cn(
            "md:relative md:translate-x-0 md:block absolute inset-y-0 left-0 w-[85%] max-w-sm z-30 transform transition-transform duration-200",
            mobileSidebar ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {sidebar}
        </aside>
        {mobileSidebar && (
          <button
            type="button"
            aria-label="Close chats drawer"
            className="md:hidden absolute inset-0 bg-slate-950/40 z-20"
            onClick={() => setMobileSidebar(false)}
          />
        )}

        {/* Chat body */}
        <div className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-950 flex flex-col">
          {/* Mobile toggle bar */}
          <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <button
              type="button"
              data-testid="agent-chat-open-sidebar-btn"
              onClick={() => setMobileSidebar(true)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <MessagesSquare className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Chats</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
