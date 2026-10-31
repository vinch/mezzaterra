import type { ProductKind } from "$lib/productKinds";
import { IconGrape, IconOil, IconOlive, IconWine } from "./icons";

type Icon = typeof IconWine;

/** Icônes d'un type de produit : le produit lui-même et sa composition (cépages, variétés d'olives). */
export const KIND_ICONS: Record<ProductKind, { product: Icon; ingredient: Icon }> = {
  wine: { product: IconWine, ingredient: IconGrape },
  olive_oil: { product: IconOil, ingredient: IconOlive },
};
