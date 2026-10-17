import { fetchTastingWithWines } from "$lib/publicData";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params }) => {
  try {
    return await fetchTastingWithWines(params.id);
  } catch {
    return { tasting: null, wineVintages: [] as any[], error: "Impossible de charger la dégustation" };
  }
};
