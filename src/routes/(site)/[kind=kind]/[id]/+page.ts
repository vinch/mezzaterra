import { error, redirect } from "@sveltejs/kit";
import { isUuid } from "$lib/publicData";
import { kindBySlug, kindOf, lotHref } from "$lib/productKinds";
import { supabase } from "$lib/supabase";
import { compareLotsByStyle, groupFormats, LOT_PUBLIC_SELECT, LOT_PUBLIC_SELECT_BY_PRODUCT } from "$lib/products";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params, url }) => {
  if (!isUuid(params.id)) throw error(404, "Page introuvable");
  const { data: lot, error: fetchError } = await supabase
    .from("lot")
    .select(LOT_PUBLIC_SELECT)
    .eq("id", params.id)
    .is("discontinued_at", null)
    .maybeSingle();

  if (fetchError) throw error(500, "Impossible de charger ce produit");
  const v = lot as any;
  /* Sans son produit (illisible ou absent), le lot n'a rien à montrer. */
  if (!v?.product) throw error(404, "Produit introuvable");
  /* Une huile ouverte sous /vins (ou l'inverse) : vers la bonne adresse. */
  if (kindOf(v.product) !== kindBySlug(params.kind)) throw redirect(301, lotHref(v) + url.search);
  const producerId = v.product?.producer_id ?? v.product?.producer?.id;

  /* Autres lots du même produit (contenants et années) + autres produits du producteur. */
  const [siblingsRes, producerRes] = await Promise.all([
    supabase
      .from("lot")
      .select("*")
      .eq("product_id", v.product_id)
      .neq("id", v.id)
      .is("discontinued_at", null)
      .order("year", { ascending: false }),
    producerId
      ? supabase
          .from("lot")
          .select(LOT_PUBLIC_SELECT_BY_PRODUCT)
          .neq("product_id", v.product_id)
          .eq("product.producer_id", producerId)
          .is("discontinued_at", null)
      : Promise.resolve({ data: [] }),
  ]);

  /* Un seul lot par produit du producteur : le plus récent, dans son plus petit contenant. */
  const byProduct = new Map<string, any>();
  for (const row of (producerRes.data || []) as any[]) {
    const prev = byProduct.get(row.product_id);
    const newer = !prev || (row.year ?? 0) > (prev.year ?? 0);
    if (newer || ((row.year ?? 0) === (prev.year ?? 0) && row.volume_ml < prev.volume_ml)) byProduct.set(row.product_id, row);
  }

  /* Contenants de la même année (celui-ci compris), puis une entrée par autre année (son plus petit contenant). */
  const [current, ...otherYears] = groupFormats([v, ...((siblingsRes.data || []) as any[])]);

  return {
    lot: v,
    formats: current.formats,
    siblings: otherYears.map((g) => g.lot),
    fromProducer: [...byProduct.values()].sort(compareLotsByStyle).slice(0, 6),
  };
};
