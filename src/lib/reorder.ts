import { supabase } from "./supabase";
import { todayIso } from "./dates";

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

  const { data: pending } = await supabase
    .from("order")
    .select("id")
    .eq("supplier_id", supplier.supplierId)
    .eq("status", "pending")
    .is("transport_id", null)
    .order("date", { ascending: false })
    .limit(1);

  let orderId = (pending || [])[0]?.id as string | undefined;
  let created = false;

  if (!orderId) {
    const { data: order, error } = await supabase
      .from("order")
      .insert({
        date: todayIso(),
        supplier_id: supplier.supplierId,
        status: "pending",
        transport_id: null,
        total_price: 0,
        note: "Réassort préparé depuis le tableau de bord",
      })
      .select("id")
      .single();
    if (error || !order) throw new Error(error?.message || "Création de la commande impossible");
    orderId = order.id;
    created = true;
  }

  /* Même millésime déjà dans la commande : on augmente la quantité. */
  const { data: existing } = await supabase
    .from("order_item")
    .select("id, quantity")
    .eq("order_id", orderId!)
    .eq("wine_vintage_id", vintageId)
    .limit(1);

  if (existing?.length) {
    const { error } = await supabase
      .from("order_item")
      .update({ quantity: existing[0].quantity + quantity })
      .eq("id", existing[0].id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("order_item").insert({
      order_id: orderId!,
      wine_vintage_id: vintageId,
      quantity,
      price,
      note: null,
    });
    if (error) throw new Error(error.message);
  }

  /* Total recalculé comme dans /manage/orders. */
  const { data: items } = await supabase.from("order_item").select("price, quantity").eq("order_id", orderId!);
  const total = (items || []).reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 0), 0);
  await supabase.from("order").update({ total_price: Math.round(total * 100) / 100 }).eq("id", orderId!);

  return { orderId: orderId!, supplierName: supplier.supplierName, created };
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
