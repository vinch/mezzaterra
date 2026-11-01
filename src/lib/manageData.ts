import { fetchAllRows, supabase } from "./supabase";
import { sortCustomersByLabel } from "./customerDisplay";
import { byProductType, compareLotsByProducer, LOT_LABEL_SELECT } from "./products";
import type { Country, Customer, Region, ProductType } from "./types";

/** Chargements partagés par les pages de l'admin. */

/** Clients triés par libellé (sélecteurs, autocomplétion). */
export async function fetchCustomers(): Promise<Customer[]> {
  const rows = await fetchAllRows<Customer>((from, to) => supabase.from("customer").select("*").order("id").range(from, to));
  return sortCustomersByLabel(rows);
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

/** Types de produit (robes, fruités) dans l'ordre des listes : vins puis huiles, du fruité léger à l'intense. */
export async function fetchProductTypes(): Promise<ProductType[]> {
  const { data } = await supabase.from("product_type").select("*");
  return (data || []).sort(byProductType);
}

/** Lots des sélecteurs de produit, triés producteur → cuvée → année décroissante. */
export async function fetchPickerLots(): Promise<any[]> {
  const rows = await fetchAllRows<any>((from, to) =>
    supabase
      .from("lot")
      .select("*, product ( *, producer (*), appellation (*), product_type (*) )")
      .order("id")
      .range(from, to),
  );
  return rows.sort(compareLotsByProducer);
}

/**
 * Bouteilles en stock par lot (vue `inventory`), éventuellement limitées à quelques
 * lots. Lève une erreur plutôt que de renvoyer une carte vide : un échec afficherait
 * sinon tout le catalogue en rupture.
 */
export async function fetchStockMap(lotIds?: string[]): Promise<Map<string, number>> {
  const rows = await fetchAllRows<{ lot_id: string | null; quantity_on_hand: number | null }>((from, to) => {
    let query = supabase.from("inventory").select("lot_id, quantity_on_hand");
    if (lotIds) query = query.in("lot_id", lotIds);
    return query.order("lot_id").order("quantity_on_hand").range(from, to);
  });
  /* Plusieurs lignes pour un lot : quantités additionnées. */
  const stock = new Map<string, number>();
  for (const r of rows) {
    if (r.lot_id) stock.set(r.lot_id, (stock.get(r.lot_id) ?? 0) + (r.quantity_on_hand ?? 0));
  }
  return stock;
}

/** Stock d'un lot ; null s'il est illisible (affiché comme tel, pas en rupture). */
export function lotStock(lotId: string): Promise<number | null> {
  return fetchStockMap([lotId])
    .then((stock) => stock.get(lotId) ?? 0)
    .catch(() => null);
}

/** Lignes d'articles (vente ou commande) : de quoi les libeller et les chiffrer. */
export const LINE_ITEMS_SELECT = `price, quantity, lot_id, lot ( ${LOT_LABEL_SELECT} )` as const;

/**
 * Lignes d'une vente ou d'une commande (`select` : LINE_ITEMS_SELECT, SALE_LINE_ITEMS_SELECT…).
 * Lève une erreur : une édition ouverte sans ses lignes les effacerait à l'enregistrement.
 */
export async function fetchLineItems(parent: "sale" | "order", id: string, select: string): Promise<any[]> {
  const { data, error } = await supabase.from(`${parent}_item`).select(select).eq(`${parent}_id`, id);
  if (error) throw new Error(error.message);
  return data || [];
}
