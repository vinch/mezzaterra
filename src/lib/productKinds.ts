/**
 * Types de produit du catalogue : vin, huile d'olive… Tous partagent les mêmes tables (`product` pour le
 * produit, `lot` pour le millésime ou la récolte, `variety` pour les cépages ou variétés) et
 * donc les mêmes ventes, stocks, commandes et dégustations ; ce registre donne à chacun son
 * vocabulaire et ses particularités.
 *
 * Nouveau type : l'ajouter ici, à `KIND_ICONS` (`src/lib/ui/kindIcons.ts`), au domaine SQL `product_kind`
 * et à sa TVA (`product_kind_vat_rate`, qui donne sinon 21 % sans rien signaler), sa couleur à `STYLES`
 * (`productStyles.ts`) s'il en a une propre, puis créer ses types (`product_type`).
 */

import type { ProductStyleKey } from "./productStyles";

export type ProductKind = "wine" | "olive_oil";

/** Type d'une ligne lue sans sa colonne `kind`, toujours affiché en premier. */
export const DEFAULT_KIND: ProductKind = "wine";

export type ProductKindInfo = {
  key: ProductKind;
  /** « Vin », « Huile d'olive ». */
  label: string;
  /** « Vins », « Huiles d'olive ». */
  plural: string;
  /** Segment d'URL du site public (`/vins/…`, `/huiles/…`). */
  slug: string;
  /** Lien et titre du catalogue public : « Nos vins ». */
  catalogTitle: string;
  /** Accroche du catalogue public. */
  catalogLead: string;
  /** Description du catalogue au partage (Open Graph). */
  catalogShare: string;
  /** Recherche du catalogue public. */
  searchPlaceholder: string;
  /** « Nouveau vin », « Nouvelle huile ». */
  newLabel: string;
  /** Titre du formulaire d'édition : « Modifier le vin ». */
  editLabel: string;
  /** « ce vin », « cette huile » (confirmations, messages). */
  thisLabel: string;
  /** Onglet vide de la liste des produits : « Aucun vin au catalogue ». */
  noProduct: string;
  /** Titre d'un produit sans nom ni appellation. */
  untitled: string;
  /** Ce qui distingue les types de ce produit (`product_type`) : « Robe », « Fruité ». */
  typeLabel: string;
  /** Ordre des types (noms `product_type`) dans les listes, quand l'alphabet ne convient pas : du fruité léger à l'intense. */
  typeOrder?: string[];
  /**
   * Couleur unique du produit (pastilles, bouteille, liserés) ; `null` : couleur de la robe, propre à
   * chaque type (vin). Un type de produit à couleur unique affiche le nom de son type (« Fruité intense »).
   */
  style: ProductStyleKey | null;
  /** Lot du produit (une ligne `lot`, vendue et stockée) : « Millésime », « Lot ». */
  lot: string;
  lotPlural: string;
  newLot: string;
  /** « Aucun millésime », « Aucun lot ». */
  noLot: string;
  /** « Ajouter un millésime » (menu de la liste des produits). */
  addLot: string;
  /** « Modifier le millésime », « ce millésime ». */
  editLot: string;
  thisLot: string;
  /** Année du lot (`lot.year`), toujours facultative (vin non millésimé, huile sans récolte indiquée). */
  yearLabel: string;
  yearPlaceholder: string;
  /** Intitulé public de cette année : « Millésime », « Récolte ». */
  yearFact: string;
  /** « Autres millésimes » (fiche publique). */
  otherYears: string;
  /** Lot sans année : « Non millésimé ». */
  noYear: string;
  /** Composition (`variety`) : « Cépages », « Variétés d'olives ». */
  varieties: string;
  /** « Nouveau cépage », « Nouvelle variété » (référentiel des cépages et variétés). */
  newVariety: string;
  /** « Choisir un cépage… », « Aucun cépage ». */
  chooseVariety: string;
  noVariety: string;
  /** Le degré d'alcool a un sens (`lot.abv`). */
  hasAbv: boolean;
  /** Contenants proposés à la création d'un lot (en mL), le premier par défaut. */
  volumes: number[];
  /** Contenant si courant qu'on ne l'affiche pas (la bouteille de 75 cl) ; `null` : toujours affiché. */
  standardVolume: number | null;
  /** « Vin biologique ». */
  organicLabel: string;
  /** Titre de la description du produit sur sa fiche : « Le vin ». */
  aboutTitle: string;
  /** Accords mets (`product_pairing`) : « Accords mets & vins » ; `null` : pas d'accords pour ce type (huile). */
  pairingsLabel: string | null;
  /** Notes de dégustation, dans l'ordre d'affichage (`note.type`). */
  noteTypes: { key: string; label: string }[];
};

