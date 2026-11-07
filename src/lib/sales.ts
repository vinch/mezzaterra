import { supabase } from "./supabase";
import { LINE_ITEMS_SELECT } from "./manageData";
import { lineTotal } from "./analytics";
import { formatEUR, formatPercent, toNumber } from "./format";
import { lotProductLabel } from "./products";
import { statusRank } from "./status";

/** Règles des ventes partagées par la page Ventes et la facture PDF. */

type QuantityLine = { lot_id: string | null; quantity: number | null };

/** Bouteilles par lot (lignes de vente ou de demande ; une ligne sans lot est ignorée). */
export function quantitiesByLot(items: QuantityLine[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const i of items) if (i.lot_id) m.set(i.lot_id, (m.get(i.lot_id) ?? 0) + (i.quantity || 0));
  return m;
}

/** Total des bouteilles (lignes sans lot ignorées, comme dans quantitiesByLot). */
export function totalQuantity(items: QuantityLine[]): number {
  return items.reduce((n, i) => n + (i.lot_id ? i.quantity || 0 : 0), 0);
}

/** Colonnes triables communes aux listes de ventes (page Ventes, historique d'un client). */
export const SALE_SORT_VALUES = {
  date: (s: any) => s.date,
  status: (s: any) => statusRank("sale", s.status),
  total: (s: any) => toNumber(s.total_price),
};

/**
 * Ventes d'une dégustation comptées dans « Ventes de la soirée » (Piloter, liste des dégustations) :
 * toutes sauf les annulées, en attente comprises (le paiement suit souvent la soirée).
 */
export function countedEveningSales<T extends { status: string | null }>(sales: T[]): T[] {
  return sales.filter((s) => s.status !== "cancelled");
}

/** Somme des totaux enregistrés (sale.total_price). */
export function sumSaleTotals(sales: { total_price: unknown }[]): number {
  return sales.reduce((n, s) => n + toNumber(s.total_price), 0);
}

/** « 1 vente », « 3 ventes ». */
export function salesLabel(n: number): string {
  return `${n} vente${n > 1 ? "s" : ""}`;
}

/** Libellé par défaut d'une ligne « Dégustation » (sans lot). */
export const TASTING_LINE_NOTE = "Dégustation";

export const PAYMENT_METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: "liquide", label: "Liquide" },
  { value: "virement", label: "Virement" },
  { value: "payconiq_pro", label: "Payconiq pro" },
  { value: "payconiq_perso", label: "Payconiq perso" },
];

export function paymentMethodLabel(value: string | null | undefined): string {
  if (value == null || String(value).trim() === "") return "—";
  const o = PAYMENT_METHOD_OPTIONS.find((p) => p.value === value);
  return o ? o.label : String(value);
}

/** Libellé d'une ligne de vente : le lot, sinon la note (ligne dégustation). */
export function saleItemDescription(item: any): string {
  if (item.lot_id && item.lot) {
    return lotProductLabel(item.lot);
  }
  const n = item.note != null ? String(item.note).trim() : "";
  return n || TASTING_LINE_NOTE;
}

/**
 * Remise d'une ligne impossible : négative, au-delà de 100 %, ou supérieure au montant de la ligne
 * (contrainte sale_item_discount_check en base). `null` si elle est valable.
 */
export function lineDiscountError(item: { price: unknown; quantity: unknown; discount: unknown; discount_type?: string | null }): string | null {
  const discount = toNumber(item.discount);
  if (discount < 0) return "Une remise ne peut pas être négative.";
  if (discount === 0) return null;
  if (item.discount_type === "percent") {
    return discount > 100 ? "Une remise en pourcentage ne peut pas dépasser 100 %." : null;
  }
  /* Sans type, la remise est ignorée par le calcul (lignes anciennes) : rien à refuser. */
  if (item.discount_type !== "amount") return null;
  const gross = Math.round(toNumber(item.price) * (Number(item.quantity) || 0) * 100) / 100;
  return discount > gross
    ? `La remise (${discount.toFixed(2).replace(".", ",")} €) dépasse le montant de la ligne (${gross.toFixed(2).replace(".", ",")} €).`
    : null;
}

/** Remise d'une ligne telle qu'affichée : « −10 % », « −5,00 € », « — » sans remise. */
export function lineDiscountLabel(item: { discount: unknown; discount_type?: string | null }): string {
  const discount = toNumber(item.discount);
  if (discount <= 0) return "—";
  return item.discount_type === "percent" ? `−${formatPercent(discount)}` : `−${formatEUR(discount)}`;
}

/** Lignes de vente : remises et note (ligne dégustation) en plus des lignes d'articles. */
export const SALE_LINE_ITEMS_SELECT = `${LINE_ITEMS_SELECT}, discount, discount_type, note` as const;

/** Sous-total après remises par ligne (avant ristourne globale), arrondi au centime. */
export function itemsSubtotal(items: any[]): number {
  return Math.round(items.reduce((sum, item) => sum + lineTotal(item), 0) * 100) / 100;
}

/** Total : sous-total moins la ristourne globale (montant ou %). */
export function saleTotal(items: any[], globalDiscount: unknown, globalDiscountType: string): number {
  const subtotal = itemsSubtotal(items);
  const g = toNumber(globalDiscount);
  if (g <= 0) return subtotal;
  if (globalDiscountType === "percent") {
    const pct = Math.min(100, g);
    return Math.max(0, Math.round(subtotal * (1 - pct / 100) * 100) / 100);
  }
  return Math.max(0, Math.round((subtotal - g) * 100) / 100);
}

/** Montant de la ristourne globale : écart entre le sous-total des lignes et le total enregistré. */
export function globalDiscountAmount(items: any[], total: unknown): number {
  return Math.max(0, Math.round((itemsSubtotal(items) - toNumber(total)) * 100) / 100);
}

/**
 * Numéro de facture de la vente, attribué s'il manque par la fonction SQL assign_invoice_number
 * (atomique, séquence continue par année). Lève une erreur lisible en cas d'échec.
 */
export async function ensureInvoiceNumber(sale: { id: string; invoice_number: string | null }): Promise<string> {
  if (sale.invoice_number) return sale.invoice_number;
  const { data, error } = await supabase.rpc("assign_invoice_number", { p_sale_id: sale.id });
  if (error) throw new Error(`Numéro de facture non attribué : ${error.message}`);
  return data;
}
