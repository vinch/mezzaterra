import { supabase } from "$lib/supabase";
import { lineTotal } from "$lib/analytics";
import { formatDate, toNumber } from "$lib/format";
import {
  SALE_LINE_ITEMS_SELECT,
  ensureInvoiceNumber,
  globalDiscountAmount,
  itemsSubtotal,
  paymentMethodLabel,
  saleItemDescription,
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
  /* Mezzaterra est en franchise de TVA : aucune TVA sur la facture, particulier comme professionnel. */
  const rows = items.map((item) => ({
    description: saleItemDescription(item),
    values: [String(item.quantity), pdfEur(toNumber(item.price)), pdfEur(lineTotal(item))],
  }));

  const total = toNumber(sale.total_price);
  const summary: string[] = [];
  const gDisc = toNumber(sale.global_discount);
  const gType = String(sale.global_discount_type ?? "").trim().toLowerCase();
  if (gDisc > 0 && (gType === "amount" || gType === "percent")) {
    const ristEuro = globalDiscountAmount(items, total);
    summary.push(
      `Sous-total: ${pdfEur(itemsSubtotal(items))}`,
      gType === "percent"
        ? `Ristourne globale (${Math.min(100, gDisc)} %) : –${pdfEur(ristEuro)}`
        : `Ristourne globale : –${pdfEur(ristEuro)}`,
    );
  }

  const totals = [`TOTAL: ${pdfEur(total)}`];

  /* Mention légale du régime de franchise (Code TVA belge, art. 56bis). */
  const blocks: LineItemsPdf["blocks"] = [
    { gap: 10, lines: [{ text: "Régime particulier de franchise des petites entreprises" }] },
  ];
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
    columns: ["Qté", "PU", "Total"],
    columnWidth: 18,
    rows,
    summary,
    totals,
    blocks,
    fileName: `Facture_${pdfFileSlug(invoiceNumber)}.pdf`,
  });
}
