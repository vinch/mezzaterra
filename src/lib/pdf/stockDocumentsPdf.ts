import jsPDF from "jspdf";
import { attachRobotoPdf, staticPng, svgToPng, type PdfImage } from "./assets";
import { parseIsoDate } from "$lib/dates";
import { wineRobe, productTypeLabel, withVolume } from "$lib/products";
import { kindInfo, PRODUCT_KIND_LIST, PRODUCT_KINDS, type ProductKind } from "$lib/productKinds";
import {
  sortedStockForDocuments,
  stockLotLabel,
  type StockDocLot,
} from "$lib/stockDocuments";

const YELLOW: [number, number, number] = [255, 235, 120];


type PriceGroup = "blancs" | "roses" | "rouges" | Exclude<ProductKind, "wine">;

/** Groupe du tarif : les vins selon la couleur de la robe (orange et autres avec les blancs), les autres produits par type. */
function priceGroupKey(v: StockDocLot): PriceGroup {
  if (v.kind !== "wine") return v.kind;
  const key = wineRobe({ name: v.productTypeName }).key;
  return key === "red" ? "rouges" : key === "rose" ? "roses" : "blancs";
}

const OTHER_KINDS = PRODUCT_KIND_LIST.map((k) => k.key).filter((k): k is Exclude<ProductKind, "wine"> => k !== "wine");

const GROUP_ORDER: PriceGroup[] = ["blancs", "roses", "rouges", ...OTHER_KINDS];

const GROUP_LABEL: Record<PriceGroup, string> = {
  blancs: "Blancs",
  roses: "Rosés",
  rouges: "Rouges",
  ...(Object.fromEntries(OTHER_KINDS.map((k) => [k, PRODUCT_KINDS[k].plural])) as Record<Exclude<ProductKind, "wine">, string>),
};

