import { useEffect, useState } from "react";
import { directLogin, fetchMe } from "../api/client";
import { hasManualSignOut, useSessionStore } from "../store/session";

const DEV_AUTO_LOGIN_ENABLED =
  (import.meta.env.VITE_DEV_AUTO_LOGIN ?? "true").toString().toLowerCase() !== "false";
const DEV_EMAIL = import.meta.env.VITE_DEV_AUTO_LOGIN_EMAIL ?? "francis@mitsumidistribution.com";
const DEV_PASSWORD = import.meta.env.VITE_DEV_AUTO_LOGIN_PASSWORD ?? "";

export type AuthBootstrapStatus = "idle" | "loading" | "ready" | "error";

/**
 * Ensures the app boots with a valid session.
 *
 * - If we already have a cached token, we validate it via /auth/me.
 * - Otherwise (and when dev auto-login is on) we call the direct-login
 *   endpoint with the seeded super-admin credentials.
 */
export function useAuthBootstrap() {
  const token = useSessionStore((s) => s.token);
  const user = useSessionStore((s) => s.user);
  const setToken = useSessionStore((s) => s.setToken);
  const setUser = useSessionStore((s) => s.setUser);
  const signOut = useSessionStore((s) => s.signOut);

  const [status, setStatus] = useState<AuthBootstrapStatus>(token && user ? "ready" : "idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setStatus("loading");
      setError(null);
      try {
        if (token) {
          const me = await fetchMe();
          if (cancelled) return;
          setUser(me);
          setStatus("ready");
          return;
        }

        if (!DEV_AUTO_LOGIN_ENABLED) {
          if (cancelled) return;
          setStatus("ready");
          return;
        }

        if (hasManualSignOut()) {
          if (cancelled) return;
          setStatus("ready");
          return;
        }

        const res = await directLogin(DEV_EMAIL, DEV_PASSWORD);
        if (cancelled) return;
        setToken(res.access_token);
        if (res.user) {
          setUser(res.user);
        } else {
          const me = await fetchMe();
          if (cancelled) return;
          setUser(me);
        }
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Auto-login failed";
        signOut();
        setError(message);
        setStatus("error");
      }
    }

    if (status === "ready") return;
    bootstrap();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, error };
}
