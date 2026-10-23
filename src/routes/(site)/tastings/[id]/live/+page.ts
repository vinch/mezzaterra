import { error } from "@sveltejs/kit";
import { fetchTastingWithWines, isUuid } from "$lib/publicData";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params }) => {
  if (!isUuid(params.id)) throw error(404, "Page introuvable");
  let res;
  try {
    res = await fetchTastingWithWines(params.id);
  } catch {
    return { tasting: null, wineVintages: [] as any[], error: "Impossible de charger la dégustation" };
  }
  if (!res.tasting && !res.error) throw error(404, "Dégustation introuvable");
  return res;
};
