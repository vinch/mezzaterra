import { supabase } from "$lib/supabase";
import type { PageLoad } from "./$types";

export const load: PageLoad = async () => {
  try {
    const { data, error: fetchError } = await supabase
      .from("tasting")
      .select("*, tasting_lot ( lot_id )")
      /* Les dégustations privées (chez un client, en externe) ne sont pas listées : filtrées dans la
         requête plutôt qu'après coup. Ce n'est pas une protection, leur fiche reste lisible par lien. */
      .eq("is_private", false)
      .order("date", { ascending: false });

    if (fetchError) {
      return { tastings: [] as any[], error: fetchError.message };
    }

    return { tastings: (data || []) as any[], error: null };
  } catch {
    return { tastings: [] as any[], error: "Impossible de charger les dégustations" };
  }
};
