import { base } from "$app/paths";
import jsPDF from "jspdf";
import {
  sortedStockForDocuments,
  stockVintageLabel,
  wineTypeLabelFr,
  type StockDocVintage,
} from "./stockDocuments";

const YELLOW: [number, number, number] = [255, 235, 120];

/** Conversion binaire → base64 pour `addFileToVFS` (évite stack overflow sur gros TTF). */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x2000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function fetchRobotoBase64(): Promise<[string, string] | null> {
  try {
    const [regRes, boldRes] = await Promise.all([
      fetch(`${base}/fonts/Roboto-Regular.ttf`),
      fetch(`${base}/fonts/Roboto-Bold.ttf`),
    ]);
    if (!regRes.ok || !boldRes.ok) return null;
    const [regBuf, boldBuf] = await Promise.all([
      regRes.arrayBuffer(),
      boldRes.arrayBuffer(),
    ]);
    return [arrayBufferToBase64(regBuf), arrayBufferToBase64(boldBuf)];
  } catch {
    return null;
  }
}

/** Polices téléchargées et encodées une seule fois par session (nouvel essai après un échec). */
let robotoBase64: Promise<[string, string] | null> | null = null;

function loadRobotoBase64(): Promise<[string, string] | null> {
  robotoBase64 ??= fetchRobotoBase64().then((fonts) => {
    if (!fonts) robotoBase64 = null;
    return fonts;
  });
  return robotoBase64;
}

/** Roboto (Identity-H) : €, accents, etc. — Helvetica WinAnsi corrompt l’Unicode. */
export async function attachRobotoPdf(doc: jsPDF): Promise<boolean> {
  if (typeof fetch === "undefined") return false;
  const fonts = await loadRobotoBase64();
  if (!fonts) return false;
  const regName = "Roboto-Regular.ttf";
  const boldName = "Roboto-Bold.ttf";
  doc.addFileToVFS(regName, fonts[0]);
  doc.addFont(regName, "Roboto", "normal");
  doc.addFileToVFS(boldName, fonts[1]);
  doc.addFont(boldName, "Roboto", "bold");
  return true;
}

function priceGroupKey(v: StockDocVintage): "blancs" | "roses" | "rouges" {
  const n = `${v.wineTypeName} ${v.wineTypeCategory || ""}`.toLowerCase();
  if (n.includes("rosé") || n.includes("rose")) return "roses";
  if (
    n.includes("rouge") ||
    n.includes("red") ||
    n.includes("rosso") ||
    n.includes("tinto")
  ) {
    return "rouges";
  }
  return "blancs";
}

const GROUP_ORDER: ("blancs" | "roses" | "rouges")[] = [
  "blancs",
  "roses",
  "rouges",
];

const GROUP_LABEL: Record<"blancs" | "roses" | "rouges", string> = {
  blancs: "Blancs",
  roses: "Rosés",
  rouges: "Rouges",
};

