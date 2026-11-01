/** Formats d'affichage du site et de l'outil (montants belges, dates JJ/MM/AAAA). */

const eur = new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" });
const eurRound = new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** « 1 234,50 € » (ou « 1 235 € » avec `round`) — l'unique helper de montant du site et de l'outil. */
export function formatEUR(n: number | string | null | undefined, round = false): string {
  const v = typeof n === "string" ? parseFloat(n.replace(",", ".")) : n;
  if (v == null || !Number.isFinite(v)) return "—";
  return (round ? eurRound : eur).format(v);
}

/** « 17/10/2026 » à partir d'une date ISO (sans décalage de fuseau). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

const decimal = new Intl.NumberFormat("fr-BE", { maximumFractionDigits: 2 });

/** « 12,5 % » : pourcentage à la virgule décimale, comme les montants. */
export function formatPercent(n: number): string {
  return `${decimal.format(n)} %`;
}

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

/** « 17/10/2026 19:30 » à partir d'un horodatage ISO (heure locale) ; « — » si vide ou illisible. */
export function formatDateTime(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? dateTime.format(d) : "—";
}

/** Montant saisi ou renvoyé par PostgREST (number ou string, virgule décimale FR) ; 0 si invalide. */
export function toNumber(value: unknown): number {
  if (value == null || value === "") return 0;
  const n = typeof value === "number" ? value : parseFloat(String(value).trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Texte de recherche : sans accents, en minuscules. */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Initiales pour les pastilles client (« AC »). */
export function initials(first?: string | null, last?: string | null): string {
  return `${(first || "").trim().charAt(0)}${(last || "").trim().charAt(0)}`.toUpperCase() || "?";
}
