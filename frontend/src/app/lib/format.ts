const TZ = "Asia/Kolkata";
const ampm = (s: string) => s.replace(/\s?(am|pm)/i, (m) => " " + m.trim().toUpperCase());

const fHour = new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: true, timeZone: TZ });
const fTime = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ });
const fDay = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
const fDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });

/** "3 PM" (India time) */
export const fmtHour = (ms: number) => ampm(fHour.format(new Date(ms)));
/** "3:05 PM" */
export const fmtTime = (ms: number) => ampm(fTime.format(new Date(ms)));
/** "Tue, 13 Oct" */
export const fmtDay = (ms: number) => fDay.format(new Date(ms));
/** "13 Oct 2026" */
export const fmtDate = (ms: number) => fDate.format(new Date(ms));

export function fmtLead(lead: number) {
  if (lead === 0) return "Now";
  return lead < 0 ? `${lead} h` : `+${lead} h`;
}

export function fmtPct(v: number, digits = 0) {
  const s = Math.abs(v).toFixed(digits);
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${s}%`;
}

export function fmtNum(v: number | null | undefined, digits = 0) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

/** People, from millions: "33.8 M", "850 K". */
export function fmtPop(millions: number) {
  if (millions >= 1) return `${millions.toFixed(1)} M`;
  return `${Math.round(millions * 1000)} K`;
}

/** "4 min ago", "2 h ago" */
export function fmtAgo(ms: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
}

/** Seconds → "11 h 52 min" / "4 min 10 s" */
export function fmtCountdown(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h} h ${String(m).padStart(2, "0")} min`;
  return `${m} min ${String(Math.floor(s % 60)).padStart(2, "0")} s`;
}
