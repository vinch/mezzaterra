import jsPDF from "jspdf";

/**
 * Document A4 « à lignes » commun à la facture et au bon de commande :
 * titre et références à droite, Mezzaterra à gauche et le destinataire à droite,
 * tableau d'articles (description + colonnes chiffrées centrées), totaux, puis mentions.
 */

/** Lignes d'articles (vente ou commande) : de quoi les libeller et les chiffrer. */
export const LINE_ITEMS_SELECT =
  "price, quantity, wine_vintage_id, wine_vintage ( year, production_year, purchase_price, wine ( name, winery ( name ), appelation ( name ) ) )";

/** Lignes de vente : remises et note (ligne dégustation) en plus. */
export const SALE_LINE_ITEMS_SELECT = `${LINE_ITEMS_SELECT}, discount, discount_type, note` as const;

export type PdfLine = { text: string; bold?: boolean; italic?: boolean };

export type LineItemsPdf = {
  /** « FACTURE », « COMMANDE », « DEVIS »… */
  title: string;
  /** Lignes sous le titre (numéro, date, statut). */
  meta: string[];
  /** Destinataire : nom (peut contenir un retour à la ligne) et coordonnées. */
  party: { name: string; details: string[] };
  /** En-tête de la colonne description, puis des colonnes chiffrées de gauche à droite. */
  descriptionLabel: string;
  columns: string[];
  rows: { description: string; values: string[] }[];
  /** Lignes alignées à droite avant le trait final (sous-total, ristourne). */
  summary?: string[];
  /** Totaux après le trait, en 12 pt gras (`minor` : 10 pt normal). */
  totals: { text: string; minor?: boolean }[];
  /** Blocs de mentions à gauche (mode de paiement, transport, note), chacun après un écart en mm. */
  blocks?: { gap: number; lines: PdfLine[] }[];
  fileName: string;
};

/** « €12.50 » : Helvetica (WinAnsi) n'a pas l'espace insécable fine de Intl. */
export function pdfEur(n: number): string {
  return `€${n.toFixed(2)}`;
}

export function downloadLineItemsPdf(d: LineItemsPdf): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const right = pageWidth - margin;
  let yPos = margin;

  const font = (size: number, style: "normal" | "bold" | "italic" = "normal") => {
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
  };
  /** Nouvelle page si `height` mm ne tiennent plus au-dessus de la marge du bas. */
  const ensureSpace = (height: number) => {
    if (yPos + height > pageHeight - margin) {
      doc.addPage();
      yPos = margin + 20;
    }
  };

  // Titre et références
  font(20, "bold");
  doc.text(d.title, right, yPos, { align: "right" });
  yPos += 12;
  font(10);
  d.meta.forEach((line, i) => {
    doc.text(line, right, yPos, { align: "right" });
    yPos += i === d.meta.length - 1 ? 15 : 6;
  });

  // Mezzaterra à gauche, destinataire à droite, à la même hauteur
  font(12, "bold");
  doc.text("Mezzaterra", margin, yPos);
  let partyY = yPos;
  yPos += 6;
  const nameLines = doc.splitTextToSize(d.party.name, 80);
  doc.text(nameLines, right, partyY, { align: "right" });
  partyY += nameLines.length * 5.5 + 3;
  font(10);
  for (const line of d.party.details) {
    doc.text(line, right, partyY, { align: "right" });
    partyY += 5;
  }
  yPos = Math.max(yPos, partyY) + 15;

  // Colonnes chiffrées placées de droite à gauche, texte centré ; plus étroites quand il y en a beaucoup
  const columnWidth = d.columns.length > 3 ? 18 : 22;
  const colSpacing = 2;
  const centers = d.columns.map((_, i) => right - columnWidth / 2 - (d.columns.length - 1 - i) * (columnWidth + colSpacing));
  const descColStart = margin + 2;
  const descColWidth = centers[0] - descColStart - columnWidth / 2 - 15;

  font(9, "bold");
  doc.line(margin, yPos, right, yPos);
  yPos += 6;
  doc.text(d.descriptionLabel, descColStart, yPos);
  d.columns.forEach((label, i) => doc.text(label, centers[i], yPos, { align: "center" }));
  yPos += 3;
  doc.line(margin, yPos, right, yPos);
  yPos += 6;

  font(9);
  for (const row of d.rows) {
    const descriptionLines = doc.splitTextToSize(row.description, descColWidth);
    const rowHeight = Math.max(descriptionLines.length * 4.2, 6) + 2;
    ensureSpace(rowHeight);
    doc.text(descriptionLines, descColStart, yPos);
    row.values.forEach((value, i) => doc.text(value, centers[i], yPos, { align: "center" }));
    yPos += rowHeight;
  }

  if (d.summary?.length) {
    ensureSpace(d.summary.length * 5 + 3);
    font(10);
    d.summary.forEach((line, i) => {
      doc.text(line, right, yPos, { align: "right" });
      yPos += i === d.summary!.length - 1 ? 8 : 5;
    });
  }

  ensureSpace(15 + d.totals.length * 7);
  yPos += 5;
  doc.line(margin, yPos, right, yPos);
  yPos += 10;

  d.totals.forEach((t, i) => {
    font(t.minor ? 10 : 12, t.minor ? "normal" : "bold");
    doc.text(t.text, right, yPos, { align: "right" });
    if (i < d.totals.length - 1) yPos += 7;
  });

  for (const block of d.blocks ?? []) {
    yPos += block.gap;
    ensureSpace(block.lines.length * 5);
    block.lines.forEach((line, i) => {
      if (i > 0) yPos += 5;
      font(10, line.italic ? "italic" : line.bold ? "bold" : "normal");
      doc.text(doc.splitTextToSize(line.text, pageWidth - 2 * margin), margin, yPos);
    });
  }

  doc.save(d.fileName);
}
