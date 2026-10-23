import { supabase } from "$lib/supabase";
import { lineTotal } from "$lib/analytics";
import { formatDate, toNumber } from "$lib/format";
import { generateAndSaveInvoiceNumber, paymentMethodLabel, saleItemDescription } from "$lib/sales";
import { downloadLineItemsPdf, pdfEur, type LineItemsPdf } from "./lineItemsPdf";

/** TVA belge sur le vin : les prix en base sont TTC, la facture d'un professionnel détaille le HTVA. */
const VAT_RATE = 0.21;

/** Facture PDF d'une vente ; attribue son numéro si elle n'en a pas encore. Lève une erreur lisible. */
export async function downloadInvoicePdf(saleId: string): Promise<void> {
  const [{ data: sale, error: saleError }, { data: items, error: itemsError }] = await Promise.all([
    supabase
      .from("sale")
      .select(
        "*, customer ( first_name, last_name, company_name, email, address_line_1, address_line_2, city, zip_code, country_id, vat )",
      )
      .eq("id", saleId)
      .single(),
    supabase
      .from("sale_item")
      .select("*, wine_vintage ( *, wine ( *, winery (*), appelation (*) ) )")
      .eq("sale_id", saleId),
  ]);

  if (saleError || !sale) throw new Error(`Erreur lors du chargement de la vente: ${saleError?.message}`);
  if (itemsError || !items) throw new Error(`Erreur lors du chargement des articles: ${itemsError?.message}`);

  const invoiceNumber = sale.invoice_number || (await generateAndSaveInvoiceNumber(sale.id, sale.date));
  if (!invoiceNumber) throw new Error("Impossible de générer le numéro de facture");

  const c = sale.customer!;
  const isCompany = !!(c.company_name || c.vat);
  const ht = (ttc: number) => (isCompany ? ttc / (1 + VAT_RATE) : ttc);

  let subtotalTTC = 0;
  const rows = items.map((item) => {
    const priceTTC = toNumber(item.price);
    const totalTTC = lineTotal(item as any);
    subtotalTTC += totalTTC;
    const values = isCompany
      ? [String(item.quantity), pdfEur(ht(priceTTC)), pdfEur(priceTTC), pdfEur(ht(totalTTC)), pdfEur(totalTTC)]
      : [String(item.quantity), pdfEur(priceTTC), pdfEur(totalTTC)];
    return { description: saleItemDescription(item), values };
  });

  const summary: string[] = [];
  const gDisc = toNumber(sale.global_discount);
  const gType = String(sale.global_discount_type ?? "").trim().toLowerCase();
  if (gDisc > 0 && (gType === "amount" || gType === "percent")) {
    const ristEuro = Math.max(0, Math.round((subtotalTTC - toNumber(sale.total_price)) * 100) / 100);
    summary.push(
      `Sous-total TTC: ${pdfEur(subtotalTTC)}`,
      gType === "percent"
        ? `Ristourne globale (${gDisc} %) : –${pdfEur(ristEuro)}`
        : `Ristourne globale : –${pdfEur(gDisc)}`,
    );
  }

  const total = toNumber(sale.total_price);
  const totals: LineItemsPdf["totals"] = isCompany
    ? [
        { text: `Total HTVA: ${pdfEur(total / (1 + VAT_RATE))}` },
        { text: `TVA (21%): ${pdfEur(total - total / (1 + VAT_RATE))}`, size: 10, bold: false },
        { text: `Total TTC: ${pdfEur(total)}` },
      ]
    : [{ text: `TOTAL: ${pdfEur(total)}` }];

  const blocks: LineItemsPdf["blocks"] = [];
  if (sale.payment_method) {
    blocks.push({ gap: 10, lines: [{ text: `Mode de paiement : ${paymentMethodLabel(sale.payment_method)}` }] });
  }
  if (sale.note) blocks.push({ gap: 15, wrap: true, lines: [{ text: `Note: ${sale.note}`, italic: true }] });

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
    columns: isCompany ? ["Qté", "PU HTVA", "PU TTC", "Total HTVA", "Total TTC"] : ["Qté", "PU", "Total"],
    columnWidth: 18,
    rows,
    summary,
    totals,
    blocks,
    fileName: `Facture_${invoiceNumber.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
  });
}
