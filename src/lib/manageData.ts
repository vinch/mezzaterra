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

/**
 * Commandes sans total_price en base (ou à 0) : total recalculé depuis leurs lignes,
 * lues en une seule requête (prix de la ligne, sinon prix d'achat du millésime).
 */
export async function withOrderTotals<T extends { id: string; total_price: number | null }>(orders: T[]): Promise<T[]> {
  const missing = orders.filter((o) => o.total_price == null || o.total_price === 0).map((o) => o.id);
  if (!missing.length) return orders;

  const { data: items } = await supabase
    .from("order_item")
    .select("order_id, quantity, price, wine_vintage ( purchase_price )")
    .in("order_id", missing);

  const totals = new Map<string, number>(missing.map((id) => [id, 0]));
  for (const item of items || []) {
    const price = item.price || item.wine_vintage?.purchase_price || 0;
    totals.set(item.order_id, (totals.get(item.order_id) ?? 0) + price * item.quantity);
  }
  return orders.map((o) => (totals.has(o.id) ? { ...o, total_price: totals.get(o.id)! } : o));
}
