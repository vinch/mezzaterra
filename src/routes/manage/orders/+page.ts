import { supabase } from "$lib/supabase";
import type { PageLoad } from "./$types";

export const load: PageLoad = async () => {
  const { data: orders, error: ordersError } = await supabase
    .from("order")
    .select(
      `
      *,
      supplier (*),
      transport (
        *,
        transporter (*)
      )
    `
    )
    .order("date", { ascending: false });

  if (ordersError) {
    throw new Error(
      `Erreur lors du chargement des commandes: ${ordersError.message}`
    );
  }

  return { orders: orders || [] };
};
