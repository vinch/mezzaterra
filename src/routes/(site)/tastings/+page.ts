import { supabase } from "$lib/supabase";
import type { PageLoad } from "./$types";

export const load: PageLoad = async () => {
  try {
    const { data, error: fetchError } = await supabase
      .from("tasting")
      .select("*, tasting_wine_vintage ( wine_vintage_id )")
      .order("date", { ascending: false });

    if (fetchError) {
      return { tastings: [] as any[], error: fetchError.message };
    }

    return { tastings: (data || []) as any[], error: null };
  } catch {
    return { tastings: [] as any[], error: "Impossible de charger les dégustations" };
  }
};
