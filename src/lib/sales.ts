import { fetchAllRows, supabase } from "./supabase";
import { vintageProductLabel } from "./wine";

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

/** Attribue et enregistre le prochain numéro « INV-AAAA-NNN » de l'année de la vente. */
export async function generateAndSaveInvoiceNumber(
  saleId: string,
  saleDate: string,
): Promise<string | null> {
  // Year of the sale date (read from the string: a date-only value has no timezone)
  const year = Number(saleDate.slice(0, 4));
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  // All sales of the year, by date then creation (paginated past PostgREST's 1000 rows):
  // their order gives the position, those already invoiced give the max number
  let allSalesInYear: { id: string; date: string; created_at: string; invoice_number: string | null }[];
  try {
    allSalesInYear = await fetchAllRows((from, to) =>
      supabase
        .from("sale")
        .select("id, date, created_at, invoice_number")
        .gte("date", yearStart)
        .lte("date", yearEnd)
        .order("date", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    );
  } catch (err) {
    console.error(
      "Erreur lors de la génération du numéro de facture:",
      err,
    );
    return null;
  }

  // Find the position of this sale in the ordered list
  const saleIndex = allSalesInYear.findIndex((s) => s.id === saleId);

  // Find the highest invoice number for this year
  let maxInvoiceNumber = 0;
  for (const sale of allSalesInYear) {
    const match = sale.invoice_number?.match(/INV-\d+-(\d+)/);
    if (match) maxInvoiceNumber = Math.max(maxInvoiceNumber, parseInt(match[1], 10));
  }

  // Generate the next invoice number
  // Use the position in the year or max + 1, whichever is higher
  const sequenceNumber = Math.max(saleIndex + 1, maxInvoiceNumber + 1);

  const invoiceNumber = `INV-${year}-${String(sequenceNumber).padStart(3, "0")}`;

  // Save the invoice number to the database
  const { error: updateError } = await supabase
    .from("sale")
    .update({ invoice_number: invoiceNumber })
    .eq("id", saleId);

  if (updateError) {
    console.error(
      "Erreur lors de l'enregistrement du numéro de facture:",
      updateError,
    );
    return null;
  }

  return invoiceNumber;
}
