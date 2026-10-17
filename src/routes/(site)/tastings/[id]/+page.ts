import { fetchTastingWithWines } from "$lib/publicData";
import { winesRevealed } from "$lib/dates";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params }) => {
  try {
    return await fetchTastingWithWines(params.id, { reveal: winesRevealed });
  } catch {
    return { tasting: null, wineVintages: [] as any[], hiddenCount: 0, error: "Impossible de charger la dégustation" };
  }
};
