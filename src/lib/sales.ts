import { supabase } from "./supabase";
import { LINE_ITEMS_SELECT } from "./manageData";
import { lineTotal } from "./analytics";
import { toNumber } from "./format";
import { vintageProductLabel } from "./wine";
import { kindInfo } from "./productKinds";

/** Règles des ventes partagées par la page Ventes et la facture PDF. */

/** Libellé par défaut d'une ligne « Dégustation » (sans millésime). */
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

/** Libellé d'une ligne de vente : le millésime, sinon la note (ligne dégustation). */
export function saleItemDescription(item: any): string {
  if (item.wine_vintage_id && item.wine_vintage) {
    return vintageProductLabel(item.wine_vintage);
  }
  const n = item.note != null ? String(item.note).trim() : "";
  return n || TASTING_LINE_NOTE;
}

/** Lignes de vente : remises et note (ligne dégustation) en plus des lignes d'articles. */
export const SALE_LINE_ITEMS_SELECT = `${LINE_ITEMS_SELECT}, discount, discount_type, note` as const;

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

/** TVA d'une ligne « Dégustation » (sans lot) : prestation au taux normal. */
const SERVICE_VAT_RATE = 0.21;

/** Taux de TVA d'une ligne de vente : celui du type de produit de son lot. */
export function itemVatRate(item: any): number {
  return item.wine_vintage_id && item.wine_vintage ? kindInfo(item.wine_vintage.wine).vatRate : SERVICE_VAT_RATE;
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
