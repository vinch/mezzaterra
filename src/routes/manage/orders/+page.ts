import { supabase } from "$lib/supabase";
import type { PageLoad } from "./$types";

export const load: PageLoad = async () => {
  /* Fournisseurs chargés en même temps que la liste ; le catalogue, lui, en arrière-plan par la page. */
  const [{ data: orders, error: ordersError }, { data: suppliers, error: suppliersError }] = await Promise.all([
    supabase
      .from("order")
      .select("*, supplier (*), transport ( *, transporter (*) )")
      .order("date", { ascending: false }),
    supabase.from("supplier").select("*").order("name"),
  ]);

  if (ordersError) {
    throw new Error(`Erreur lors du chargement des commandes: ${ordersError.message}`);
  }
  if (suppliersError) {
    throw new Error(`Erreur lors du chargement des fournisseurs: ${suppliersError.message}`);
  }

  return { orders: orders || [], suppliers: suppliers || [] };
};
