import { fetchCatalogKinds } from "$lib/publicData";
import type { LayoutServerLoad } from "./$types";

/* Catalogues de la navigation publique (« Nos huiles » dès qu'il y en a), lus une fois côté serveur
   pour l'accueil et tout le site plutôt qu'à chaque page et à nouveau à l'hydratation. */
export const load: LayoutServerLoad = async () => ({ catalogKinds: await fetchCatalogKinds() });
