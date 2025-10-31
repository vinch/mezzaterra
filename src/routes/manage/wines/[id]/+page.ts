import { supabase } from "$lib/supabase";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params }) => {
  // Charger les données du vin avec ses vintages
  const { data: wine, error: wineError } = await supabase
    .from("wine")
    .select(
      `
      *,
      winery (
        *,
        region (
          *,
          country (*)
        ),
        country (*)
      ),
      appelation (
        *,
        region (
          *,
          country (*)
        ),
        label (*)
      ),
      wine_type (*),
      wine_vintage (*)
    `
    )
    .eq("id", params.id)
    .single();

  if (wineError) {
    throw new Error(`Erreur lors du chargement du vin: ${wineError.message}`);
  }

  return {
    wine,
  };
};
