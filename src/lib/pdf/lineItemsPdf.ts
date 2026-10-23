import jsPDF from "jspdf";

/**
 * Document A4 « à lignes » commun à la facture et au bon de commande :
 * titre et références à droite, Mezzaterra à gauche et le destinataire à droite,
 * tableau d'articles (description + colonnes chiffrées centrées), totaux, puis mentions.
 */

export type PdfLine = { text: string; bold?: boolean; italic?: boolean };

export type LineItemsPdf = {
  /** « FACTURE », « COMMANDE », « DEVIS »… */
  title: string;
  /** Lignes sous le titre (numéro, date, statut). */
  meta: string[];
  /** Destinataire : nom (peut contenir un retour à la ligne) et coordonnées. */
  party: { name: string; details: string[] };
  /** En-têtes des colonnes chiffrées, de gauche à droite. */
  columns: string[];
  columnWidth: number;
  rows: { description: string; values: string[] }[];
  /** Lignes alignées à droite avant le trait final (sous-total, ristourne). */
  summary?: string[];
  /** Totaux après le trait (12 pt gras par défaut). */
  totals: { text: string; size?: number; bold?: boolean }[];
  /** Blocs de mentions à gauche (mode de paiement, transport, note), chacun après un écart. */
  blocks?: { gap: number; lines: PdfLine[]; wrap?: boolean }[];
  fileName: string;
};

/** « €12.50 » : Helvetica (WinAnsi) n'a pas l'espace insécable fine de Intl. */
export function pdfEur(n: number): string {
  return `€${n.toFixed(2)}`;
}

export function downloadLineItemsPdf(d: LineItemsPdf): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const right = pageWidth - margin;
  let yPos = margin;

  const font = (size: number, style: "normal" | "bold" | "italic" = "normal") => {
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
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

  // Colonnes chiffrées placées de droite à gauche, texte centré
  const colSpacing = 2;
  const centers: number[] = [];
  let x = right - d.columnWidth / 2;
  for (let i = d.columns.length - 1; i >= 0; i--) {
    centers[i] = x;
    x -= d.columnWidth + colSpacing;
  }
  const descColStart = margin + 2;
  const descColWidth = centers[0] - descColStart - d.columnWidth / 2 - 15;

  font(9, "bold");
  doc.line(margin, yPos, right, yPos);
  yPos += 6;
  doc.text("Description", descColStart, yPos);
  d.columns.forEach((label, i) => doc.text(label, centers[i], yPos, { align: "center" }));
  yPos += 3;
  doc.line(margin, yPos, right, yPos);
  yPos += 6;

  font(9);
  for (const row of d.rows) {
    if (yPos > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      yPos = margin + 20;
    }
    const descriptionLines = doc.splitTextToSize(row.description, descColWidth);
    doc.text(descriptionLines, descColStart, yPos);
    row.values.forEach((value, i) => doc.text(value, centers[i], yPos, { align: "center" }));
    yPos += Math.max(descriptionLines.length * 4.2, 6) + 2;
  }

  if (d.summary?.length) {
    font(10);
    d.summary.forEach((line, i) => {
      doc.text(line, right, yPos, { align: "right" });
      yPos += i === d.summary!.length - 1 ? 8 : 5;
    });
  }

  yPos += 5;
  doc.line(margin, yPos, right, yPos);
  yPos += 10;

  d.totals.forEach((t, i) => {
    font(t.size ?? 12, t.bold === false ? "normal" : "bold");
    doc.text(t.text, right, yPos, { align: "right" });
    if (i < d.totals.length - 1) yPos += 7;
  });

  for (const block of d.blocks ?? []) {
    yPos += block.gap;
    block.lines.forEach((line, i) => {
      if (i > 0) yPos += 5;
      font(10, line.italic ? "italic" : line.bold ? "bold" : "normal");
      doc.text(block.wrap ? doc.splitTextToSize(line.text, pageWidth - 2 * margin) : line.text, margin, yPos);
    });
  }

  doc.save(d.fileName);
}