export const PRODUCT_KINDS: Record<ProductKind, ProductKindInfo> = {
  wine: {
    key: "wine",
    label: "Vin",
    plural: "Vins",
    slug: "vins",
    catalogTitle: "Nos vins",
    catalogLead: "Des domaines familiaux des Abruzzes, entre mer Adriatique et massif du Gran Sasso.",
    catalogShare: "Montepulciano, Pecorino, Cerasuolo… la cave Mezzaterra, domaine par domaine.",
    searchPlaceholder: "Rechercher un vin, un cépage…",
    newLabel: "Nouveau vin",
    editLabel: "Modifier le vin",
    thisLabel: "ce vin",
    noProduct: "Aucun vin au catalogue",
    untitled: "Vin sans nom",
    typeLabel: "Robe",
    style: null,
    lot: "Millésime",
    lotPlural: "Millésimes",
    newLot: "Nouveau millésime",
    noLot: "Aucun millésime",
    addLot: "Ajouter un millésime",
    editLot: "Modifier le millésime",
    thisLot: "ce millésime",
    yearLabel: "Année millésime",
    yearPlaceholder: "Si le vin est non millésimé, laissez vide",
    yearFact: "Millésime",
    otherYears: "Autres millésimes",
    noYear: "Non millésimé",
    varieties: "Cépages",
    newVariety: "Nouveau cépage",
    chooseVariety: "Choisir un cépage…",
    noVariety: "Aucun cépage",
    hasAbv: true,
    volumes: [750, 375, 500, 1500, 3000],
    standardVolume: 750,
    organicLabel: "Vin biologique",
    aboutTitle: "Le vin",
    pairingsLabel: "Accords mets & vins",
    noteTypes: [
      { key: "color", label: "Robe" },
      { key: "nose", label: "Nez" },
      { key: "mouth", label: "Bouche" },
      { key: "vinification", label: "Vinification" },
    ],
  },
  olive_oil: {
    key: "olive_oil",
    label: "Huile d’olive",
    plural: "Huiles d’olive",
    slug: "huiles",
    catalogTitle: "Nos huiles",
    catalogLead: "Des huiles d’olive des Abruzzes, choisies chez nos producteurs.",
    catalogShare: "Les huiles d’olive des Abruzzes de Mezzaterra, domaine par domaine.",
    searchPlaceholder: "Rechercher une huile, une variété…",
    newLabel: "Nouvelle huile",
    editLabel: "Modifier l’huile",
    thisLabel: "cette huile",
    noProduct: "Aucune huile au catalogue",
    untitled: "Huile sans nom",
    typeLabel: "Fruité",
    typeOrder: ["Fruité léger", "Fruité moyen", "Fruité intense"],
    style: "oil",
    lot: "Lot",
    lotPlural: "Lots",
    newLot: "Nouveau lot",
    noLot: "Aucun lot",
    addLot: "Ajouter un lot",
    editLot: "Modifier le lot",
    thisLot: "ce lot",
    yearLabel: "Année de récolte",
    yearPlaceholder: "Si l’huile n’indique pas de récolte, laissez vide",
    yearFact: "Récolte",
    otherYears: "Autres récoltes",
    noYear: "Sans récolte indiquée",
    varieties: "Variétés d’olives",
    newVariety: "Nouvelle variété",
    chooseVariety: "Choisir une variété…",
    noVariety: "Aucune variété",
    hasAbv: false,
    volumes: [500, 250, 750, 1000, 3000, 5000],
    standardVolume: null,
    organicLabel: "Huile biologique",
    aboutTitle: "L’huile",
    pairingsLabel: null,
    noteTypes: [
      { key: "color", label: "Couleur" },
      { key: "nose", label: "Nez" },
      { key: "mouth", label: "Bouche" },
      { key: "extraction", label: "Extraction" },
    ],
  },
};

