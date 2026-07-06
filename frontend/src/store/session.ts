import { create } from "zustand";
import { CurrentUser } from "../types";

const TOKEN_STORAGE_KEY = "mitsumi.auth.token";
const MANUAL_SIGNOUT_KEY = "mitsumi.auth.manual_signout";

function readStoredToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function persistToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    /* storage unavailable */
  }
}

function setManualSignOut(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      localStorage.setItem(MANUAL_SIGNOUT_KEY, "1");
    } else {
      localStorage.removeItem(MANUAL_SIGNOUT_KEY);
    }
  } catch {
    /* storage unavailable */
  }
}

export function hasManualSignOut(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(MANUAL_SIGNOUT_KEY) === "1";
  } catch {
    return false;
  }
}

type SessionState = {
  token: string;
  user: CurrentUser | null;
  setToken: (token: string) => void;
  setUser: (user: CurrentUser | null) => void;
  signOut: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  token: readStoredToken(),
  user: null,
  setToken: (token) => {
    persistToken(token);
    if (token) {
      setManualSignOut(false);
    }
    set({ token });
  },
  setUser: (user) => set({ user }),
  signOut: () => {
    persistToken("");
    setManualSignOut(true);
    set({ token: "", user: null });
  }
}));

export function canAccessModule(user: CurrentUser | null, module: string): boolean {
  if (!user) return false;
  if (user.is_super_admin) return true;
  return user.modules.includes(module);
}
