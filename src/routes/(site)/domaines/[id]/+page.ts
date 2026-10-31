import { error } from "@sveltejs/kit";
import { isUuid } from "$lib/publicData";
import { supabase } from "$lib/supabase";
import { VINTAGE_PUBLIC_SELECT_BY_WINE } from "$lib/wine";
import type { PageLoad } from "./$types";

type OtherWinery = { id: string; name: string; city: string | null; latitude: number | null; longitude: number | null };

export const load: PageLoad = async ({ params }) => {
  if (!isUuid(params.id)) throw error(404, "Page introuvable");

  const [wineryRes, vintagesRes, othersRes] = await Promise.all([
    supabase
      .from("winery")
      .select("*, region ( name, country ( iso_code, name, flag ) ), country ( iso_code, name, flag )")
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("wine_vintage")
      .select(VINTAGE_PUBLIC_SELECT_BY_WINE)
      .eq("wine.winery_id", params.id)
      .is("discontinued_at", null)
      .order("year", { ascending: false, nullsFirst: false }),
    supabase
      .from("winery")
      .select("id, name, city, latitude, longitude")
      .neq("id", params.id)
      .eq("hidden", false)
      .order("name"),
  ]);

  if (wineryRes.error) throw error(500, "Impossible de charger ce domaine");
  if (!wineryRes.data) throw error(404, "Domaine introuvable");

  return {
    winery: wineryRes.data as any,
    vintages: (vintagesRes.data || []) as any[],
    others: (othersRes.data || []) as OtherWinery[],
  };
};
