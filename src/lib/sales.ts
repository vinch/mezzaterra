import { supabase } from "./supabase";
import { LINE_ITEMS_SELECT } from "./manageData";
import { lineTotal } from "./analytics";
import { formatEUR, formatPercent, toNumber } from "./format";
import { lotProductLabel } from "./products";

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
export const SALE_LINE_ITEMS_SELECT = `${LINE_ITEMS_SELECT}, discount, discount_type, note, vat_rate` as const;

/** Sous-total TTC après remises par ligne (avant ristourne globale), arrondi au centime. */
export function itemsSubtotal(items: any[]): number {
  return Math.round(items.reduce((sum, item) => sum + lineTotal(item), 0) * 100) / 100;
}

/** Total TTC : sous-total moins la ristourne globale (montant ou %). */
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
 * Taux de TVA d'une ligne de vente, figé en base à son enregistrement (`sale_item.vat_rate`, fonction
 * SQL product_kind_vat_rate) : 6 % pour l'huile, 21 % pour le vin et les dégustations.
 */
export function itemVatRate(item: { vat_rate?: number | string | null }): number {
  return toNumber(item.vat_rate);
}

/**
 * Ventilation TVA d'une vente (prix TTC) : par taux, le TTC, le HTVA et la TVA, ristourne globale
 * répartie au prorata des lignes. Une vente peut mêler vin (21 %), huile (6 %) et dégustation.
 */
export function vatBreakdown(items: any[], total: unknown): { rate: number; ttc: number; ht: number; vat: number }[] {
  const subtotal = itemsSubtotal(items);
  const factor = subtotal > 0 ? toNumber(total) / subtotal : 1;
  const byRate = new Map<number, number>();
  for (const item of items) {
    const rate = itemVatRate(item);
    byRate.set(rate, (byRate.get(rate) ?? 0) + lineTotal(item) * factor);
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  const parts = [...byRate].sort(([a], [b]) => a - b).map(([rate, ttc]) => ({ rate, ttc: round(ttc) }));
  /* Le centime d'arrondi de la répartition va à la plus grosse part : les parts somment au total facturé. */
  const gap = round(toNumber(total) - parts.reduce((sum, p) => sum + p.ttc, 0));
  if (gap && parts.length) {
    const largest = parts.reduce((max, p) => (p.ttc > max.ttc ? p : max));
    largest.ttc = round(largest.ttc + gap);
  }
  return parts.map(({ rate, ttc }) => {
    const ht = round(ttc / (1 + rate));
    return { rate, ttc, ht, vat: round(ttc - ht) };
  });
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
