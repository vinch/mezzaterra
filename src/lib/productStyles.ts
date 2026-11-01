/**
 * Couleurs des produits : robes du vin (rouge, blanc, rosé…) et couleur propre d'un autre type de
 * produit (vert olive). Sans dépendance : productKinds.ts et products.ts s'en servent tous deux.
 */

export type ProductStyleKey = "red" | "white" | "rose" | "orange" | "sparkling" | "oil" | "other";

export type ProductStyle = {
  key: ProductStyleKey;
  label: string;
  /** Couleur de robe principale. */
  color: string;
  /** Variante claire (fonds, reflets). */
  light: string;
  /** Liseré des pastilles claires (blanc, rosé), pour qu'elles se détachent du fond. */
  ring?: string;
};

export const STYLES: Record<ProductStyleKey, ProductStyle> = {
  red: { key: "red", label: "Rouge", color: "#7a1f2e", light: "#b04456" },
  white: { key: "white", label: "Blanc", color: "#d8bf62", light: "#efe2a6", ring: "#a88d2e" },
  rose: { key: "rose", label: "Rosé", color: "#e0879a", light: "#f3c3cb", ring: "#c0627a" },
  orange: { key: "orange", label: "Orange", color: "#d07b2c", light: "#ecb57f" },
  sparkling: { key: "sparkling", label: "Pétillant", color: "#e2cf7f", light: "#f4ebc4" },
  oil: { key: "oil", label: "Huile d’olive", color: "#7b8a2e", light: "#c5cc7a" },
  other: { key: "other", label: "Vin", color: "#5b7d7f", light: "#a9bfc0" },
};

/** Ordre « du plus léger au plus corsé » pour trier ou dessiner un dégradé. */
export const STYLE_ORDER: ProductStyleKey[] = ["sparkling", "white", "orange", "rose", "red", "oil", "other"];

/** Style CSS d'une pastille ou d'une silhouette à la couleur de la robe (liseré pour les teintes claires). */
export function swatchStyle(style: ProductStyle): string {
  return `background: ${style.color};${style.ring ? ` box-shadow: inset 0 0 0 1px ${style.ring};` : ""}`;
}

/** Style par clé (filtres et légendes qui manipulent des clés). */
export function styleByKey(key: ProductStyleKey): ProductStyle {
  return STYLES[key];
}

export function allProductStyles(): ProductStyle[] {
  return STYLE_ORDER.map((k) => STYLES[k]);
}
