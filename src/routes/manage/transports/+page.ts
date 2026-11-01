import { supabase } from "$lib/supabase";
import type { PageLoad } from "./$types";

export const load: PageLoad = async () => {
  /* Transporteurs chargés en même temps que la liste : le formulaire n'attend plus après. */
  const [{ data: transports, error: transportsError }, { data: transporters, error: transportersError }] = await Promise.all([
    supabase
      .from("transport")
      .select("*, transporter (*), order ( count )")
      .order("departure_date", { ascending: false }),
    supabase.from("transporter").select("*").order("name"),
  ]);

  if (transportsError) {
    throw new Error(`Erreur lors du chargement des transports: ${transportsError.message}`);
  }
  if (transportersError) {
    throw new Error(`Erreur lors du chargement des transporteurs: ${transportersError.message}`);
  }

  return {
    transporters: transporters || [],
    transports: (transports || []).map(({ order, ...transport }) => ({
      ...transport,
      order_count: order[0]?.count ?? 0,
    })),
  };
};
