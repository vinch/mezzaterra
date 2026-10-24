import { fetchAllRows, supabase } from "./supabase";
import { sortCustomersByLabel } from "./customerDisplay";
import { compareVintages } from "./wine";
import type { Country, Customer, Region } from "./types";

/** Chargements partagés par les pages de l'admin. */

/** Clients triés par libellé (sélecteurs, autocomplétion). */
export async function fetchCustomers(): Promise<Customer[]> {
  const { data } = await supabase.from("customer").select("*");
  return sortCustomersByLabel((data || []) as Customer[]);
}

/** Pays triés par nom (sélecteurs des référentiels). */
export async function fetchCountries(): Promise<Country[]> {
  const { data } = await supabase.from("country").select("*").order("name");
  return data || [];
}

/** Régions (avec leur pays) triées par nom. */
export async function fetchRegions(): Promise<Region[]> {
  const { data } = await supabase.from("region").select("*, country (*)").order("name");
  return data || [];
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

/** Lignes d'articles (vente ou commande) : de quoi les libeller et les chiffrer. */
export const LINE_ITEMS_SELECT =
  "price, quantity, wine_vintage_id, wine_vintage ( year, production_year, purchase_price, wine ( name, winery ( name ), appelation ( name ) ) )";

/** Prix d'une ligne de commande : le sien (0 compris, ex. bouteilles offertes), sinon le prix d'achat du millésime. */
export function orderItemPrice(item: {
  price: number | null;
  wine_vintage?: { purchase_price?: number | null } | null;
}): number {
  return item.price ?? item.wine_vintage?.purchase_price ?? 0;
}

/**
 * Commandes sans total_price en base (ou à 0) : total recalculé depuis leurs lignes,
 * lues par lots de 100 commandes (URL courte) et paginées au-delà de 1000 lignes.
 */
export async function withOrderTotals<T extends { id: string; total_price: number | null }>(orders: T[]): Promise<T[]> {
  const missing = orders.filter((o) => o.total_price == null || o.total_price === 0).map((o) => o.id);
  if (!missing.length) return orders;

  const chunks: string[][] = [];
  for (let i = 0; i < missing.length; i += 100) chunks.push(missing.slice(i, i + 100));
  let items: { order_id: string; quantity: number; price: number | null; wine_vintage: { purchase_price: number } | null }[];
  try {
    const pages = await Promise.all(
      chunks.map((ids) =>
        fetchAllRows<(typeof items)[number]>((from, to) =>
          supabase
            .from("order_item")
            .select("order_id, quantity, price, wine_vintage ( purchase_price )")
            .in("order_id", ids)
            .range(from, to),
        ),
      ),
    );
    items = pages.flat();
  } catch (e) {
    console.error("Totaux des commandes non recalculés :", e);
    return orders;
  }

  const totals = new Map<string, number>(missing.map((id) => [id, 0]));
  for (const item of items) {
    totals.set(item.order_id, (totals.get(item.order_id) ?? 0) + orderItemPrice(item) * item.quantity);
  }
  return orders.map((o) => (totals.has(o.id) ? { ...o, total_price: totals.get(o.id)! } : o));
}
