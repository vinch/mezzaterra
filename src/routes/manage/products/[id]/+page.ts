import { supabase } from "$lib/supabase";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params }) => {
  // Charger le produit avec ses lots
  const { data: product, error: productError } = await supabase
    .from("product")
    .select(
      `
      *,
      producer (*),
      appellation ( *, label (*) ),
      product_type (*),
      lots:lot (*)
    `
    )
    .eq("id", params.id)
    .single();

  if (productError) {
    throw new Error(`Erreur lors du chargement du produit : ${productError.message}`);
  }

  return {
    product,
  };
};
