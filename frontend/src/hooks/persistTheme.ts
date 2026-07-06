import { updatePreferences } from "../api/client";
import type { Theme } from "./useTheme";

/**
 * Persist the theme change to the server preferences *and* apply it locally.
 *
 * The PATCH is fire-and-forget — if the call fails (e.g. offline) we don't
 * block the UX; the next explicit Save on the Preferences page will reconcile.
 */
export function persistThemeToServer(next: Theme): void {
  updatePreferences({ theme: next }).catch(() => {
    /* swallow — local change still applies via localStorage + document class */
  });
}
