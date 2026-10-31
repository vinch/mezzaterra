/**
 * Helpers d'affichage des produits (vins, huiles d'olive…), partagés par le site public, le live et
 * l'admin. Le vocabulaire propre à chaque type de produit est dans productKinds.ts.
 */

import { formatVolume, kindInfo, kindOf, type ProductKind } from "./productKinds";

export type WineStyleKey = "red" | "white" | "rose" | "orange" | "sparkling" | "oil" | "other";

export type WineStyle = {
  key: WineStyleKey;
  label: string;
  /** Couleur de robe principale. */
  color: string;
  /** Variante claire (fonds, reflets). */
  light: string;
  /** Liseré des pastilles claires (blanc, rosé), pour qu'elles se détachent du fond. */
  ring?: string;
};

const STYLES: Record<WineStyleKey, WineStyle> = {
  red: { key: "red", label: "Rouge", color: "#7a1f2e", light: "#b04456" },
  white: { key: "white", label: "Blanc", color: "#d8bf62", light: "#efe2a6", ring: "#a88d2e" },
  rose: { key: "rose", label: "Rosé", color: "#e0879a", light: "#f3c3cb", ring: "#c0627a" },
  orange: { key: "orange", label: "Orange", color: "#d07b2c", light: "#ecb57f" },
  sparkling: { key: "sparkling", label: "Pétillant", color: "#e2cf7f", light: "#f4ebc4" },
  oil: { key: "oil", label: "Huile d’olive", color: "#7b8a2e", light: "#c5cc7a" },
  other: { key: "other", label: "Vin", color: "#5b7d7f", light: "#a9bfc0" },
};

/** Ordre « du plus léger au plus corsé » pour trier ou dessiner un dégradé. */
export const STYLE_ORDER: WineStyleKey[] = ["sparkling", "white", "orange", "rose", "red", "oil", "other"];

type TypeLike = { name?: string | null; category?: string | null; kind?: string | null } | null | undefined;

