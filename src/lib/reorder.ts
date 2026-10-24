import { supabase } from "./supabase";

/**
 * « Ajouter à la prochaine commande fournisseur » :
 * on retrouve le dernier fournisseur de ce millésime, puis on complète sa commande
 * « En attente » (ou on en crée une). Le stock n'est jamais touché ici :
 * il n'augmente qu'à la livraison du transport, comme avant.
 */

export type ReorderResult = { orderId: string; supplierName: string; created: boolean };

export async function lastSupplierFor(vintageId: string): Promise<{
  supplierId: string;
  supplierName: string;
  lastPrice: number | null;
} | null> {
  const { data } = await supabase
    .from("order_item")
    .select("price, created_at, order ( supplier_id, date, supplier ( name ) )")
    .eq("wine_vintage_id", vintageId)
    .order("created_at", { ascending: false })
    .limit(1);
  const row = (data || [])[0] as any;
  if (!row?.order?.supplier_id) return null;
  return {
    supplierId: row.order.supplier_id,
    supplierName: row.order.supplier?.name || "Fournisseur",
    lastPrice: row.price != null ? Number(row.price) : null,
  };
}

export async function addToNextSupplierOrder(
  vintageId: string,
  quantity: number,
  fallbackPrice: number,
): Promise<ReorderResult> {
  const supplier = await lastSupplierFor(vintageId);
  if (!supplier) {
    throw new Error("Aucune commande précédente pour ce vin : créez la première depuis Commandes.");
  }
  const price = supplier.lastPrice ?? fallbackPrice;

  /* Commande « En attente » du fournisseur complétée (ou créée) en une transaction, total compris. */
  const { data, error } = await supabase.rpc("add_to_supplier_order", {
    p_supplier_id: supplier.supplierId,
    p_vintage_id: vintageId,
    p_quantity: quantity,
    p_price: price,
  });
  const row = data?.[0];
  if (error || !row) throw new Error(error?.message || "Ajout à la commande impossible");

  return { orderId: row.order_id, supplierName: supplier.supplierName, created: row.created };
}

/** Demande le nombre de bouteilles, puis complète la commande ; renvoie le message à afficher (null si annulé). */
export async function promptReorder(
  label: string,
  vintage: { id: string; purchase_price?: number | string | null },
): Promise<string | null> {
  const qty = parseInt(prompt(`Combien de bouteilles de « ${label} » ajouter à la commande fournisseur ?`, "12") ?? "", 10);
  if (!Number.isFinite(qty) || qty < 1) return null;
  const res = await addToNextSupplierOrder(vintage.id, qty, Number(vintage.purchase_price || 0));
  return `${qty} bt. ajoutées à ${res.created ? "une nouvelle commande" : "la commande en attente"} chez ${res.supplierName}.`;
}
