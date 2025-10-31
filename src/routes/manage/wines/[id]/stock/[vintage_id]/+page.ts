import { supabase } from "$lib/supabase";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params }) => {
  // Charger les données du millésime avec le vin
  const { data: vintage, error: vintageError } = await supabase
    .from("wine_vintage")
    .select(
      `
      *,
      wine (
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
        wine_type (*)
      )
    `
    )
    .eq("id", params.vintage_id)
    .single();

  if (vintageError) {
    throw new Error(
      `Erreur lors du chargement du millésime: ${vintageError.message}`
    );
  }

  // Charger l'historique des mouvements de stock
  const { data: stockMoves, error: stockMovesError } = await supabase
    .from("stock_move")
    .select("*")
    .eq("wine_vintage_id", params.vintage_id)
    .order("date", { ascending: false });

  if (stockMovesError) {
    throw new Error(
      `Erreur lors du chargement des mouvements: ${stockMovesError.message}`
    );
  }

  // Récupérer le stock actuel depuis la vue inventory
  const { data: inventory, error: inventoryError } = await supabase
    .from("inventory")
    .select("quantity_on_hand")
    .eq("wine_vintage_id", params.vintage_id)
    .maybeSingle();

  let currentStock = 0;
  if (inventoryError) {
    console.warn(
      "Aucun stock trouvé pour ce millésime:",
      inventoryError.message
    );
    currentStock = 0;
  } else if (inventory) {
    currentStock = inventory.quantity_on_hand || 0;
  }

  return {
    vintage,
    stockMoves: stockMoves || [],
    currentStock,
  };
};