function formatEur(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(2).replace(".", ",")} €`;
}

/** Numérotation lisible en PDF (① etc. → $ / lettres avec Helvetica). */
function noteEntryNumber(n: number): string {
  return `${n}.`;
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

/** jsPDF n’accepte pas le SVG : rasterisation côté navigateur, assez large pour rester net une fois réduit en mm. */
export async function svgToPng(
  url: string,
  widthPx = 1600,
): Promise<{ dataUrl: string; aspect: number } | null> {
  if (typeof fetch === "undefined" || typeof document === "undefined") {
    return null;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = new Blob([await res.text()], {
      type: "image/svg+xml;charset=utf-8",
    });
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("svg"));
        img.src = objectUrl;
      });
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      if (!iw || !ih) return null;
      const heightPx = Math.max(1, Math.round(widthPx * (ih / iw)));
      const canvas = document.createElement("canvas");
      canvas.width = widthPx;
      canvas.height = heightPx;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, widthPx, heightPx);
      return { dataUrl: canvas.toDataURL("image/png"), aspect: heightPx / widthPx };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

/** PNG statique (ex. QR) pour en-tête PDF. */
async function loadStaticPngDataUrl(
  relativePath: string,
): Promise<{ dataUrl: string; aspect: number } | null> {
  if (typeof fetch === "undefined") return null;
  try {
    const path = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
    const res = await fetch(`${base}${path}`);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error("read"));
      fr.readAsDataURL(blob);
    });
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("img"));
      img.src = dataUrl;
    });
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return null;
    return { dataUrl, aspect: ih / iw };
  } catch {
    return null;
  }
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

/** Liste de prix : logo, champs client au centre, QR à droite. */
async function drawPdfPricesHeader(
  doc: jsPDF,
  pageW: number,
  margin: number,
  startY: number,
  fontFamily: string,
): Promise<number> {
  const headerTopY = startY;
  const [logo, qr] = await Promise.all([
    svgToPng(`${base}/logo-black.svg`, 3000),
    loadStaticPngDataUrl("/qr.png"),
  ]);
  const logoWmm = 48;
  let logoHmm = 0;
  let qrHmm = 0;
  let qrWmm = 0;
  let qrX = pageW - margin;

  if (logo) {
    logoHmm = logoWmm * logo.aspect;
    doc.addImage(logo.dataUrl, "PNG", margin, headerTopY, logoWmm, logoHmm);
  }
  if (qr) {
    qrHmm = logoHmm > 0 ? logoHmm / 2 : 12;
    qrWmm = qrHmm / qr.aspect;
    qrX = pageW - margin - qrWmm;
    const qrY =
      logoHmm > 0 ? headerTopY + (logoHmm - qrHmm) / 2 : headerTopY;
    doc.addImage(qr.dataUrl, "PNG", qrX, qrY, qrWmm, qrHmm);
  }

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
    headerTopY + (bandHmm - fieldsBlockHmm) / 2 + 2.8;

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

  return headerTopY + bandHmm + 6;
}

/** Notes de dégustation : logo, date à droite du logo (centrée), QR à droite. */
async function drawPdfNotesHeader(
  doc: jsPDF,
  pageW: number,
  margin: number,
  startY: number,
  fontFamily: string,
  tastingDate: Date,
): Promise<number> {
  const headerTopY = startY;
  const [logo, qr] = await Promise.all([
    svgToPng(`${base}/logo-black.svg`, 3000),
    loadStaticPngDataUrl("/qr.png"),
  ]);
  const logoWmm = 48;
  let logoHmm = 0;
  let qrHmm = 0;
  let qrWmm = 0;
  let qrX = pageW - margin;

  if (logo) {
    logoHmm = logoWmm * logo.aspect;
    doc.addImage(logo.dataUrl, "PNG", margin, headerTopY, logoWmm, logoHmm);
  }
  if (qr) {
    qrHmm = logoHmm > 0 ? logoHmm / 2 : 12;
    qrWmm = qrHmm / qr.aspect;
    qrX = pageW - margin - qrWmm;
    const qrY =
      logoHmm > 0 ? headerTopY + (logoHmm - qrHmm) / 2 : headerTopY;
    doc.addImage(qr.dataUrl, "PNG", qrX, qrY, qrWmm, qrHmm);
  }

  const bandHmm = Math.max(logoHmm, qrHmm, 10);
  const dateStr = tastingDate.toLocaleDateString("fr-CH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const dateX = margin + (logoHmm > 0 ? logoWmm : 0) + 5;
  const dateFontSize = 10;
  doc.setFont(fontFamily, "normal");
  doc.setFontSize(dateFontSize);
  doc.setTextColor(80, 80, 80);
  const dateDims = doc.getTextDimensions(dateStr);
  const dateY = headerTopY + (bandHmm + dateDims.h) / 2;
  doc.text(dateStr, dateX, dateY);
  doc.setTextColor(0, 0, 0);

  if (bandHmm > 0) {
    return headerTopY + bandHmm + 6;
  }
  return startY + 4;
}

/** Espace pour notes manuscrites entre deux vins (entre 17 mm serré et 22 mm d’origine). */
const NOTES_WRITING_GAP_MM = 19;
const NOTES_BLOCK_EXTRA_MM = 22;

export async function downloadPricesPdf(
  rows: StockDocVintage[],
  highlightedIds: Set<string>,
  filename = "mezzaterra-liste-de-prix.pdf",
): Promise<void> {
  const sorted = sortedStockForDocuments(rows);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = margin;

  const useRoboto = await attachRobotoPdf(doc);
  const fontFamily = useRoboto ? "Roboto" : "helvetica";
  doc.setFont(fontFamily, "normal");

  y = await drawPdfPricesHeader(doc, pageW, margin, y, fontFamily);

  const colWinery = margin;
  const colWine = margin + 38;
  const colUnitPrice = pageW - margin - 54;
  const colQtyLeft = pageW - margin - 50;
  const colQtyRight = pageW - margin - 34;
  const colTotalLeft = pageW - margin - 30;
  const colTotalRight = pageW - margin;
  const wineColWidth = colUnitPrice - colWine - 10;
  const rowPad = 1.2;
  const baseLineH = 4.2;

  const drawColumnHeaders = (headerY: number) => {
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(90, 90, 90);
    doc.text("Vignoble", colWinery, headerY);
    doc.text("Nom", colWine, headerY);
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
      const wineLines = fitLine(doc, v.wineName, wineColWidth, 9);
      const wineryLines = fitLine(doc, v.wineryName, 36, 9);
      const rowLines = Math.max(wineLines.length, wineryLines.length, 1);
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
        const wLine = wineryLines[i] ?? "";
        const wineLine = wineLines[i] ?? "";
        if (wLine) doc.text(wLine, colWinery, lineY);
        if (wineLine) doc.text(wineLine, colWine, lineY);
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

function parseTastingDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

export type NotesPdfOptions = {
  /** Date de la dégustation (YYYY-MM-DD). */
  tastingDate?: string;
  filename?: string;
};

export async function downloadNotesPdf(
  /** Ordre des entrées = ordre de dégustation (non re-trié). */
  rows: StockDocVintage[],
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

  const useRoboto = await attachRobotoPdf(doc);
  const fontFamily = useRoboto ? "Roboto" : "helvetica";
  doc.setFont(fontFamily, "normal");

  const tastingDate = options.tastingDate
    ? parseTastingDate(options.tastingDate)
    : new Date();
  y = await drawPdfNotesHeader(
    doc,
    pageW,
    margin,
    y,
    fontFamily,
    tastingDate,
  );

  let idx = 1;
  for (const v of rows) {
    const title = `${noteEntryNumber(idx)} ${v.wineryName} ${v.wineName}`;
    const grapes = v.grapeNames.length ? v.grapeNames.join(", ") : "—";
    const abvStr = v.abv != null ? `${v.abv}%` : "—";
    const detail = `${wineTypeLabelFr(v.wineTypeName)} / ${stockVintageLabel(v)} / ${abvStr} / Cépages : ${grapes} / ${v.appellationLine || "—"}`;

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
