import { create } from "zustand";
import { AgentChatRecord, ChatMessage, WsEvent } from "../types";

type ChatState = {
  activeChatId: string | null;
  chatsByAgent: Record<string, AgentChatRecord[]>;
  messages: Record<string, ChatMessage[]>;
  events: Record<string, WsEvent[]>;
  setActive: (id: string | null) => void;
  setChats: (agent: string, chats: AgentChatRecord[]) => void;
  upsertChat: (agent: string, chat: AgentChatRecord) => void;
  removeChat: (agent: string, chatId: string) => void;
  hydrate: (id: string, msgs: ChatMessage[]) => void;
  addMessage: (id: string, msg: ChatMessage) => void;
  editMessage: (id: string, index: number, newContent: string) => void;
  deleteMessage: (id: string, index: number) => void;
  addEvent: (id: string, evt: WsEvent) => void;
  clearEvents: (id: string) => void;
  resetChat: (id: string) => void;
};

export const useChatStore = create<ChatState>((set) => ({
  activeChatId: null,
  chatsByAgent: {},
  messages: {},
  events: {},
  setActive: (id) => set({ activeChatId: id }),
  setChats: (agent, chats) =>
    set((state) => ({ chatsByAgent: { ...state.chatsByAgent, [agent]: chats } })),
  upsertChat: (agent, chat) =>
    set((state) => {
      const current = state.chatsByAgent[agent] ?? [];
      const idx = current.findIndex((c) => c.id === chat.id);
      const next = [...current];
      if (idx === -1) next.unshift(chat);
      else next[idx] = chat;
      next.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
      return { chatsByAgent: { ...state.chatsByAgent, [agent]: next } };
    }),
  removeChat: (agent, chatId) =>
    set((state) => ({
      chatsByAgent: {
        ...state.chatsByAgent,
        [agent]: (state.chatsByAgent[agent] ?? []).filter((c) => c.id !== chatId)
      }
    })),
  hydrate: (id, msgs) =>
    set((state) => ({
      messages: { ...state.messages, [id]: msgs },
      events: { ...state.events, [id]: [] }
    })),
  addMessage: (id, msg) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [id]: [...(state.messages[id] ?? []), msg]
      }
    })),
  editMessage: (id, index, newContent) =>
    set((state) => {
      const msgs = [...(state.messages[id] ?? [])];
      if (index >= 0 && index < msgs.length) {
        msgs[index] = { ...msgs[index], content: newContent };
      }
      return { messages: { ...state.messages, [id]: msgs } };
    }),
  deleteMessage: (id, index) =>
    set((state) => {
      const msgs = [...(state.messages[id] ?? [])];
      if (index >= 0 && index < msgs.length) {
        msgs.splice(index, 1);
      }
      return { messages: { ...state.messages, [id]: msgs } };
    }),
  addEvent: (id, evt) =>
    set((state) => ({
      events: {
        ...state.events,
        [id]: [...(state.events[id] ?? []), evt]
      }
    })),
  clearEvents: (id) =>
    set((state) => ({
      events: { ...state.events, [id]: [] }
    })),
  resetChat: (id) =>
    set((state) => {
      const { [id]: _m, ...messages } = state.messages;
      const { [id]: _e, ...events } = state.events;
      return { messages, events };
    })
}));

// Expose store on window for E2E / Playwright tests. Safe to ship — the
// frontend is an internal tool and the store only holds transient in-memory
// chat state (messages are already loaded via authenticated APIs).
if (typeof window !== "undefined") {
  // @ts-ignore — test hook
  (window as any).__CHAT_STORE__ = useChatStore;
}
