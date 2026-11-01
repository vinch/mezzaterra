import { fetchCatalogKinds } from "$lib/publicData";
import { supabase } from "$lib/supabase";
import type { PageLoad } from "./$types";

type ProducerPin = { id: string; name: string; latitude: number | null; longitude: number | null };

async function fetchProducers(): Promise<ProducerPin[]> {
  try {
    const { data } = await supabase
      .from("producer")
      .select("id, name, latitude, longitude")
      .eq("hidden", false)
      .order("name");
    return (data || []) as ProducerPin[];
  } catch {
    return [];
  }
}

/* Catalogues de la navigation lus avec les producteurs, en parallèle (le site les lit dans (site)/+layout.server.ts). */
export const load: PageLoad = async () => {
  const [producers, catalogKinds] = await Promise.all([fetchProducers(), fetchCatalogKinds()]);
  return { producers, catalogKinds };
};
