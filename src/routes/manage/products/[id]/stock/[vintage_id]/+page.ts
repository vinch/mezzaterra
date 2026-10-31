import { supabase } from "$lib/supabase";
import { vintageStock } from "$lib/manageData";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params }) => {
  // Millésime (avec son vin), historique des mouvements et stock actuel (vue inventory), en parallèle
  const [
    { data: vintage, error: vintageError },
    { data: stockMoves, error: stockMovesError },
    currentStock,
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
    vintageStock(params.vintage_id),
  ]);

  if (vintageError) {
    throw new Error(
      `Erreur lors du chargement du lot : ${vintageError.message}`
    );
  }

  if (stockMovesError) {
    throw new Error(
      `Erreur lors du chargement des mouvements: ${stockMovesError.message}`
    );
  }

  return {
    vintage,
    stockMoves: stockMoves || [],
    currentStock,
  };
};
