import { supabase } from "$lib/supabase";
import { publicVintages, VINTAGE_PUBLIC_SELECT } from "$lib/wine";
import type { PageLoad } from "./$types";

export const load: PageLoad = async () => {
  const { data, error } = await supabase
    .from("wine_vintage")
    .select(VINTAGE_PUBLIC_SELECT)
    .order("year", { ascending: false, nullsFirst: false });

  return {
    vintages: publicVintages((data || []) as any[]),
    error: error ? "Impossible de charger les vins pour le moment." : null,
  };
};
