import { supabase } from "$lib/supabase";
import type { PageLoad } from "./$types";

export const load: PageLoad = async () => {
  const { data: sales, error: salesError } = await supabase
    .from("sale")
    .select(
      `
      *,
      customer (*)
    `
    )
    .order("date", { ascending: false });

  if (salesError) {
    throw new Error(
      `Erreur lors du chargement des ventes: ${salesError.message}`
    );
  }

  return {
    sales: sales || [],
  };
};
