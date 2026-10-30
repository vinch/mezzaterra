import { supabase } from "$lib/supabase";
import { kindBySlug, PRODUCT_KINDS } from "$lib/productKinds";
import { publicVintages, VINTAGE_PUBLIC_SELECT_BY_WINE } from "$lib/wine";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params }) => {
  /* Le segment est garanti par le matcher `kind` (src/params/kind.ts). */
  const kind = kindBySlug(params.kind)!;
  const { data, error } = await supabase
    .from("wine_vintage")
    .select(VINTAGE_PUBLIC_SELECT_BY_WINE)
    .eq("wine.kind", kind)
    .order("year", { ascending: false, nullsFirst: false });

  return {
    kind,
    vintages: publicVintages((data || []) as any[]),
    error: error ? `Impossible de charger les ${PRODUCT_KINDS[kind].plural.toLowerCase()} pour le moment.` : null,
  };
};
