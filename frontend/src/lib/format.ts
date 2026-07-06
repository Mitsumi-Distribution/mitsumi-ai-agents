/**
 * Shared formatters used across department pages. Keeping them in one place so
 * currency / date formatting stays consistent.
 */

export function formatCurrency(value: number | undefined | null, currency = "USD"): string {
  const num = typeof value === "number" ? value : 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0
    }).format(num);
  } catch {
    return `$${num}`;
  }
}

export function formatNumber(value: number | undefined | null): string {
  const num = typeof value === "number" ? value : 0;
  return new Intl.NumberFormat("en-US").format(num);
}

// Configured timezone — matches backend GOOGLE_CALENDAR_TIMEZONE
const APP_TIMEZONE = "Africa/Nairobi";

export function formatRelative(value: string | undefined | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(diffDays) < 1) {
    const diffHrs = Math.round(diffMs / (1000 * 60 * 60));
    if (Math.abs(diffHrs) < 1) {
      const diffMins = Math.round(diffMs / (1000 * 60));
      return rtf.format(diffMins, "minute");
    }
    return rtf.format(diffHrs, "hour");
  }
  if (Math.abs(diffDays) < 30) return rtf.format(diffDays, "day");
  const diffMonths = Math.round(diffDays / 30);
  return rtf.format(diffMonths, "month");
}

export function formatDate(value: string | undefined | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: APP_TIMEZONE });
}

export function formatDateTime(value: string | undefined | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
    timeZone: APP_TIMEZONE, timeZoneName: "short",
  });
}

export function formatTime(value: string | undefined | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: true,
    timeZone: APP_TIMEZONE, timeZoneName: "short",
  });
}
