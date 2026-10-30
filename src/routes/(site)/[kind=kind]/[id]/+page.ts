import { error, redirect } from "@sveltejs/kit";
import { isUuid } from "$lib/publicData";
import { kindBySlug, kindOf, productHref } from "$lib/productKinds";
import { supabase } from "$lib/supabase";
import { groupFormats, isDiscontinued, publicVintages, VINTAGE_PUBLIC_SELECT } from "$lib/wine";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params, url }) => {
  if (!isUuid(params.id)) throw error(404, "Page introuvable");
  const { data: vintage, error: fetchError } = await supabase
    .from("wine_vintage")
    .select(VINTAGE_PUBLIC_SELECT)
    .eq("id", params.id)
    .maybeSingle();

  if (fetchError) throw error(500, "Impossible de charger ce produit");
  if (!vintage || isDiscontinued(vintage as any)) throw error(404, "Produit introuvable");

  const v = vintage as any;
  /* Une huile ouverte sous /vins (ou l'inverse) : vers la bonne adresse. */
  if (kindOf(v.wine) !== kindBySlug(params.kind)) throw redirect(301, productHref(v) + url.search);
  const wineryId = v.wine?.winery_id ?? v.wine?.winery?.id;

  /* Autres lots du même produit (contenants et années) + autres produits du domaine. */
  const [siblingsRes, wineryRes] = await Promise.all([
    supabase
      .from("wine_vintage")
      .select("*")
      .eq("wine_id", v.wine_id)
      .neq("id", v.id)
      .order("year", { ascending: false }),
    wineryId
      ? supabase
          .from("wine_vintage")
          .select(`${VINTAGE_PUBLIC_SELECT}`)
          .neq("wine_id", v.wine_id)
          .eq("wine.winery_id", wineryId)
          .not("wine", "is", null)
      : Promise.resolve({ data: [] }),
  ]);

  /* Un seul millésime (le plus récent) par vin du domaine. */
  const byWine = new Map<string, any>();
  for (const row of publicVintages((wineryRes.data || []) as any[])) {
    if (!row.wine) continue;
    const prev = byWine.get(row.wine_id);
    if (!prev || (row.year ?? 0) > (prev.year ?? 0)) byWine.set(row.wine_id, row);
  }

  /* Contenants de la même année (celui-ci compris), puis une entrée par autre année (son plus petit contenant). */
  const [current, ...otherYears] = groupFormats([v, ...publicVintages((siblingsRes.data || []) as any[])]);

  return {
    vintage: v,
    formats: current.formats,
    siblings: otherYears.map((g) => g.vintage),
    fromWinery: [...byWine.values()].slice(0, 6),
  };
};
