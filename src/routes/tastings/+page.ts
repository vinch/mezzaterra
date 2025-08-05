import { supabase } from "$lib/supabase";
import type { PageLoad } from "./$types";

export const load: PageLoad = async () => {
  try {
    const { data, error: fetchError } = await supabase
      .from("tasting")
      .select("*")
      .order("created_at", { ascending: false });

    if (fetchError) {
      return {
        tastings: [],
        error: fetchError.message,
      };
    }

    return {
      tastings: data || [],
      error: null,
    };
  } catch (err) {
    return {
      tastings: [],
      error: "Failed to load tastings",
    };
  }
};