/** Couleur d'un produit d'après son type (`wine_type`) : robe d'un vin, couleur du produit sinon (vert olive). */
export function wineStyle(type: TypeLike): WineStyle {
  const own = kindInfo(type).style;
  if (own) return STYLES[own];
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

/**
 * Couleur de la robe (rouge, blanc, rosé, orange) d'après le nom du type, sans le caractère pétillant :
 * pastilles, filtres, répartitions et tarifs classent par couleur, un crémant blanc reste blanc.
 */
export function wineRobe(type: TypeLike): WineStyle {
  return wineStyle({ name: type?.name, kind: type?.kind });
}

/** Libellé de la pastille d'un produit : la robe d'un vin (« Rouge », « Pétillant »), le fruité d'une huile. */
export function styleLabel(type: TypeLike): string {
  return (kindInfo(type).style && type?.name) || wineStyle(type).label;
}

/** Style CSS d'une pastille ou d'une silhouette à la couleur de la robe (liseré pour les teintes claires). */
export function swatchStyle(style: WineStyle): string {
  return `background: ${style.color};${style.ring ? ` box-shadow: inset 0 0 0 1px ${style.ring};` : ""}`;
}

/** Style par clé (filtres et légendes qui manipulent des clés). */
export function styleByKey(key: WineStyleKey): WineStyle {
  return STYLES[key];
}

/** « Rouge », « Blanc »… ; un type hors de ces couleurs, ou d'un autre produit (« Fruité intense »), garde son nom en base. */
export function wineTypeLabel(type: TypeLike): string {
  const style = wineRobe(type);
  return style.key === "other" || kindInfo(type).style ? type?.name ?? "" : style.label;
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
  kind?: string | null;
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

/** Nom principal d'un produit : son nom, sinon son appellation. */
export function wineTitle(wine: WineLike): string {
  if (wine?.name?.trim()) return wine.name.trim();
  return appellationText(wine?.appelation) || kindInfo(wine).untitled;
}

/** Ligne secondaire : appellation quand le titre est un nom de cuvée. */
export function wineSubtitle(wine: WineLike): string {
  if (!wine?.name?.trim()) return "";
  return appellationText(wine?.appelation);
}

/** Lot tel que les libellés le lisent : année, mise en bouteille, contenant et produit. */
type VintageLike = {
  year?: number | null;
  production_year?: number | null;
  volume_ml?: number | null;
  wine?: WineLike;
};

/** Contenant d'un lot à afficher (« 5 L », « 1,5 L ») ; vide pour la bouteille standard du vin. */
export function vintageVolume(v: VintageLike | null | undefined, kind: ProductKind = kindOf(v?.wine)): string {
  if (!v?.volume_ml || v.volume_ml === kindInfo(kind).standardVolume) return "";
  return formatVolume(v.volume_ml);
}

/** « 2025 · 5 L » : un libellé suivi du contenant du lot, s'il est à afficher. */
export function withVolume(
  text: string,
  v: VintageLike | null | undefined,
  kind: ProductKind = kindOf(v?.wine),
  separator = " · ",
): string {
  const volume = vintageVolume(v, kind);
  return volume ? `${text}${separator}${volume}` : text;
}

/** Tri des contenants d'un même lot, du plus petit au plus grand. */
export function byVolume(a: { volume_ml?: number | null }, b: { volume_ml?: number | null }): number {
  return (a.volume_ml ?? 0) - (b.volume_ml ?? 0);
}

/** Contenants présentés ensemble (« 50 cl · 1 L · 5 L ») : vide pour un seul lot en bouteille standard. */
export function formatsText(formats: VintageLike[]): string {
  if (formats.length === 1 && !vintageVolume(formats[0])) return "";
  return formats.map((f) => (f.volume_ml ? formatVolume(f.volume_ml) : "")).filter(Boolean).join(" · ");
}

/** « Domaine — Cuvée — 2022 » (« — 1,5 L » hors bouteille standard) : libellé compact pour l'admin, la recherche… */
export function vintageLabel(v: VintageLike | null | undefined): string {
  if (!v) return "—";
  const parts = [v.wine?.winery?.name, wineTitle(v.wine)].filter(Boolean);
  const year = v.year ?? v.production_year;
  if (year) parts.push(String(year));
  return withVolume(parts.join(" — "), v, undefined, " — ");
}

/** « Riserva 2019 », « Olio 2025 · 5 L » : nom court, sans domaine (listes de l'admin). */
export function vintageShortLabel(v: VintageLike | null | undefined): string {
  const name = v?.wine?.name?.trim() || v?.wine?.appelation?.name || kindInfo(v?.wine).label;
  const year = v?.year ?? v?.production_year;
  return withVolume(year ? `${name} ${year}` : name, v);
}

/**
 * « Domaine - Cuvée - 2022 » (ou « Domaine - Cuvée (2021) » sans millésime, « - 5 L » hors bouteille
 * standard) : libellé des lignes de vente, de commande et de transport, factures et bons de commande compris.
 */
export function vintageProductLabel(v: VintageLike): string {
  const winery = v.wine?.winery?.name;
  const name = v.wine?.name || v.wine?.appelation?.name;
  const base = name ? `${winery} - ${name}` : `${winery}`;
  return withVolume(v.year ? `${base} - ${v.year}` : `${base} (${v.production_year})`, v, undefined, " - ");
}

/** Tri des sélecteurs de l'admin : domaine, cuvée (ou appellation), année décroissante, puis contenant. */
export function compareVintages(a: VintageLike, b: VintageLike): number {
  const wineryA = a.wine?.winery?.name?.toLowerCase() || "";
  const wineryB = b.wine?.winery?.name?.toLowerCase() || "";
  if (wineryA !== wineryB) return wineryA.localeCompare(wineryB);
  const nameA = a.wine?.name?.toLowerCase() || a.wine?.appelation?.name?.toLowerCase() || "";
  const nameB = b.wine?.name?.toLowerCase() || b.wine?.appelation?.name?.toLowerCase() || "";
  if (nameA !== nameB) return nameA.localeCompare(nameB);
  const byYear = (b.year || b.production_year || 0) - (a.year || a.production_year || 0);
  return byYear || byVolume(a, b);
}

/** « 2019 », « 2025 · 5 L », ou « Non millésimé (2021) » avec l'année de mise en bouteille. */
export function vintageYearLabel(v: VintageLike, kind: ProductKind = kindOf(v.wine)): string {
  return withVolume(v.year ? String(v.year) : `${kindInfo(kind).noYear} (${v.production_year})`, v, kind);
}

/** Les contenants d'un même produit et d'une même année, le plus petit en tête (une carte par lot sur le site). */
export type FormatGroup<T> = { vintage: T; formats: T[] };

/** Regroupe les contenants par produit et par année, dans l'ordre de la liste. */
export function groupFormats<T extends { wine_id: string; year?: number | null; production_year?: number | null; volume_ml?: number | null }>(
  list: T[],
): FormatGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const v of list) {
    const key = `${v.wine_id}:${v.year ?? `sans-annee-${v.production_year}`}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(v);
  }
  return [...groups.values()].map((formats) => {
    formats.sort(byVolume);
    return { vintage: formats[0], formats };
  });
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

export function findNote(
  notes: { type: string; content: string }[] | null | undefined,
  key: string,
): string {
  return notes?.find((n) => n.type === key)?.content?.trim() || "";
}

/** Notes renseignées d'un millésime, dans l'ordre et avec les libellés de son type de produit. */
export function vintageNotes(
  notes: { type: string; content: string }[] | null | undefined,
  kind: ProductKind = "wine",
): { key: string; label: string; content: string }[] {
  return kindInfo(kind)
    .noteTypes.map((t) => ({ ...t, content: findNote(notes, t.key) }))
    .filter((n) => n.content);
}

/** Accords mets-vins d'un vin chargé avec `VINTAGE_PUBLIC_SELECT` ; aucun pour un type sans accords (huile). */
export function winePairings(
  wine:
    | { kind?: string | null; wine_pairing?: { pairing?: { description?: string | null } | null }[] | null }
    | null
    | undefined,
): string[] {
  if (!kindInfo(wine).pairingsLabel) return [];
  return (wine?.wine_pairing || []).map((wp) => wp.pairing?.description).filter((d): d is string => !!d);
}

/**
 * Requête Supabase réutilisable : un millésime avec tout ce qu'il faut pour l'afficher.
 * `wine!inner` permet de filtrer sur le produit (`.eq("wine.kind", …)`).
 */
const vintagePublicSelect = (wine: "wine" | "wine!inner") => `
  *,
  ${wine} (
    *,
    wine_type ( name, category, kind ),
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

export const VINTAGE_PUBLIC_SELECT = vintagePublicSelect("wine");
export const VINTAGE_PUBLIC_SELECT_BY_WINE = vintagePublicSelect("wine!inner");

/**
 * Millésime « plus jamais disponible » : absent du site public, grisé dans la gestion.
 * Filtré côté client (les requêtes publiques lisent `*`) pour ne rien casser tant que
 * la colonne n'existe pas encore en base.
 */
export function isDiscontinued(v: { discontinued_at?: string | null } | null | undefined): boolean {
  return !!v?.discontinued_at;
}

/** Retire les millésimes « plus jamais disponibles » d'une liste publique. */
export function publicVintages<T extends { discontinued_at?: string | null }>(list: T[]): T[] {
  return list.filter((v) => !isDiscontinued(v));
}

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

/** Carte OpenStreetMap intégrable (iframe) centrée sur le domaine. */
export function wineryMapEmbedUrl(w: WineryLike): string | null {
  if (w?.latitude == null || w?.longitude == null) return null;
  const { latitude: lat, longitude: lon } = w;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.12}%2C${lat - 0.07}%2C${lon + 0.12}%2C${lat + 0.07}&layer=mapnik&marker=${lat}%2C${lon}`;
}
