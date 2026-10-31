/**
 * Types de produit du catalogue : vin, huile d'olive… Tous partagent les mêmes tables (`wine` pour le
 * produit, `wine_vintage` pour le millésime ou la récolte, `grape` pour les cépages ou variétés) et
 * donc les mêmes ventes, stocks, commandes et dégustations ; ce registre donne à chacun son
 * vocabulaire et ses particularités.
 *
 * Nouveau type : l'ajouter ici et au domaine SQL `product_kind`, puis créer ses types (`wine_type`).
 */

import type { WineStyleKey } from "./wine";

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
  /** Titre d'un produit sans nom ni appellation. */
  untitled: string;
  /** Ce qui distingue les types de ce produit (`wine_type`) : « Robe », « Fruité ». */
  typeLabel: string;
  /**
   * Couleur unique du produit (pastilles, bouteille, liserés) ; `null` : couleur de la robe, propre à
   * chaque type (vin). Un type de produit à couleur unique affiche le nom de son type (« Fruité intense »).
   */
  style: WineStyleKey | null;
  /** Lot du produit (une ligne `wine_vintage`, vendue et stockée) : « Millésime », « Lot ». */
  batch: string;
  batchPlural: string;
  newBatch: string;
  /** « Aucun millésime », « Aucun lot ». */
  noBatch: string;
  /** « Ajouter un millésime » (menu de la liste des produits). */
  addBatch: string;
  /** « Modifier le millésime », « ce millésime ». */
  editBatch: string;
  thisBatch: string;
  /** Année du lot (`wine_vintage.year`), toujours facultative (vin non millésimé, huile sans récolte indiquée). */
  yearLabel: string;
  yearPlaceholder: string;
  /** Intitulé public de cette année : « Millésime », « Récolte ». */
  yearFact: string;
  /** « Autres millésimes » (fiche publique). */
  otherYears: string;
  /** Lot sans année : « Non millésimé ». */
  noYear: string;
  /** Composition (`grape`) : « Cépages », « Variétés d'olives ». */
  ingredients: string;
  /** « Choisir un cépage… », « Aucun cépage ». */
  chooseIngredient: string;
  noIngredient: string;
  /** Le degré d'alcool a un sens (`wine_vintage.abv`). */
  hasAbv: boolean;
  /** Contenants proposés à la création d'un lot (en mL), le premier par défaut. */
  volumes: number[];
  /** Contenant si courant qu'on ne l'affiche pas (la bouteille de 75 cl) ; `null` : toujours affiché. */
  standardVolume: number | null;
  /** « Vin biologique ». */
  organicLabel: string;
  /** Titre de la description du produit sur sa fiche : « Le vin ». */
  aboutTitle: string;
  /** Accords mets (`wine_pairing`) : « Accords mets & vins ». */
  pairingsLabel: string;
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
    untitled: "Vin sans nom",
    typeLabel: "Robe",
    style: null,
    batch: "Millésime",
    batchPlural: "Millésimes",
    newBatch: "Nouveau millésime",
    noBatch: "Aucun millésime",
    addBatch: "Ajouter un millésime",
    editBatch: "Modifier le millésime",
    thisBatch: "ce millésime",
    yearLabel: "Année millésime",
    yearPlaceholder: "Si le vin est non millésimé, laissez vide",
    yearFact: "Millésime",
    otherYears: "Autres millésimes",
    noYear: "Non millésimé",
    ingredients: "Cépages",
    chooseIngredient: "Choisir un cépage…",
    noIngredient: "Aucun cépage",
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
    untitled: "Huile sans nom",
    typeLabel: "Fruité",
    style: "oil",
    batch: "Lot",
    batchPlural: "Lots",
    newBatch: "Nouveau lot",
    noBatch: "Aucun lot",
    addBatch: "Ajouter un lot",
    editBatch: "Modifier le lot",
    thisBatch: "ce lot",
    yearLabel: "Année de récolte",
    yearPlaceholder: "Si l’huile n’indique pas de récolte, laissez vide",
    yearFact: "Récolte",
    otherYears: "Autres récoltes",
    noYear: "Sans récolte indiquée",
    ingredients: "Variétés d’olives",
    chooseIngredient: "Choisir une variété…",
    noIngredient: "Aucune variété",
    hasAbv: false,
    volumes: [500, 250, 750, 1000, 3000, 5000],
    standardVolume: null,
    organicLabel: "Huile biologique",
    aboutTitle: "L’huile",
    pairingsLabel: "Accords mets & huile",
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
type KindRow = { kind?: string | null; wine_type?: { kind?: string | null } | null } | null | undefined;

/** Type d'un produit, d'un type ou d'un référentiel ; `DEFAULT_KIND` pour une ligne lue sans sa colonne `kind`. */
export function kindOf(row: KindRow): ProductKind {
  const kind = row?.kind ?? row?.wine_type?.kind;
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

/** Couleurs propres à un type de produit (pastilles de filtre après les robes du vin). */
export const KIND_STYLES = PRODUCT_KIND_LIST.flatMap((k) => (k.style ? [k.style] : []));

/** « 1 vin », « 3 huiles d’olive ». */
export function kindCount(kind: ProductKindInfo, n: number): string {
  return `${n} ${(n > 1 ? kind.plural : kind.label).toLowerCase()}`;
}

/** Types de produit présents dans une liste, dans l'ordre du registre ; le type par défaut toujours. */
export function kindsIn(kinds: Iterable<ProductKind>): ProductKindInfo[] {
  const present = new Set([DEFAULT_KIND, ...kinds]);
  return PRODUCT_KIND_LIST.filter((k) => present.has(k.key));
}

/** Type de produit d'après son segment d'URL public (`vins`, `huiles`). */
export function kindBySlug(slug: string): ProductKind | null {
  return PRODUCT_KIND_LIST.find((k) => k.slug === slug)?.key ?? null;
}

/** Fiche publique d'un millésime ou d'une récolte : `/vins/…`, `/huiles/…`. */
export function productHref(vintage: { id: string; wine?: { kind?: string | null } | null }): string {
  return `/${kindInfo(vintage.wine).slug}/${vintage.id}`;
}

/** Options « Vin », « Huile d'olive » des listes de choix. */
export const PRODUCT_KIND_OPTIONS = PRODUCT_KIND_LIST.map((k) => ({ value: k.key, label: k.label }));
