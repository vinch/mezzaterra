import { fetchCatalogKinds } from "$lib/publicData";
import type { PageServerLoad } from "./$types";

/* Navigation de l'accueil : comme (site)/+layout.server.ts. */
export const load: PageServerLoad = async () => ({ catalogKinds: await fetchCatalogKinds() });
