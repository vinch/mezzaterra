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

  return {
    transports: transports || [],
  };
};
