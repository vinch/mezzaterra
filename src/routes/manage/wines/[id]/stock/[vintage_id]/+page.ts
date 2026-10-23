import { supabase } from "$lib/supabase";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params }) => {
  // Millésime (avec son vin), historique des mouvements et stock actuel (vue inventory), en parallèle
  const [
    { data: vintage, error: vintageError },
    { data: stockMoves, error: stockMovesError },
    { data: inventory, error: inventoryError },
  ] = await Promise.all([
    supabase
      .from("wine_vintage")
      .select(
        `
      *,
      wine (
        *,
        winery (*),
        appelation ( *, label (*) ),
        wine_type (*)
      )
    `
      )
      .eq("id", params.vintage_id)
      .single(),
    supabase
      .from("stock_move")
      .select("*")
      .eq("wine_vintage_id", params.vintage_id)
      .order("date", { ascending: false }),
    supabase
      .from("inventory")
      .select("quantity_on_hand")
      .eq("wine_vintage_id", params.vintage_id)
      .maybeSingle(),
  ]);

  if (vintageError) {
    throw new Error(
      `Erreur lors du chargement du millésime: ${vintageError.message}`
    );
  }

  if (stockMovesError) {
    throw new Error(
      `Erreur lors du chargement des mouvements: ${stockMovesError.message}`
    );
  }

  if (inventoryError) {
    console.warn(
      "Aucun stock trouvé pour ce millésime:",
      inventoryError.message
    );
  }

  return {
    vintage,
    stockMoves: stockMoves || [],
    currentStock: inventory?.quantity_on_hand || 0,
  };
};
