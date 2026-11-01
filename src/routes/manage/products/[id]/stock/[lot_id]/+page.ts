import { supabase } from "$lib/supabase";
import { lotStock } from "$lib/manageData";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params }) => {
  // Millésime (avec son vin), historique des mouvements et stock actuel (vue inventory), en parallèle
  const [
    { data: lot, error: lotError },
    { data: stockMoves, error: stockMovesError },
    currentStock,
  ] = await Promise.all([
    supabase
      .from("lot")
      .select(
        `
      *,
      product (
        *,
        producer (*),
        appellation ( *, label (*) ),
        product_type (*)
      )
    `
      )
      .eq("id", params.lot_id)
      .single(),
    supabase
      .from("stock_move")
      .select("*")
      .eq("lot_id", params.lot_id)
      .order("date", { ascending: false }),
    lotStock(params.lot_id),
  ]);

  if (lotError) {
    throw new Error(
      `Erreur lors du chargement du lot : ${lotError.message}`
    );
  }

  if (stockMovesError) {
    throw new Error(
      `Erreur lors du chargement des mouvements: ${stockMovesError.message}`
    );
  }

  return {
    lot,
    stockMoves: stockMoves || [],
    currentStock,
  };
};
