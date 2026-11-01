import { error } from "@sveltejs/kit";
import { isUuid } from "$lib/publicData";
import { supabase } from "$lib/supabase";
import { LOT_PUBLIC_SELECT_BY_PRODUCT } from "$lib/products";
import type { PageLoad } from "./$types";

type OtherProducer = { id: string; name: string; city: string | null; latitude: number | null; longitude: number | null };

export const load: PageLoad = async ({ params }) => {
  if (!isUuid(params.id)) throw error(404, "Page introuvable");

  const [producerRes, lotsRes, othersRes] = await Promise.all([
    supabase
      .from("producer")
      .select("*, region ( name, country ( iso_code, name, flag ) ), country ( iso_code, name, flag )")
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("lot")
      .select(LOT_PUBLIC_SELECT_BY_PRODUCT)
      .eq("product.producer_id", params.id)
      .is("discontinued_at", null)
      .order("year", { ascending: false, nullsFirst: false }),
    supabase
      .from("producer")
      .select("id, name, city, latitude, longitude")
      .neq("id", params.id)
      .eq("hidden", false)
      .order("name"),
  ]);

  if (producerRes.error) throw error(500, "Impossible de charger ce domaine");
  if (!producerRes.data) throw error(404, "Domaine introuvable");
  if (lotsRes.error) throw error(500, "Impossible de charger les produits de ce domaine");

  return {
    producer: producerRes.data as any,
    lots: (lotsRes.data || []) as any[],
    others: (othersRes.data || []) as OtherProducer[],
  };
};
