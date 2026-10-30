import { fetchCatalogKinds } from "$lib/publicData";
import type { LayoutServerLoad } from "./$types";

/* Catalogues de la navigation publique (« Nos huiles » dès qu'il y en a), lus côté serveur : une
   seule fois, et non à nouveau à l'hydratation. L'accueil, hors de ce groupe, fait de même. */
export const load: LayoutServerLoad = async () => ({ catalogKinds: await fetchCatalogKinds() });
