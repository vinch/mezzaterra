import { supabase } from "$lib/supabase";
import type { PageLoad } from "./$types";

type WineryPin = { id: string; name: string; latitude: number | null; longitude: number | null };

export const load: PageLoad = async ({ data }) => {
  try {
    const { data: rows } = await supabase
      .from("winery")
      .select("id, name, latitude, longitude")
      .order("name");
    return { ...data, wineries: (rows || []) as WineryPin[] };
  } catch {
    return { ...data, wineries: [] as WineryPin[] };
  }
};
