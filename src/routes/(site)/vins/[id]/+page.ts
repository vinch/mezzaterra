import { error } from "@sveltejs/kit";
import { supabase } from "$lib/supabase";
import { VINTAGE_PUBLIC_SELECT } from "$lib/wine";
import type { PageLoad } from "./$types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageLoad = async ({ params }) => {
  if (!UUID.test(params.id)) throw error(404, "Page introuvable");
  const { data: vintage, error: fetchError } = await supabase
    .from("wine_vintage")
    .select(VINTAGE_PUBLIC_SELECT)
    .eq("id", params.id)
    .maybeSingle();

  if (fetchError) throw error(500, "Impossible de charger ce vin");
  if (!vintage) throw error(404, "Vin introuvable");

  const v = vintage as any;
  const wineryId = v.wine?.winery_id ?? v.wine?.winery?.id;

  /* Autres millésimes du même vin + autres vins du domaine. */
  const [siblingsRes, wineryRes] = await Promise.all([
    supabase
      .from("wine_vintage")
      .select("id, year, production_year, price, image_url")
      .eq("wine_id", v.wine_id)
      .neq("id", v.id)
      .order("year", { ascending: false }),
    wineryId
      ? supabase
          .from("wine_vintage")
          .select(`${VINTAGE_PUBLIC_SELECT}`)
          .neq("wine_id", v.wine_id)
          .eq("wine.winery_id", wineryId)
          .not("wine", "is", null)
      : Promise.resolve({ data: [] }),
  ]);

  /* Un seul millésime (le plus récent) par vin du domaine. */
  const byWine = new Map<string, any>();
  for (const row of (wineryRes.data || []) as any[]) {
    if (!row.wine) continue;
    const prev = byWine.get(row.wine_id);
    if (!prev || (row.year ?? 0) > (prev.year ?? 0)) byWine.set(row.wine_id, row);
  }

  return {
    vintage: v,
    siblings: (siblingsRes.data || []) as any[],
    fromWinery: [...byWine.values()].slice(0, 6),
  };
};
