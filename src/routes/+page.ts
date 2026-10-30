import { fetchCatalogKinds } from "$lib/publicData";
import { supabase } from "$lib/supabase";
import type { PageLoad } from "./$types";

type WineryPin = { id: string; name: string; latitude: number | null; longitude: number | null };

async function fetchWineries(): Promise<WineryPin[]> {
  try {
    const { data } = await supabase
      .from("winery")
      .select("id, name, latitude, longitude")
      .order("name");
    return (data || []) as WineryPin[];
  } catch {
    return [];
  }
}

/* Catalogues de la navigation lus avec les domaines, en parallèle (le site les lit dans (site)/+layout.server.ts). */
export const load: PageLoad = async () => {
  const [wineries, catalogKinds] = await Promise.all([fetchWineries(), fetchCatalogKinds()]);
  return { wineries, catalogKinds };
};
