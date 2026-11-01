/**
 * Helpers d'affichage des produits (vins, huiles d'olive…), partagés par le site public, le live et
 * l'admin. Le vocabulaire propre à chaque type de produit est dans productKinds.ts, les couleurs dans
 * productStyles.ts.
 */

import { formatVolume, kindInfo, kindOf, PRODUCT_KIND_LIST, type ProductKind } from "./productKinds";
import { allProductStyles, STYLE_ORDER, STYLES, type ProductStyle, type ProductStyleKey } from "./productStyles";

type TypeLike = { name?: string | null; category?: string | null; kind?: string | null } | null | undefined;

/** Couleur d'un produit d'après son type (`product_type`) : robe d'un vin, couleur du produit sinon (vert olive). */
export function productStyle(type: TypeLike): ProductStyle {
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
export function wineRobe(type: TypeLike): ProductStyle {
  return productStyle({ name: type?.name, kind: type?.kind });
}

/** Libellé de la pastille d'un produit : la robe d'un vin (« Rouge », « Pétillant »), le fruité d'une huile. */
export function styleLabel(type: TypeLike): string {
  return (kindInfo(type).style && type?.name) || productStyle(type).label;
}

/**
 * Tri des types (`product_type`) pour les listes : par type de produit (vins puis huiles), selon son
 * `typeOrder` (fruité léger, moyen, intense ; un type absent de cet ordre vient après), puis par nom.
 */
export function byProductType(a: TypeLike, b: TypeLike): number {
  const kind = (t: TypeLike) => PRODUCT_KIND_LIST.indexOf(kindInfo(t));
  return kind(a) - kind(b) || typePosition(a) - typePosition(b) || (a?.name ?? "").localeCompare(b?.name ?? "", "fr");
}

/** Tri des types par robe dans l'ordre `STYLE_ORDER` (pétillant, blanc, orange, rosé, rouge…), puis comme `byProductType`. */
export function byRobe(a: TypeLike, b: TypeLike): number {
  const robe = (t: TypeLike) => STYLE_ORDER.indexOf(wineRobe(t).key);
  return robe(a) - robe(b) || byProductType(a, b);
}

/** Rang d'un type dans le `typeOrder` de son produit ; après les autres s'il n'y figure pas (ou sans ordre). */
function typePosition(t: TypeLike): number {
  const order = kindInfo(t).typeOrder ?? [];
  const i = order.indexOf(t?.name ?? "");
  return i < 0 ? order.length : i;
}

/**
 * Tri des lots du site : couleur du plus léger au plus corsé, ordre des types du produit (fruité
 * léger à intense pour les huiles), nom, puis année la plus récente (millésime, sinon mise en bouteille).
 */
export function compareLotsByStyle(a: LotLike, b: LotLike): number {
  const style = (v: typeof a) => STYLE_ORDER.indexOf(productStyle(v.product?.product_type).key);
  return (
    style(a) - style(b) ||
    typePosition(a.product?.product_type) - typePosition(b.product?.product_type) ||
    productTitle(a.product).localeCompare(productTitle(b.product), "fr") ||
    (b.year ?? b.production_year ?? 0) - (a.year ?? a.production_year ?? 0)
  );
}

/** Couleurs présentes dans une liste de lots, dans l'ordre des filtres. */
export function presentStyles(lots: { product?: ProductLike }[]): ProductStyle[] {
  const keys = new Set(lots.map((v) => productStyle(v.product?.product_type).key));
  return allProductStyles().filter((s) => keys.has(s.key));
}

/** « Rouge », « Blanc »… ; un type hors de ces couleurs, ou d'un autre produit (« Fruité intense »), garde son nom en base. */
export function productTypeLabel(type: TypeLike): string {
  const style = wineRobe(type);
  return style.key === "other" || kindInfo(type).style ? type?.name ?? "" : style.label;
}

/** Robes principales du vin : filtres de la liste des produits, goûts d'un client. */
export const MAIN_ROBES: ProductStyleKey[] = ["red", "white", "rose"];

/**
 * Bouteilles achetées par robe (`wineRobe` du type de produit), robes de `among` de la plus à la
 * moins achetée, et la préférée (null sans achat). Les ventes s'en tiennent aux robes du vin ; la
 * fiche client y ajoute les couleurs des autres produits (huile).
 */
export function robePreference(
  lines: { type: TypeLike; qty: number }[],
  among: ProductStyleKey[] = MAIN_ROBES,
): { qty: Record<ProductStyleKey, number>; order: ProductStyleKey[]; favorite: ProductStyleKey | null } {
  const qty = Object.fromEntries(STYLE_ORDER.map((k) => [k, 0])) as Record<ProductStyleKey, number>;
  for (const l of lines) qty[wineRobe(l.type).key] += l.qty;
  const order = [...among].sort((a, b) => qty[b] - qty[a]);
  return { qty, order, favorite: order[0] && qty[order[0]] > 0 ? order[0] : null };
}

type AppellationLike = {
  name?: string | null;
  label?: { name?: string | null } | null;
} | null;

export type ProductLike = {
  id?: string;
  kind?: string | null;
  name?: string | null;
  description?: string | null;
  appellation?: AppellationLike;
  producer?: { name?: string | null } | null;
  product_type?: TypeLike;
} | null | undefined;

export function appellationText(ap: AppellationLike | undefined): string {
  if (!ap) return "";
  return [ap.name, ap.label?.name].filter(Boolean).join(" ").trim();
}

/** Nom principal d'un produit : son nom, sinon son appellation. */
export function productTitle(product: ProductLike): string {
  if (product?.name?.trim()) return product.name.trim();
  return appellationText(product?.appellation) || kindInfo(product).untitled;
}

/** Ligne secondaire : appellation quand le titre est un nom de cuvée. */
export function productSubtitle(product: ProductLike): string {
  if (!product?.name?.trim()) return "";
  return appellationText(product?.appellation);
}

/** Lot tel que les libellés le lisent : année, mise en bouteille, contenant et produit. */
type LotLike = {
  year?: number | null;
  production_year?: number | null;
  volume_ml?: number | null;
  product?: ProductLike;
};

/** Contenant d'un lot à afficher (« 5 L », « 1,5 L ») ; vide pour la bouteille standard du vin. */
export function lotVolume(v: LotLike | null | undefined, kind: ProductKind = kindOf(v?.product)): string {
  if (!v?.volume_ml || v.volume_ml === kindInfo(kind).standardVolume) return "";
  return formatVolume(v.volume_ml);
}

/** « 2025 · 5 L » : un libellé suivi du contenant du lot, s'il est à afficher. */
export function withVolume(
  text: string,
  v: LotLike | null | undefined,
  kind: ProductKind = kindOf(v?.product),
  separator = " · ",
): string {
  const volume = lotVolume(v, kind);
  return volume ? `${text}${separator}${volume}` : text;
}

/** Tri des contenants d'un même lot, du plus petit au plus grand. */
export function byVolume(a: { volume_ml?: number | null }, b: { volume_ml?: number | null }): number {
  return (a.volume_ml ?? 0) - (b.volume_ml ?? 0);
}

/** Contenants présentés ensemble (« 50 cl · 1 L · 5 L ») : vide pour un seul lot en bouteille standard. */
export function formatsText(formats: LotLike[]): string {
  if (formats.length === 1 && !lotVolume(formats[0])) return "";
  return formats.map((f) => (f.volume_ml ? formatVolume(f.volume_ml) : "")).filter(Boolean).join(" · ");
}

/** « Domaine — Cuvée — 2022 » (« — 1,5 L » hors bouteille standard) : libellé compact pour l'admin, la recherche… */
export function lotLabel(v: LotLike | null | undefined): string {
  if (!v) return "—";
  const parts = [v.product?.producer?.name, productTitle(v.product)].filter(Boolean);
  const year = v.year ?? v.production_year;
  if (year) parts.push(String(year));
  return withVolume(parts.join(" — "), v, undefined, " — ");
}

/** « Riserva 2019 », « Olio 2025 · 5 L » : nom court, sans domaine (listes de l'admin). */
export function lotShortLabel(v: LotLike | null | undefined): string {
  const name = v?.product?.name?.trim() || v?.product?.appellation?.name || kindInfo(v?.product).label;
  const year = v?.year ?? v?.production_year;
  return withVolume(year ? `${name} ${year}` : name, v);
}

/**
 * « Domaine - Cuvée - 2022 » (ou « Domaine - Cuvée (2021) » sans millésime, « - 5 L » hors bouteille
 * standard) : libellé des lignes de vente, de commande et de transport, factures et bons de commande compris.
 */
export function lotProductLabel(v: LotLike): string {
  const producer = v.product?.producer?.name;
  const name = v.product?.name || v.product?.appellation?.name;
  const base = name ? `${producer} - ${name}` : `${producer}`;
  return withVolume(v.year ? `${base} - ${v.year}` : `${base} (${v.production_year})`, v, undefined, " - ");
}

/** Tri des produits de l'admin : domaine, puis cuvée (ou appellation). */
export function compareProductsByProducer(a: ProductLike, b: ProductLike): number {
  const producerA = a?.producer?.name?.toLowerCase() || "";
  const producerB = b?.producer?.name?.toLowerCase() || "";
  if (producerA !== producerB) return producerA.localeCompare(producerB);
  const nameA = a?.name?.toLowerCase() || a?.appellation?.name?.toLowerCase() || "";
  const nameB = b?.name?.toLowerCase() || b?.appellation?.name?.toLowerCase() || "";
  return nameA.localeCompare(nameB);
}

/** Tri des sélecteurs de l'admin : domaine, cuvée (ou appellation), année décroissante, puis contenant. */
export function compareLotsByProducer(a: LotLike, b: LotLike): number {
  const byProduct = compareProductsByProducer(a.product, b.product);
  if (byProduct) return byProduct;
  const byYear = (b.year || b.production_year || 0) - (a.year || a.production_year || 0);
  return byYear || byVolume(a, b);
}

/** « 2019 », « 2025 · 5 L », ou « Non millésimé (2021) » avec l'année de mise en bouteille. */
export function lotYearLabel(v: LotLike, kind: ProductKind = kindOf(v.product)): string {
  return withVolume(v.year ? String(v.year) : `${kindInfo(kind).noYear} (${v.production_year})`, v, kind);
}

/** Les contenants d'un même produit et d'une même année, le plus petit en tête (une carte par lot sur le site). */
export type FormatGroup<T> = { lot: T; formats: T[] };

/** Regroupe les contenants par produit et par année, dans l'ordre de la liste. */
export function groupFormats<T extends { product_id: string; year?: number | null; production_year?: number | null; volume_ml?: number | null }>(
  list: T[],
): FormatGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const v of list) {
    const key = `${v.product_id}:${v.year ?? `sans-annee-${v.production_year}`}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(v);
  }
  return [...groups.values()].map((formats) => {
    formats.sort(byVolume);
    return { lot: formats[0], formats };
  });
}

export function varietiesText(
  varieties: { percentage?: number | null; variety?: { name?: string | null } | null }[] | null | undefined,
  withPercent = false,
): string {
  if (!varieties?.length) return "";
  return varieties
    .filter((g) => g.variety?.name)
    .map((g) => (withPercent && g.percentage ? `${g.variety!.name} ${g.percentage} %` : g.variety!.name))
    .join(", ");
}

export function findNote(
  notes: { type: string; content: string }[] | null | undefined,
  key: string,
): string {
  return notes?.find((n) => n.type === key)?.content?.trim() || "";
}

/** Notes renseignées d'un lot, dans l'ordre et avec les libellés de son type de produit. */
export function lotNotes(
  notes: { type: string; content: string }[] | null | undefined,
  kind: ProductKind,
): { key: string; label: string; content: string }[] {
  return kindInfo(kind)
    .noteTypes.map((t) => ({ ...t, content: findNote(notes, t.key) }))
    .filter((n) => n.content);
}

/** Accords mets-vins d'un produit chargé avec `LOT_PUBLIC_SELECT` ; aucun pour un type sans accords (huile). */
export function productPairings(
  product:
    | { kind?: string | null; product_pairing?: { pairing?: { description?: string | null } | null }[] | null }
    | null
    | undefined,
): string[] {
  if (!kindInfo(product).pairingsLabel) return [];
  return (product?.product_pairing || []).map((wp) => wp.pairing?.description).filter((d): d is string => !!d);
}

/**
 * Requête Supabase réutilisable : un lot avec tout ce qu'il faut pour l'afficher.
 * `inner` permet de filtrer sur le produit et son domaine (`.eq("product.kind", …)`, `.eq("product.producer.hidden", false)`).
 */
const lotPublicSelect = (inner: boolean) => `
  *,
  product${inner ? "!inner" : ""} (
    *,
    product_type ( name, category, kind ),
    producer${inner ? "!inner" : ""} (
      *,
      region ( name, country ( iso_code, name, flag ) ),
      country ( iso_code, name, flag )
    ),
    appellation ( name, label ( name ) ),
    product_pairing ( pairing_id, pairing ( id, description ) )
  ),
  lot_variety ( percentage, variety ( name ) ),
  note ( * )
`;

/**
 * Colonnes d'un lot nécessaires à ses libellés (`lotLabel`, `lotProductLabel`…). `kind` en
 * fait partie : sans lui, une huile serait lue comme un vin et perdrait son contenant affiché.
 */
const LABEL_PRODUCT_COLUMNS = "kind, name, producer ( name ), appellation ( name, label ( name ) )" as const;
export const LOT_LABEL_SELECT = `year, production_year, volume_ml, product ( ${LABEL_PRODUCT_COLUMNS} )` as const;

/** `LOT_LABEL_SELECT` avec des colonnes du produit en plus (« id, product_type ( name ) »). */
export function lotLabelSelect(productExtra: string): string {
  return `year, production_year, volume_ml, product ( ${LABEL_PRODUCT_COLUMNS}, ${productExtra} )`;
}

export const LOT_PUBLIC_SELECT = lotPublicSelect(false);
export const LOT_PUBLIC_SELECT_BY_PRODUCT = lotPublicSelect(true);

/**
 * Lot « plus jamais disponible » : grisé dans la gestion, absent du site public (ses requêtes
 * filtrent `.is("discontinued_at", null)`, sa fiche répond 404).
 */
export function isDiscontinued(v: { discontinued_at?: string | null } | null | undefined): boolean {
  return !!v?.discontinued_at;
}

type ProducerLike = {
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  instagram?: string | null;
  region?: { name?: string | null; country?: { flag?: string | null } | null } | null;
  country?: { flag?: string | null } | null;
} | null | undefined;

/** « Ville, Région » d'un domaine. */
export function producerPlace(w: ProducerLike): string {
  return [w?.city, w?.region?.name].filter(Boolean).join(", ");
}

export function producerFlag(w: ProducerLike): string {
  return w?.region?.country?.flag || w?.country?.flag || "";
}

/** Lien OpenStreetMap centré sur le domaine. */
export function producerMapUrl(w: ProducerLike): string | null {
  if (w?.latitude == null || w?.longitude == null) return null;
  return `https://www.openstreetmap.org/?mlat=${w.latitude}&mlon=${w.longitude}#map=12/${w.latitude}/${w.longitude}`;
}

