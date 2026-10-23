import { error } from "@sveltejs/kit";
import { supabase } from "$lib/supabase";
import { publicVintages, VINTAGE_PUBLIC_SELECT } from "$lib/wine";
import type { PageLoad } from "./$types";

type OtherWinery = { id: string; name: string; city: string | null; latitude: number | null; longitude: number | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageLoad = async ({ params }) => {
  if (!UUID.test(params.id)) throw error(404, "Page introuvable");

  const [wineryRes, vintagesRes, othersRes] = await Promise.all([
    supabase
      .from("winery")
      .select("*, region ( name, country ( iso_code, name, flag ) ), country ( iso_code, name, flag )")
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("wine_vintage")
      .select(VINTAGE_PUBLIC_SELECT)
      .eq("wine.winery_id", params.id)
      .not("wine", "is", null)
      .order("year", { ascending: false, nullsFirst: false }),
    supabase.from("winery").select("id, name, city, latitude, longitude").neq("id", params.id).order("name"),
  ]);

  if (wineryRes.error) throw error(500, "Impossible de charger ce domaine");
  if (!wineryRes.data) throw error(404, "Domaine introuvable");

  return {
    winery: wineryRes.data as any,
    vintages: publicVintages((vintagesRes.data || []) as any[]).filter((v) => v.wine),
    others: (othersRes.data || []) as OtherWinery[],
  };
};
