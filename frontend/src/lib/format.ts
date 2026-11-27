import { format, parseISO } from "date-fns";

/** US$12,400. Whole dollars, always with the currency (G8). */
export function usd(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}US$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
}

function trimmed(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "");
}

/** US$48k, US$41.5k, US$1.2M. Below 1,000 it's the full amount. */
export function usdShort(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs < 1000) return usd(n);
  if (abs < 999_950) return `${sign}US$${trimmed(abs / 1000)}k`;
  return `${sign}US$${trimmed(abs / 1_000_000)}M`;
}

export function percent(n: number): string {
  return `${Math.round(n)}%`;
}

/** Dates come from the API as YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS, with no time zone. */
function toDate(d: string | Date): Date {
  return typeof d === "string" ? parseISO(d) : d;
}

/** 12 Mar 2026 */
export function formatDate(d: string | Date): string {
  return format(toDate(d), "d MMM yyyy");
}

/** 12 Mar 2026, 14:30 */
export function formatDateTime(t: string | Date): string {
  return format(toDate(t), "d MMM yyyy, HH:mm");
}

/** 14:30 */
export function formatTime(t: string | Date): string {
  return format(toDate(t), "HH:mm");
}

/** "Today", "Yesterday", or the date. `today` is the backend's (from /api/meta). */
export function relativeDay(d: string, today: string): string {
  const day = d.slice(0, 10);
  if (day === today.slice(0, 10)) return "Today";
  const yesterday = format(new Date(parseISO(today).getTime() - 86_400_000), "yyyy-MM-dd");
  if (day === yesterday) return "Yesterday";
  return formatDate(day);
}

/** "1 deal", "2 deals", "1 activity", "3 activities". */
export function plural(n: number, word: string): string {
  if (n === 1) return `1 ${word}`;
  const many = word.endsWith("y") ? `${word.slice(0, -1)}ies` : `${word}s`;
  return `${n} ${many}`;
}

/** The value for an <input type="datetime-local">: YYYY-MM-DDTHH:MM. */
export function toDateTimeInput(t: string): string {
  return t.slice(0, 16);
}
