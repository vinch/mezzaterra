import { supabase } from "$lib/supabase";
import { parseIsoDate } from "$lib/dates";
import { vintageProductLabel } from "$lib/wine";
import { LINE_ITEMS_SELECT } from "$lib/manageData";
import { downloadLineItemsPdf, pdfEur, type LineItemsPdf } from "./lineItemsPdf";

/** Libellés du document selon la langue du fournisseur. */
const translations = {
  fr: {
    documentTitleConfirmed: "COMMANDE",
    documentTitlePending: "DEVIS",
    date: "Date",
    status: "Statut",
    statusConfirmed: "Confirmée",
    statusPending: "En attente",
    description: "Description",
    quantity: "Qté",
    unitPrice: "Prix unitaire",
    total: "Total",
    totalLabel: "TOTAL",
    transport: "Transport",
    transporter: "Transporteur",
    departureDate: "Date de départ",
    arrivalDate: "Date d'arrivée",
    note: "Note",
  },
  en: {
    documentTitleConfirmed: "ORDER",
    documentTitlePending: "QUOTE",
    date: "Date",
    status: "Status",
    statusConfirmed: "Confirmed",
    statusPending: "Pending",
    description: "Description",
    quantity: "Qty",
    unitPrice: "Unit Price",
    total: "Total",
    totalLabel: "TOTAL",
    transport: "Transport",
    transporter: "Transporter",
    departureDate: "Departure Date",
    arrivalDate: "Arrival Date",
    note: "Note",
  },
  it: {
    documentTitleConfirmed: "ORDINE",
    documentTitlePending: "PREVENTIVO",
    date: "Data",
    status: "Stato",
    statusConfirmed: "Confermato",
    statusPending: "In attesa",
    description: "Descrizione",
    quantity: "Qtà",
    unitPrice: "Prezzo unitario",
    total: "Totale",
    totalLabel: "TOTALE",
    transport: "Trasporto",
    transporter: "Trasportatore",
    departureDate: "Data di partenza",
    arrivalDate: "Data di arrivo",
    note: "Nota",
  },
};

export type OrderPdfLanguage = keyof typeof translations;

const LOCALES: Record<OrderPdfLanguage, string> = { fr: "fr-FR", en: "en-US", it: "it-IT" };

/** Bon de commande (ou devis tant qu'elle n'est pas confirmée) d'une commande fournisseur. Lève une erreur lisible. */
export async function downloadOrderPdf(orderId: string, lang: OrderPdfLanguage): Promise<void> {
  const [{ data: order, error: orderError }, { data: items, error: itemsError }] = await Promise.all([
    supabase
      .from("order")
      .select("date, status, note, total_price, supplier ( name ), transport ( departure_date, arrival_date, transporter ( name ) )")
      .eq("id", orderId)
      .single(),
    supabase.from("order_item").select(LINE_ITEMS_SELECT).eq("order_id", orderId),
  ]);

  if (orderError || !order) throw new Error(`Erreur lors du chargement de la commande: ${orderError?.message}`);
  if (itemsError || !items) throw new Error(`Erreur lors du chargement des articles: ${itemsError?.message}`);

  const t = translations[lang];
  const date = (iso: string) => parseIsoDate(iso).toLocaleDateString(LOCALES[lang]);
  const title = order.status === "confirmed" ? t.documentTitleConfirmed : t.documentTitlePending;

  const blocks: LineItemsPdf["blocks"] = [];
  if (order.transport) {
    const tr = order.transport;
    blocks.push({
      gap: 15,
      lines: [
        { text: `${t.transport}:`, bold: true },
        { text: `${t.transporter}: ${tr.transporter.name}` },
        ...(tr.departure_date ? [{ text: `${t.departureDate}: ${date(tr.departure_date)}` }] : []),
        ...(tr.arrival_date ? [{ text: `${t.arrivalDate}: ${date(tr.arrival_date)}` }] : []),
      ],
    });
  }
  if (order.note) blocks.push({ gap: 15, lines: [{ text: `${t.note}: ${order.note}`, italic: true }] });

  downloadLineItemsPdf({
    title,
    meta: [
      `${t.date}: ${date(order.date)}`,
      `${t.status}: ${order.status === "confirmed" ? t.statusConfirmed : t.statusPending}`,
    ],
    party: { name: order.supplier.name, details: [] },
    descriptionLabel: t.description,
    columns: [t.quantity, t.unitPrice, t.total],
    rows: items.map((item) => ({
      description: vintageProductLabel(item.wine_vintage!),
      values: [String(item.quantity), pdfEur(item.price), pdfEur(item.price * item.quantity)],
    })),
    totals: [{ text: `${t.totalLabel}: ${pdfEur(order.total_price)}` }],
    blocks,
    fileName: `${title}_${order.supplier.name.replace(/[^a-zA-Z0-9]/g, "_")}_${order.date.slice(0, 10)}.pdf`,
  });
}
