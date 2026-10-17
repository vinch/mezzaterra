/** Formats d'affichage de l'outil (montants belges, dates JJ/MM/AAAA). */

const eur = new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" });

/** « 1 234,50 € » — l'unique helper de montant de l'outil. */
export function formatEUR(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? parseFloat(n.replace(",", ".")) : n;
  if (v == null || !Number.isFinite(v)) return "—";
  return eur.format(v);
}

/** « 17/10/2026 » à partir d'une date ISO (sans décalage de fuseau). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

/** Initiales pour les pastilles client (« AC »). */
export function initials(first?: string | null, last?: string | null): string {
  return `${(first || "").trim().charAt(0)}${(last || "").trim().charAt(0)}`.toUpperCase() || "?";
}
