import { fetchAllRows, supabase } from "./supabase";
import { sortCustomersByLabel } from "./customerDisplay";
import { compareVintages } from "./wine";
import type { Country, Customer, Region } from "./types";

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

/** Millésimes des sélecteurs de produit, triés domaine → cuvée → année décroissante. */
export async function fetchPickerVintages(): Promise<any[]> {
  const rows = await fetchAllRows<any>((from, to) =>
    supabase
      .from("wine_vintage")
      .select("*, wine ( *, winery (*), appelation (*), wine_type (*) )")
      .order("id")
      .range(from, to),
  );
  return rows.sort(compareVintages);
}

/**
 * Bouteilles en stock par millésime (vue `inventory`), éventuellement limitées à quelques
 * millésimes. Lève une erreur plutôt que de renvoyer une carte vide : un échec afficherait
 * sinon tout le catalogue en rupture.
 */
export async function fetchStockMap(vintageIds?: string[]): Promise<Map<string, number>> {
  const rows = await fetchAllRows<{ wine_vintage_id: string | null; quantity_on_hand: number | null }>((from, to) => {
    let query = supabase.from("inventory").select("wine_vintage_id, quantity_on_hand");
    if (vintageIds) query = query.in("wine_vintage_id", vintageIds);
    return query.order("wine_vintage_id").order("quantity_on_hand").range(from, to);
  });
  /* Plusieurs lignes pour un millésime : quantités additionnées. */
  const stock = new Map<string, number>();
  for (const r of rows) {
    if (r.wine_vintage_id) stock.set(r.wine_vintage_id, (stock.get(r.wine_vintage_id) ?? 0) + (r.quantity_on_hand ?? 0));
  }
  return stock;
}

/** Lignes d'articles (vente ou commande) : de quoi les libeller et les chiffrer. */
export const LINE_ITEMS_SELECT =
  "price, quantity, wine_vintage_id, wine_vintage ( year, production_year, wine ( name, winery ( name ), appelation ( name ) ) )";

