import { supabase } from "$lib/supabase";
import type { PageLoad } from "./$types";

type WineryPin = { id: string; name: string; latitude: number | null; longitude: number | null };

export const load: PageLoad = async () => {
  try {
    const { data } = await supabase
      .from("winery")
      .select("id, name, latitude, longitude")
      .order("name");
    return { wineries: (data || []) as WineryPin[] };
  } catch {
    return { wineries: [] as WineryPin[] };
  }
};
