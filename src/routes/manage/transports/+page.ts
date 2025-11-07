import { supabase } from "$lib/supabase";
import type { PageLoad } from "./$types";

export const load: PageLoad = async () => {
  const { data: transports, error: transportsError } = await supabase
    .from("transport")
    .select(
      `
      *,
      transporter (*)
    `
    )
    .order("departure_date", { ascending: false });

  if (transportsError) {
    throw new Error(
      `Erreur lors du chargement des transports: ${transportsError.message}`
    );
  }

  // Load order count for each transport
  if (transports) {
    const transportsWithOrderCount = await Promise.all(
      transports.map(async (transport) => {
        const { count, error: countError } = await supabase
          .from("order")
          .select("*", { count: "exact", head: true })
          .eq("transport_id", transport.id);

        return {
          ...transport,
          order_count: countError ? 0 : count || 0,
        };
      })
    );

    return {
      transports: transportsWithOrderCount || [],
    };
  }

  return {
    transports: transports || [],
  };
};
