/**
 * Helpers d'affichage des vins, partagés par le site public, le live et l'admin.
 */

export type WineStyleKey = "red" | "white" | "rose" | "orange" | "sparkling" | "other";

export type WineStyle = {
  key: WineStyleKey;
  label: string;
  /** Couleur de robe principale. */
  color: string;
  /** Variante claire (fonds, reflets). */
  light: string;
};

const STYLES: Record<WineStyleKey, WineStyle> = {
  red: { key: "red", label: "Rouge", color: "#7a1f2e", light: "#b04456" },
  white: { key: "white", label: "Blanc", color: "#d8bf62", light: "#efe2a6" },
  rose: { key: "rose", label: "Rosé", color: "#e0879a", light: "#f3c3cb" },
  orange: { key: "orange", label: "Orange", color: "#d07b2c", light: "#ecb57f" },
  sparkling: { key: "sparkling", label: "Pétillant", color: "#e2cf7f", light: "#f4ebc4" },
  other: { key: "other", label: "Vin", color: "#5b7d7f", light: "#a9bfc0" },
};

/** Ordre « du plus léger au plus corsé » pour trier ou dessiner un dégradé. */
export const STYLE_ORDER: WineStyleKey[] = ["sparkling", "white", "orange", "rose", "red", "other"];

type TypeLike = { name?: string | null; category?: string | null } | null | undefined;

export function wineStyle(type: TypeLike): WineStyle {
  const name = (type?.name || "").toLowerCase().trim();
  const category = (type?.category || "").toLowerCase().trim();
  if (category.includes("sparkling") || category.includes("pétillant") || name.includes("sparkling")) {
    return STYLES.sparkling;
  }
  if (name.startsWith("red") || name.startsWith("rouge")) return STYLES.red;
  if (name.startsWith("white") || name.startsWith("blanc")) return STYLES.white;
  if (name.startsWith("ros")) return STYLES.rose;
  if (name.startsWith("orange")) return STYLES.orange;
  return STYLES.other;
}

export function allWineStyles(): WineStyle[] {
  return STYLE_ORDER.map((k) => STYLES[k]);
}

type AppellationLike = {
  name?: string | null;
  label?: { name?: string | null } | null;
} | null;

export type WineLike = {
  id?: string;
  name?: string | null;
  description?: string | null;
  appelation?: AppellationLike;
  winery?: { name?: string | null } | null;
  wine_type?: TypeLike;
} | null | undefined;

export function appellationText(ap: AppellationLike | undefined): string {
  if (!ap) return "";
  return [ap.name, ap.label?.name].filter(Boolean).join(" ").trim();
}

/** Nom principal d'un vin : son nom, sinon son appellation. */
export function wineTitle(wine: WineLike): string {
  if (wine?.name?.trim()) return wine.name.trim();
  return appellationText(wine?.appelation) || "Vin sans nom";
}

/** Ligne secondaire : appellation quand le titre est un nom de cuvée. */
export function wineSubtitle(wine: WineLike): string {
  if (!wine?.name?.trim()) return "";
  return appellationText(wine?.appelation);
}

/** « Domaine — Cuvée — 2022 » (libellé compact pour l'admin, la recherche…). */
export function vintageLabel(v: {
  year?: number | null;
  production_year?: number | null;
  wine?: WineLike;
} | null | undefined): string {
  if (!v) return "—";
  const parts = [v.wine?.winery?.name, wineTitle(v.wine)].filter(Boolean);
  const year = v.year ?? v.production_year;
  if (year) parts.push(String(year));
  return parts.join(" — ");
}

export function grapesText(
  grapes: { percentage?: number | null; grape?: { name?: string | null } | null }[] | null | undefined,
  withPercent = false,
): string {
  if (!grapes?.length) return "";
  return grapes
    .filter((g) => g.grape?.name)
    .map((g) => (withPercent && g.percentage ? `${g.grape!.name} ${g.percentage} %` : g.grape!.name))
    .join(", ");
}

export const NOTE_TYPES: { key: string; label: string }[] = [
  { key: "color", label: "Robe" },
  { key: "nose", label: "Nez" },
  { key: "mouth", label: "Bouche" },
  { key: "vinification", label: "Vinification" },
];

export function findNote(
  notes: { type: string; content: string }[] | null | undefined,
  key: string,
): string {
  return notes?.find((n) => n.type === key)?.content?.trim() || "";
}

const eurFmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const eurFmtRound = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function formatEur(n: number | string | null | undefined, round = false): string {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (v == null || !Number.isFinite(v)) return "—";
  return (round ? eurFmtRound : eurFmt).format(v);
}

/** Requête Supabase réutilisable : un millésime avec tout ce qu'il faut pour l'afficher. */
export const VINTAGE_PUBLIC_SELECT = `
  *,
  wine (
    *,
    wine_type ( name, category ),
    winery (
      *,
      region ( name, country ( iso_code, name, flag ) ),
      country ( iso_code, name, flag )
    ),
    appelation ( name, label ( name ) ),
    wine_pairing ( pairing_id, pairing ( id, description ) )
  ),
  wine_vintage_grape ( percentage, grape ( name ) ),
  note ( * )
`;

type WineryLike = {
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  region?: { name?: string | null; country?: { flag?: string | null } | null } | null;
  country?: { flag?: string | null } | null;
} | null | undefined;

/** « Ville, Région » d'un domaine. */
export function wineryPlace(w: WineryLike): string {
  return [w?.city, w?.region?.name].filter(Boolean).join(", ");
}

export function wineryFlag(w: WineryLike): string {
  return w?.region?.country?.flag || w?.country?.flag || "";
}

/** Lien OpenStreetMap centré sur le domaine. */
export function wineryMapUrl(w: WineryLike): string | null {
  if (w?.latitude == null || w?.longitude == null) return null;
  return `https://www.openstreetmap.org/?mlat=${w.latitude}&mlon=${w.longitude}#map=12/${w.latitude}/${w.longitude}`;
}
