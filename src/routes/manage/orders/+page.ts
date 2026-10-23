import { supabase } from "$lib/supabase";
import type { PageLoad } from "./$types";

export const load: PageLoad = async () => {
  const { data: orders, error: ordersError } = await supabase
    .from("order")
    .select(
      `
      *,
      supplier (*),
      transport (
        *,
        transporter (*)
      )
    `
    )
    .order("date", { ascending: false });

  if (ordersError) {
    throw new Error(
      `Erreur lors du chargement des commandes: ${ordersError.message}`
    );
  }

  return { orders: await withTotals(orders || []) };
};

/**
 * Commandes sans total_price en base (ou à 0) : total recalculé depuis leurs lignes,
 * lues en une seule requête (prix de la ligne, sinon prix d'achat du millésime).
 */
async function withTotals<T extends { id: string; total_price: number | null }>(orders: T[]): Promise<T[]> {
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
