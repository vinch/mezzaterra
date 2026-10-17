import { supabase } from "$lib/supabase";
import { VINTAGE_PUBLIC_SELECT } from "$lib/wine";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params }) => {
  const { data: vintage, error } = await supabase
    .from("wine_vintage")
    .select(VINTAGE_PUBLIC_SELECT)
    .eq("id", params.id)
    .maybeSingle();

  if (error || !vintage) {
    return { vintage: null as any, siblings: [] as any[], fromWinery: [] as any[] };
  }

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
