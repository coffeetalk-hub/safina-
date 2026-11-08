import { format, parseISO } from "date-fns";

/** Intl inserts U+200F marks in Arabic dates which scramble digit order inside ltr spans. */
const clean = (s: string) => s.replace(/[\u200e\u200f]/g, "");

export const TZ = "Asia/Riyadh";

export function toDateOnly(d: Date | string): Date {
  const date = typeof d === "string" ? parseISO(d) : d;
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

export function formatDate(d: Date | string | null | undefined, locale = "ar"): string {
  if (!d) return "";
  const date = typeof d === "string" ? parseISO(d) : d;
  return clean(new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-nu-latn-ca-gregory" : "en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TZ,
  }).format(date));
}

export function formatDateTime(d: Date | string | null | undefined, locale = "ar"): string {
  if (!d) return "";
  const date = typeof d === "string" ? parseISO(d) : d;
  return clean(new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-nu-latn-ca-gregory" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TZ,
  }).format(date));
}

export function formatHijri(d: Date | string | null | undefined, locale = "ar"): string {
  if (!d) return "";
  const date = typeof d === "string" ? parseISO(d) : d;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-ca-islamic-umalqura-nu-latn" : "en-US-u-ca-islamic-umalqura", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: TZ,
  }).format(date);
}

export function isoDate(d: Date | string): string {
  const date = typeof d === "string" ? parseISO(d) : d;
  return format(date, "yyyy-MM-dd");
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((toDateOnly(b).getTime() - toDateOnly(a).getTime()) / 86_400_000);
}
