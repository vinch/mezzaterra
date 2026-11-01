import { supabase } from "$lib/supabase";
import { lineTotal } from "$lib/analytics";
import { formatDate, toNumber } from "$lib/format";
import {
  SALE_LINE_ITEMS_SELECT,
  ensureInvoiceNumber,
  globalDiscountAmount,
  itemVatRate,
  itemsSubtotal,
  paymentMethodLabel,
  saleItemDescription,
  vatBreakdown,
} from "$lib/sales";
import { pdfFileSlug } from "./assets";
import { downloadLineItemsPdf, pdfEur, type LineItemsPdf } from "./lineItemsPdf";

/** Facture PDF d'une vente ; attribue son numéro si elle n'en a pas encore. Lève une erreur lisible. */
export async function downloadInvoicePdf(saleId: string): Promise<void> {
  const [{ data: sale, error: saleError }, { data: items, error: itemsError }] = await Promise.all([
    supabase
      .from("sale")
      .select(
        "*, customer ( first_name, last_name, company_name, email, address_line_1, address_line_2, city, zip_code, vat )",
      )
      .eq("id", saleId)
      .single(),
    supabase
      .from("sale_item")
      .select(SALE_LINE_ITEMS_SELECT)
      .eq("sale_id", saleId),
  ]);

  if (saleError || !sale) throw new Error(`Erreur lors du chargement de la vente: ${saleError?.message}`);
  if (itemsError || !items) throw new Error(`Erreur lors du chargement des articles: ${itemsError?.message}`);
  /* Seule une vente clôturée est facturée : un numéro attribué à une vente encore supprimable laisserait un trou. */
  if (sale.status !== "closed") throw new Error("La facture n'est disponible que pour une vente clôturée.");

  const invoiceNumber = await ensureInvoiceNumber(sale);

  const c = sale.customer!;
  /* Les prix sont TTC ; la facture d'un professionnel détaille le HTVA, au taux de chaque ligne (vin 21 %, huile 6 %). */
  const isCompany = !!(c.company_name || c.vat);
  const pct = (rate: number) => `${Math.round(rate * 100)} %`;

  const rows = items.map((item) => {
    const priceTTC = toNumber(item.price);
    const totalTTC = lineTotal(item);
    const rate = itemVatRate(item);
    const ht = (ttc: number) => ttc / (1 + rate);
    const values = isCompany
      ? [String(item.quantity), pct(rate), pdfEur(ht(priceTTC)), pdfEur(priceTTC), pdfEur(ht(totalTTC)), pdfEur(totalTTC)]
      : [String(item.quantity), pdfEur(priceTTC), pdfEur(totalTTC)];
    return { description: saleItemDescription(item), values };
  });

  const total = toNumber(sale.total_price);
  const summary: string[] = [];
  const gDisc = toNumber(sale.global_discount);
  const gType = String(sale.global_discount_type ?? "").trim().toLowerCase();
  if (gDisc > 0 && (gType === "amount" || gType === "percent")) {
    const subtotalTTC = itemsSubtotal(items);
    const ristEuro = globalDiscountAmount(items, total);
    summary.push(
      `Sous-total TTC: ${pdfEur(subtotalTTC)}`,
      gType === "percent"
        ? `Ristourne globale (${Math.min(100, gDisc)} %) : –${pdfEur(ristEuro)}`
        : `Ristourne globale : –${pdfEur(ristEuro)}`,
    );
  }

  const vat = vatBreakdown(items, total);
  const totals: LineItemsPdf["totals"] = isCompany
    ? [
        { text: `Total HTVA: ${pdfEur(vat.reduce((s, v) => s + v.ht, 0))}` },
        /* Bases par taux après la ristourne globale (répartie au prorata), d'où l'écart avec les lignes. */
        ...vat.map((v) => ({
          text: `TVA ${pct(v.rate)} (sur ${pdfEur(v.ht)} HTVA${summary.length ? " après ristourne" : ""}): ${pdfEur(v.vat)}`,
          minor: true,
        })),
        { text: `Total TTC: ${pdfEur(total)}` },
      ]
    : [{ text: `TOTAL: ${pdfEur(total)}` }];

  const blocks: LineItemsPdf["blocks"] = [];
  if (sale.payment_method) {
    blocks.push({ gap: 10, lines: [{ text: `Mode de paiement : ${paymentMethodLabel(sale.payment_method)}` }] });
  }
  if (sale.note) blocks.push({ gap: 15, lines: [{ text: `Note: ${sale.note}`, italic: true }] });

  downloadLineItemsPdf({
    title: "FACTURE",
    meta: [`N° ${invoiceNumber}`, `Date: ${formatDate(sale.date)}`],
    party: {
      name: `${c.first_name} ${c.last_name}${c.company_name ? `\n${c.company_name}` : ""}`,
      details: [
        c.address_line_1,
        c.address_line_2,
        `${c.zip_code || ""} ${c.city || ""}`.trim(),
        c.email,
        c.vat ? `TVA: ${c.vat}` : "",
      ].filter((l): l is string => !!l),
    },
    descriptionLabel: "Description",
    columns: isCompany ? ["Qté", "TVA", "PU HTVA", "PU TTC", "Total HTVA", "Total TTC"] : ["Qté", "PU", "Total"],
    columnWidth: isCompany ? 16 : 18,
    rows,
    summary,
    totals,
    blocks,
    fileName: `Facture_${pdfFileSlug(invoiceNumber)}.pdf`,
  });
}
