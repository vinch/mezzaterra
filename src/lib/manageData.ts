import { supabase } from "./supabase";
import { sortCustomersByLabel } from "./customerDisplay";
import { compareVintages } from "./wine";
import type { Customer } from "./types";

/** Chargements partagés par les pages de l'admin. */

/** Clients triés par libellé (sélecteurs, autocomplétion). */
export async function fetchCustomers(): Promise<Customer[]> {
  const { data } = await supabase.from("customer").select("*");
  return sortCustomersByLabel((data || []) as Customer[]);
}

/** Millésimes des sélecteurs de produit, triés domaine → cuvée → année décroissante. */
export async function fetchPickerVintages(): Promise<any[]> {
  const { data } = await supabase
    .from("wine_vintage")
    .select("*, wine ( *, winery (*), appelation (*), wine_type (*) )");
  return (data || []).sort(compareVintages);
}

/** Bouteilles en stock par millésime (vue `inventory`), en une requête. */
export async function fetchStockMap(): Promise<Map<string, number>> {
  const { data } = await supabase.from("inventory").select("wine_vintage_id, quantity_on_hand");
  return new Map((data || []).map((r) => [r.wine_vintage_id as string, r.quantity_on_hand ?? 0]));
}
