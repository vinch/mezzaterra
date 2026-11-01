/**
 * Dates « calendrier » (colonnes `date` Postgres, sans fuseau) : on les parse en local
 * pour éviter qu'un `new Date("2026-10-16")` (UTC) ne recule d'un jour selon le fuseau.
 */

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** « 2026-10-16 » à partir d'une date ou d'un horodatage ISO (champs `<input type="date">`) ; "" si vide. */
export function isoDateOnly(value: string | null | undefined): string {
  return value ? value.split("T")[0] : "";
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** « 2026-10-16 » : jour local de `d` (pas `toISOString`, qui passe en UTC). */
function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

export function addDaysIso(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

const longDate = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const shortMonth = new Intl.DateTimeFormat("fr-FR", { month: "short" });

/** « oct » : mois abrégé, sans point. */
export function formatShortMonth(d: Date): string {
  return shortMonth.format(d).replace(".", "");
}

export function formatDateLong(iso: string): string {
  const s = longDate.format(parseIsoDate(iso));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatDayMonth(iso: string): { day: string; month: string; year: string } {
  const d = parseIsoDate(iso);
  return {
    day: String(d.getDate()),
    month: formatShortMonth(d),
    year: String(d.getFullYear()),
  };
}

/** « 19h30 » à partir de « 19:30:00 ». */
export function formatTime(time: string | null | undefined): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  return m && m !== "00" ? `${Number(h)}h${m}` : `${Number(h)}h`;
}

/** Nombre de jours entre aujourd'hui et `iso` (négatif si passé). */
export function daysUntil(iso: string): number {
  const today = parseIsoDate(todayIso()).getTime();
  return Math.round((parseIsoDate(iso).getTime() - today) / 86_400_000);
}

/** « Aujourd’hui », « Demain », « Dans 5 jours » pour un écart `daysUntil` positif ou nul. */
export function daysAwayLabel(delta: number): string {
  return delta === 0 ? "Aujourd’hui" : delta === 1 ? "Demain" : `Dans ${delta} jours`;
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function icsLocal(date: string, time: string): string {
  const [h = "19", m = "00"] = time.split(":");
  return `${date.replace(/-/g, "")}T${h.padStart(2, "0")}${m.padStart(2, "0")}00`;
}

/** Fichier .ics (heure locale « flottante », durée par défaut 3 h). */
export function buildIcs(opts: {
  uid: string;
  title: string;
  date: string;
  time?: string | null;
  location?: string | null;
  description?: string | null;
  url?: string;
  durationHours?: number;
}): string {
  const time = opts.time || "19:00";
  const start = parseIsoDate(opts.date);
  const [h, m] = time.split(":").map(Number);
  start.setHours(h || 19, m || 0, 0, 0);
  const end = new Date(start.getTime() + (opts.durationHours ?? 3) * 3_600_000);
  const endTime = `${pad2(end.getHours())}:${pad2(end.getMinutes())}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mezzaterra//Degustations//FR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${opts.uid}@mezzaterra`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${icsLocal(opts.date, time)}`,
    `DTEND:${icsLocal(toIsoDate(end), endTime)}`,
    `SUMMARY:${icsEscape(opts.title)}`,
  ];
  if (opts.location) lines.push(`LOCATION:${icsEscape(opts.location)}`);
  const desc = [opts.description, opts.url].filter(Boolean).join("\n\n");
  if (desc) lines.push(`DESCRIPTION:${icsEscape(desc)}`);
  if (opts.url) lines.push(`URL:${opts.url}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Heure (locale) jusqu'à laquelle une soirée de la veille est encore considérée « en direct ». */
export const LIVE_GRACE_HOUR = 6;

/** Dégustation en cours : le jour même, ou la nuit suivante jusqu'à 6 h. */
export function isLiveNow(iso: string, now = new Date()): boolean {
  const d = daysUntil(iso);
  return d === 0 || (d === -1 && now.getHours() < LIVE_GRACE_HOUR);
}

/** Les produits d'une dégustation ne sont dévoilés sur le site qu'une fois la soirée terminée (après 6 h le lendemain). */
export function productsRevealed(iso: string, now = new Date()): boolean {
  return daysUntil(iso) < 0 && !isLiveNow(iso, now);
}
