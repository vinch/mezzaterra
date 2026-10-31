import type { ParamMatcher } from "@sveltejs/kit";
import { kindBySlug } from "$lib/productKinds";

/** Catalogues publics par type de produit : `/vins`, `/huiles`. */
export const match: ParamMatcher = (param) => kindBySlug(param) !== null;
