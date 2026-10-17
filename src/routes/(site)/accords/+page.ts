import { supabase } from "$lib/supabase";
import { VINTAGE_PUBLIC_SELECT } from "$lib/wine";
import type { PageLoad } from "./$types";

export const load: PageLoad = async () => {
  const [pairingsRes, vintagesRes] = await Promise.all([
    supabase.from("pairing").select("id, description").order("description"),
    supabase.from("wine_vintage").select(VINTAGE_PUBLIC_SELECT),
  ]);

  return {
    pairings: (pairingsRes.data || []) as { id: string; description: string }[],
    vintages: (vintagesRes.data || []) as any[],
  };
};