/** Premiers segments d'un lien Instagram qui ne sont pas un compte (publication, reel, story…). */
const INSTAGRAM_PATHS = new Set(["p", "reel", "reels", "stories", "tv", "explore", "accounts", "direct", "_u"]);

/** Compte Instagram (« cantina.x ») d'une saisie « @compte », « compte » ou lien de profil ; `null` sinon. */
export function instagramAccount(input: string): string | null {
  const value = input.trim();
  const link = value.match(/^(?:https?:\/\/)?(?:[\w-]+\.)*(?:instagram\.com|instagr\.am)\/([^/?#]+)/i);
  const account = (link ? link[1] : value.replace(/^@/, "")).toLowerCase();
  if (!/^[\w.]{1,30}$/.test(account) || INSTAGRAM_PATHS.has(account) || /instagram\.com|instagr\.am/.test(account)) return null;
  return account;
}

/** Compte Instagram d'un domaine : « @compte » et lien du profil. */
export function producerInstagram(w: ProducerLike): { handle: string; url: string } | null {
  const account = w?.instagram ? instagramAccount(w.instagram) : null;
  return account ? { handle: `@${account}`, url: `https://www.instagram.com/${account}/` } : null;
}

/** Carte OpenStreetMap intégrable (iframe) centrée sur le domaine. */
export function producerMapEmbedUrl(w: ProducerLike): string | null {
  if (w?.latitude == null || w?.longitude == null) return null;
  const { latitude: lat, longitude: lon } = w;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.12}%2C${lat - 0.07}%2C${lon + 0.12}%2C${lat + 0.07}&layer=mapnik&marker=${lat}%2C${lon}`;
}
