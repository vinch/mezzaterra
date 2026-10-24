import { error } from "@sveltejs/kit";
import { fetchTastingWithWines, isUuid } from "$lib/publicData";
import { winesRevealed } from "$lib/dates";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params }) => {
  if (!isUuid(params.id)) throw error(404, "Page introuvable");
  let res;
  try {
    res = await fetchTastingWithWines(params.id, { reveal: winesRevealed });
  } catch {
    return { tasting: null, wineVintages: [] as any[], hiddenCount: 0, error: "Impossible de charger la dégustation" };
  }
  if (!res.tasting && !res.error) throw error(404, "Dégustation introuvable");
  return res;
};
