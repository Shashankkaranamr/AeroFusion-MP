import { HOUR_MS, type Hour } from "./sim/core";

const TZ = "Asia/Kolkata";

const fHour = new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: true, timeZone: TZ });
const fTime = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ });
const fDay = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: TZ });
const fWeekday = new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: TZ });
const fDateTime = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: TZ,
});
const fMonth = new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: TZ });
const fMonthYear = new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit", timeZone: TZ });

const d = (t: Hour) => new Date(t * HOUR_MS);

/** "3 pm" → "3 PM" */
export const fmtHour = (t: Hour) => fHour.format(d(t)).replace(/\s?(am|pm)/i, (m) => " " + m.trim().toUpperCase());
export const fmtTime = (t: Hour) => fTime.format(d(t)).replace(/\s?(am|pm)/i, (m) => " " + m.trim().toUpperCase());
export const fmtDay = (t: Hour) => fDay.format(d(t));
export const fmtWeekday = (t: Hour) => fWeekday.format(d(t));
export const fmtDateTime = (t: Hour) => fDateTime.format(d(t)).replace(/\s?(am|pm)/i, (m) => " " + m.trim().toUpperCase());
export const fmtMonth = (t: Hour) => fMonth.format(d(t));
export const fmtMonthYear = (t: Hour) => fMonthYear.format(d(t));

export const fmtDateTimeMs = (ms: number) =>
  fDateTime.format(new Date(ms)).replace(/\s?(am|pm)/i, (m) => " " + m.trim().toUpperCase());

export function fmtLead(lead: number) {
  if (lead === 0) return "Now";
  if (lead < 0) return `${lead}h`;
  return `+${lead}h`;
}

export function fmtPct(v: number, digits = 0) {
  const s = Math.abs(v).toFixed(digits);
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${s}%`;
}

export function fmtNum(v: number, digits = 0) {
  return v.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function fmtPop(millions: number) {
  if (millions >= 1) return `${millions.toFixed(1)}M`;
  return `${Math.round(millions * 1000)}K`;
}