export const PRODUCT_KIND_LIST: ProductKindInfo[] = Object.values(PRODUCT_KINDS);

export function isProductKind(value: unknown): value is ProductKind {
  return typeof value === "string" && Object.hasOwn(PRODUCT_KINDS, value);
}

/** Ligne qui porte (ou dont le type porte) un type de produit : produit, type, référentiel. */
type KindRow = { kind?: string | null; product_type?: { kind?: string | null } | null } | null | undefined;

/** Type d'un produit, d'un type ou d'un référentiel ; `DEFAULT_KIND` pour une ligne lue sans sa colonne `kind`. */
export function kindOf(row: KindRow): ProductKind {
  const kind = row?.kind ?? row?.product_type?.kind;
  return isProductKind(kind) ? kind : DEFAULT_KIND;
}

export function kindInfo(row: KindRow | ProductKind): ProductKindInfo {
  return PRODUCT_KINDS[typeof row === "string" ? row : kindOf(row)];
}

/** « 50 cl », « 75 cl », « 1,5 L », « 5 L ». */
export function formatVolume(ml: number): string {
  const n = (v: number) => String(v).replace(".", ",");
  return ml < 1000 ? `${n(ml / 10)} cl` : `${n(ml / 1000)} L`;
}

/** Couleurs propres à un type de produit, après les robes du vin (répartition des achats d'un client). */
export const KIND_STYLES = PRODUCT_KIND_LIST.flatMap((k) => (k.style ? [k.style] : []));

/** « 1 vin », « 3 huiles d’olive ». */
export function kindCount(kind: ProductKindInfo, n: number): string {
  return `${n} ${(n > 1 ? kind.plural : kind.label).toLowerCase()}`;
}

/**
 * « 8 vins », « 3 huiles d’olive », ou « 5 produits » quand les types se mêlent (dégustation, affiche) :
 * nombre de produits d'une liste, au vocabulaire de leur type quand il n'y en a qu'un.
 */
export function productsCount(products: KindRow[], n = products.length): string {
  const kinds = new Set(products.map(kindOf));
  return kinds.size === 1 ? kindCount(PRODUCT_KINDS[[...kinds][0]], n) : `${n} produit${n > 1 ? "s" : ""}`;
}

/** Onglets « un par type de produit » (composant `Tabs`) : libellé et nombre de lignes de chaque type, sans compte pendant le chargement. */
export function kindTabItems(
  rows: KindRow[],
  loading: boolean,
  label: (kind: ProductKindInfo) => string = (k) => k.plural,
): { key: ProductKind; label: string; count?: number }[] {
  const counts = new Map<ProductKind, number>();
  for (const row of rows) {
    const kind = kindOf(row);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return PRODUCT_KIND_LIST.map((k) => ({ key: k.key, label: label(k), count: loading ? undefined : (counts.get(k.key) ?? 0) }));
}

/** Onglet de type ouvert d'une liste de la gestion, gardé dans l'URL (`?type=huiles`) : retour depuis une fiche, rechargement. */
export function kindFromUrl(url: URL): ProductKind {
  return kindBySlug(url.searchParams.get("type") ?? "") ?? DEFAULT_KIND;
}

/** Lien vers une liste de la gestion ouverte sur l'onglet d'un type ; sans paramètre pour le type par défaut. */
export function kindListHref(path: string, kind: ProductKind): string {
  return kind === DEFAULT_KIND ? path : `${path}?type=${PRODUCT_KINDS[kind].slug}`;
}

/** Type de produit d'après son segment d'URL public (`vins`, `huiles`). */
export function kindBySlug(slug: string): ProductKind | null {
  return PRODUCT_KIND_LIST.find((k) => k.slug === slug)?.key ?? null;
}

/** Fiche publique d'un lot (millésime d'un vin, récolte d'une huile) : `/vins/…`, `/huiles/…`. */
export function lotHref(lot: { id: string; product?: { kind?: string | null } | null }): string {
  return `/${kindInfo(lot.product).slug}/${lot.id}`;
}

/** Options « Vin », « Huile d'olive » des listes de choix. */
export const PRODUCT_KIND_OPTIONS = PRODUCT_KIND_LIST.map((k) => ({ value: k.key, label: k.label }));
