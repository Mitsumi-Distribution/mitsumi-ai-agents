import { create } from "zustand";
import { useMemo } from "react";

export type ToastTone = "success" | "error" | "info" | "warning";

export type Toast = {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
};

type ToastState = {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id">, timeoutMs?: number) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (toast, timeoutMs = 5000) => {
    // Dedupe: if a toast with the same title is currently on-screen, skip it.
    const existing = get().toasts.find((t) => t.title === toast.title && t.tone === toast.tone);
    if (existing) return existing.id;
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    if (timeoutMs > 0) {
      window.setTimeout(() => get().dismiss(id), timeoutMs);
    }
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] })
}));

export function useToast() {
  const push = useToastStore((s) => s.push);
  // Stable wrappers so consumers can safely depend on the result in effects.
  return useMemo(
    () => ({
      success: (title: string, description?: string) => push({ tone: "success", title, description }),
      error: (title: string, description?: string) => push({ tone: "error", title, description }),
      info: (title: string, description?: string) => push({ tone: "info", title, description }),
      warning: (title: string, description?: string) => push({ tone: "warning", title, description })
    }),
    [push]
  );
}