function formatEur(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(2).replace(".", ",")} €`;
}

function newPageIfNeeded(
  doc: jsPDF,
  y: number,
  needed: number,
  margin: number,
): number {
  const h = doc.internal.pageSize.getHeight();
  if (y + needed > h - margin) {
    doc.addPage();
    return margin;
  }
  return y;
}

function fitLine(
  doc: jsPDF,
  text: string,
  maxWidthMm: number,
  fontSize: number,
): string[] {
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(text, maxWidthMm);
  return Array.isArray(lines) ? lines : [lines];
}

function drawFillInLine(
  doc: jsPDF,
  xLeft: number,
  xRight: number,
  y: number,
): void {
  const xEnd = xRight > xLeft ? xRight : xLeft + 20;
  doc.setDrawColor(215, 215, 215);
  doc.setLineWidth(0.2);
  if (typeof doc.setLineDashPattern === "function") {
    doc.setLineDashPattern([1.2, 1.2], 0);
  }
  doc.line(xLeft, y, xEnd, y);
  if (typeof doc.setLineDashPattern === "function") {
    doc.setLineDashPattern([], 0);
  }
  doc.setDrawColor(0, 0, 0);
}

type HeaderImages = [logo: PdfImage | null, qr: PdfImage | null];

/** Logo et QR des en-têtes, rasterisés une fois par session (nouvel essai si l'un a échoué). */
let headerImages: Promise<HeaderImages> | null = null;

function loadHeaderImages(): Promise<HeaderImages> {
  headerImages ??= Promise.all([svgToPng("/logo-black.svg", 3000), staticPng("/qr.png")]).then((images) => {
    if (!images[0] || !images[1]) headerImages = null;
    return images;
  });
  return headerImages;
}

/** En-tête commun : logo à gauche, QR à droite (moitié de la hauteur du logo, centré sur lui). Logo absent : largeur 0. */
function drawLogoAndQr(doc: jsPDF, [logo, qr]: HeaderImages, pageW: number, margin: number, top: number) {
  const logoWmm = logo ? 48 : 0;
  let logoHmm = 0;
  let qrHmm = 0;
  let qrWmm = 0;
  let qrX = pageW - margin;

  if (logo) {
    logoHmm = logoWmm * logo.aspect;
    doc.addImage(logo.dataUrl, "PNG", margin, top, logoWmm, logoHmm);
  }
  if (qr) {
    qrHmm = logoHmm > 0 ? logoHmm / 2 : 12;
    qrWmm = qrHmm / qr.aspect;
    qrX = pageW - margin - qrWmm;
    const qrY = logoHmm > 0 ? top + (logoHmm - qrHmm) / 2 : top;
    doc.addImage(qr.dataUrl, "PNG", qrX, qrY, qrWmm, qrHmm);
  }
  return { logoWmm, logoHmm, qrHmm, qrWmm, qrX };
}

/** Liste de prix : logo, champs client au centre, QR à droite. */
function drawPdfPricesHeader(
  doc: jsPDF,
  images: HeaderImages,
  pageW: number,
  margin: number,
  startY: number,
  fontFamily: string,
): number {
  const { logoWmm, logoHmm, qrHmm, qrWmm, qrX } = drawLogoAndQr(doc, images, pageW, margin, startY);

  const midLeft = margin + logoWmm + 5;
  const midRight = qrWmm > 0 ? qrX - 4 : pageW - margin;

  const customerFields: { label: string; optional?: boolean }[] = [
    { label: "Nom complet" },
    { label: "Email" },
    { label: "N° TVA", optional: true },
  ];
  const fieldStepMm = 6.5;
  const fieldsBlockHmm = customerFields.length * fieldStepMm;
  const bandHmm = Math.max(logoHmm, qrHmm, fieldsBlockHmm);
  const fieldsStartY =
    startY + (bandHmm - fieldsBlockHmm) / 2 + 2.8;

  doc.setFont(fontFamily, "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(70, 70, 70);
  let fieldY = fieldsStartY;
  for (const f of customerFields) {
    const lbl = f.optional ? `${f.label} (facultatif)` : f.label;
    doc.text(`${lbl} :`, midLeft, fieldY);
    drawFillInLine(doc, midLeft, midRight, fieldY + 1.5);
    fieldY += fieldStepMm;
  }
  doc.setTextColor(0, 0, 0);

  return startY + bandHmm + 6;
}

/** Notes de dégustation : logo, date à droite du logo (centrée), QR à droite. */
function drawPdfNotesHeader(
  doc: jsPDF,
  images: HeaderImages,
  pageW: number,
  margin: number,
  startY: number,
  fontFamily: string,
  tastingDate: Date,
): number {
  const { logoWmm, logoHmm, qrHmm } = drawLogoAndQr(doc, images, pageW, margin, startY);

  const bandHmm = Math.max(logoHmm, qrHmm, 10);
  const dateStr = tastingDate.toLocaleDateString("fr-CH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const dateX = margin + logoWmm + 5;
  const dateFontSize = 10;
  doc.setFont(fontFamily, "normal");
  doc.setFontSize(dateFontSize);
  doc.setTextColor(80, 80, 80);
  const dateDims = doc.getTextDimensions(dateStr);
  const dateY = startY + (bandHmm + dateDims.h) / 2;
  doc.text(dateStr, dateX, dateY);
  doc.setTextColor(0, 0, 0);

  if (bandHmm > 0) {
    return startY + bandHmm + 6;
  }
  return startY + 4;
}

/** Espace pour notes manuscrites entre deux vins (entre 17 mm serré et 22 mm d’origine). */
const NOTES_WRITING_GAP_MM = 19;
const NOTES_BLOCK_EXTRA_MM = 22;

export async function downloadPricesPdf(
  rows: StockDocLot[],
  highlightedIds: Set<string>,
  filename = "mezzaterra-liste-de-prix.pdf",
): Promise<void> {
  const sorted = sortedStockForDocuments(rows);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = margin;

  const [fontFamily, images] = await Promise.all([attachRobotoPdf(doc), loadHeaderImages()]);
  doc.setFont(fontFamily, "normal");

  y = drawPdfPricesHeader(doc, images, pageW, margin, y, fontFamily);

  const colProducer = margin;
  const colProduct = margin + 38;
  const colUnitPrice = pageW - margin - 54;
  const colQtyLeft = pageW - margin - 50;
  const colQtyRight = pageW - margin - 34;
  const colTotalLeft = pageW - margin - 30;
  const colTotalRight = pageW - margin;
  const productColWidth = colUnitPrice - colProduct - 10;
  const rowPad = 1.2;
  const baseLineH = 4.2;

  const drawColumnHeaders = (headerY: number) => {
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(90, 90, 90);
    doc.text("Domaine", colProducer, headerY);
    doc.text("Nom", colProduct, headerY);
    doc.text("Prix unit.", colUnitPrice, headerY, { align: "right" });
    doc.text("Quantité", (colQtyLeft + colQtyRight) / 2, headerY, {
      align: "center",
    });
    doc.text("Prix total", colTotalRight, headerY, { align: "right" });
    doc.setTextColor(0, 0, 0);
  };

  for (const group of GROUP_ORDER) {
    const inGroup = sorted.filter((r) => priceGroupKey(r) === group);
    if (inGroup.length === 0) continue;

    y = newPageIfNeeded(doc, y, 18, margin);
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(11);
    doc.text(GROUP_LABEL[group], margin, y);
    y += 6.5;

    drawColumnHeaders(y);
    y += 2.5;

    for (const v of inGroup) {
      const highlight = highlightedIds.has(v.id);
      const productLines = fitLine(doc, withVolume(v.productName, v, v.kind), productColWidth, 9);
      const producerLines = fitLine(doc, v.producerName, 36, 9);
      const rowLines = Math.max(productLines.length, producerLines.length, 1);
      const rowH = rowLines * baseLineH + rowPad * 2;

      y = newPageIfNeeded(doc, y, rowH + 1, margin);
      const rowTop = y;

      if (highlight) {
        doc.setFillColor(YELLOW[0], YELLOW[1], YELLOW[2]);
        doc.rect(margin - 1, rowTop, pageW - 2 * margin + 2, rowH, "F");
      }

      doc.setFont(fontFamily, "normal");
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);

      let lineY = rowTop + 4;
      for (let i = 0; i < rowLines; i++) {
        const wLine = producerLines[i] ?? "";
        const productLine = productLines[i] ?? "";
        if (wLine) doc.text(wLine, colProducer, lineY);
        if (productLine) doc.text(productLine, colProduct, lineY);
        if (i === 0) {
          doc.text(formatEur(v.price), colUnitPrice, lineY, { align: "right" });
          drawFillInLine(doc, colQtyLeft, colQtyRight, lineY + 1.5);
          drawFillInLine(doc, colTotalLeft, colTotalRight, lineY + 1.5);
        }
        lineY += baseLineH;
      }

      y = rowTop + rowH;
    }
    y += 12;
  }

  y = newPageIfNeeded(doc, y, 10, margin);
  y += 6;
  const grandTotalY = y;
  const grandTotalLineY = grandTotalY + 1.5;
  doc.setFont(fontFamily, "bold");
  doc.setFontSize(10);
  const grandTotalLabel = "Grand total";
  const labelGapMm = 4;
  doc.text(grandTotalLabel, colTotalLeft - labelGapMm, grandTotalY, {
    align: "right",
  });
  drawFillInLine(doc, colTotalLeft, colTotalRight, grandTotalLineY);

  doc.save(filename);
}

export type NotesPdfOptions = {
  /** Date de la dégustation (YYYY-MM-DD). */
  tastingDate?: string;
  filename?: string;
};

export async function downloadNotesPdf(
  /** Ordre des entrées = ordre de dégustation (non re-trié). */
  rows: StockDocLot[],
  options: NotesPdfOptions = {},
): Promise<void> {
  if (rows.length === 0) return;
  const filename =
    options.filename ?? "mezzaterra-notes-degustation.pdf";
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();
  const textW = pageW - 2 * margin;
  let y = margin;

  const [fontFamily, images] = await Promise.all([attachRobotoPdf(doc), loadHeaderImages()]);
  doc.setFont(fontFamily, "normal");

  /* Date absente ou incomplète : celle du jour, comme avant. */
  const tastingDate = /^\d{4}-\d{2}-\d{2}/.test(options.tastingDate ?? "")
    ? parseIsoDate(options.tastingDate!)
    : new Date();
  y = drawPdfNotesHeader(
    doc,
    images,
    pageW,
    margin,
    y,
    fontFamily,
    tastingDate,
  );

  let idx = 1;
  for (const v of rows) {
    /* « 1. », pas « ① » : Helvetica (police de repli) ne l’a pas. */
    const title = `${idx}. ${v.producerName} ${v.productName}`;
    const varieties = v.varietyNames.length ? v.varietyNames.join(", ") : "—";
    const kind = kindInfo(v.kind);
    const abvStr = kind.hasAbv ? ` / ${v.abv != null ? `${v.abv}%` : "—"}` : "";
    const detail = `${productTypeLabel({ name: v.productTypeName, kind: v.kind })} / ${stockLotLabel(v)}${abvStr} / ${kind.varieties} : ${varieties} / ${v.appellationLine || "—"}`;

    const titleLines = fitLine(doc, title, textW - 2, 10.5);
    const detailLines = fitLine(doc, detail, textW, 9);

    const blockH =
      titleLines.length * 5 +
      detailLines.length * 4.8 +
      NOTES_BLOCK_EXTRA_MM;

    y = newPageIfNeeded(doc, y, blockH, margin);

    doc.setFont(fontFamily, "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(0, 0, 0);
    let ty = y;
    for (const line of titleLines) {
      doc.text(line, margin + 2, ty);
      ty += 5;
    }

    doc.setFont(fontFamily, "normal");
    doc.setFontSize(9);
    for (const line of detailLines) {
      doc.text(line, margin, ty);
      ty += 4.8;
    }

    ty += NOTES_WRITING_GAP_MM;
    y = ty;
    idx += 1;
  }

  doc.save(filename);
}
