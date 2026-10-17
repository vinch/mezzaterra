import { error } from "@sveltejs/kit";
import { fetchTastingWithWines } from "$lib/publicData";
import type { PageLoad } from "./$types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageLoad = async ({ params }) => {
  if (!UUID.test(params.id)) throw error(404, "Page introuvable");
  let res;
  try {
    res = await fetchTastingWithWines(params.id);
  } catch {
    return { tasting: null, wineVintages: [] as any[], error: "Impossible de charger la dégustation" };
  }
  if (!res.tasting && !res.error) throw error(404, "Dégustation introuvable");
  return res;
};
