export type ClassValue = string | number | boolean | null | undefined | ClassValue[];

export function cn(...values: ClassValue[]): string {
  const out: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (Array.isArray(value)) {
      const nested = cn(...value);
      if (nested) out.push(nested);
    } else if (typeof value === "string") {
      out.push(value);
    } else if (typeof value === "number") {
      out.push(String(value));
    }
  }
  return out.join(" ");
}
