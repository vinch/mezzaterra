import { supabase } from "$lib/supabase";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params }) => {
  const tastingId = params.id;

  if (!tastingId) {
    return {
      tasting: null,
      wineVintages: [],
      error: "No tasting ID provided",
    };
  }

  try {
    // Fetch tasting details
    const { data: tastingData, error: tastingError } = await supabase
      .from("tasting")
      .select("*")
      .eq("id", tastingId)
      .single();

    if (tastingError) {
      return {
        tasting: null,
        wineVintages: [],
        error: tastingError.message,
      };
    }

    // Fetch wine vintages for this tasting
    const { data: wineVintagesData, error: wineVintagesError } = await supabase
      .from("tasting_wine_vintage")
      .select(
        `
        order,
        wine_vintage (
          *,
          wine (
            *,
            winery (
              *,
              region (
                name,
                country (
                  iso_code,
                  name,
                  flag
                )
              ),
              country (
                iso_code,
                name,
                flag
              )
            ),
            appelation (
              name,
              label (name)
            ),
            wine_pairing (
              pairing_id,
              pairing (description)
            )
          ),
          wine_vintage_grape (
            percentage,
            grape (name)
          ),
          note (*)
        )
      `
      )
      .eq("tasting_id", tastingId)
      .order("order");

    if (wineVintagesError) {
      console.error("Error fetching wine vintages:", wineVintagesError);
      return {
        tasting: tastingData,
        wineVintages: [],
        error: null,
      };
    }

    const wineVintages = (wineVintagesData?.map((item) => item.wine_vintage) ||
      []) as unknown as any[];

    return {
      tasting: tastingData,
      wineVintages,
      error: null,
    };
  } catch (err) {
    return {
      tasting: null,
      wineVintages: [],
      error: "Failed to load tasting",
    };
  }
};
