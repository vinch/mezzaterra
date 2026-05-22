import { base } from "$app/paths";
import jsPDF from "jspdf";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type StockDocVintage = {
  id: string;
  wine_id: string;
  wine_type_id: string | null;
  winery_id: string;
  quantity_on_hand: number;
  production_year: number;
  year: number | null;
  price: number | null;
  abv: number | null;
  wineName: string;
  wineryName: string;
  wineTypeName: string;
  wineTypeCategory: string | null;
  appellationLine: string;
  grapeNames: string[];
};

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

/** Roboto (Identity-H) : €, accents, etc. — Helvetica WinAnsi corrompt l’Unicode. */
async function attachRobotoPdf(doc: jsPDF): Promise<boolean> {
  if (typeof fetch === "undefined") return false;
  try {
    const [regRes, boldRes] = await Promise.all([
      fetch(`${base}/fonts/Roboto-Regular.ttf`),
      fetch(`${base}/fonts/Roboto-Bold.ttf`),
    ]);
    if (!regRes.ok || !boldRes.ok) return false;
    const [regBuf, boldBuf] = await Promise.all([
      regRes.arrayBuffer(),
      boldRes.arrayBuffer(),
    ]);
    const regName = "Roboto-Regular.ttf";
    const boldName = "Roboto-Bold.ttf";
    doc.addFileToVFS(regName, arrayBufferToBase64(regBuf));
    doc.addFont(regName, "Roboto", "normal");
    doc.addFileToVFS(boldName, arrayBufferToBase64(boldBuf));
    doc.addFont(boldName, "Roboto", "bold");
    return true;
  } catch {
    return false;
  }
}

function wineDisplayName(wine: {
  name: string | null;
  appelation?: { name: string | null; label?: { name: string | null } | null } | null;
}): string {
  if (wine.name?.trim()) return wine.name.trim();
  const ap = wine.appelation;
  const parts = [ap?.label?.name, ap?.name].filter(Boolean) as string[];
  return parts.join(" ").trim() || "Sans nom";
}

function appellationLine(wine: {
  appelation?: { name: string | null; label?: { name: string | null } | null } | null;
}): string {
  const ap = wine.appelation;
  if (!ap) return "";
  const parts = [ap.label?.name, ap.name].filter(Boolean) as string[];
  return parts.join(" ");
}

function collectGrapeNames(
  rows: { grape?: { name: string } | null; percentage: number | null }[] | null | undefined,
): string[] {
  if (!rows?.length) return [];
  const sorted = [...rows].sort((a, b) => {
    const pa = a.percentage ?? 0;
    const pb = b.percentage ?? 0;
    if (pa !== pb) return pb - pa;
    return (a.grape?.name || "").localeCompare(b.grape?.name || "");
  });
  return sorted
    .map((r) => r.grape?.name)
    .filter((n): n is string => Boolean(n?.trim()));
}

export function mapInventoryToDocVintages(
  invRows: {
    quantity_on_hand: number | null;
    wine_vintage: {
      id: string;
      production_year: number;
      year: number | null;
      price: number | null;
      abv: number | null;
      wine: {
        id: string;
        winery_id: string;
        name: string | null;
        wine_type_id: string | null;
        winery?: { name: string | null } | null;
        appelation?: {
          name: string | null;
          label?: { name: string | null } | null;
        } | null;
        wine_type?: { name: string; category?: string | null } | null;
      } | null;
      wine_vintage_grape?: {
        percentage: number | null;
        grape: { name: string } | null;
      }[] | null;
    } | null;
  }[],
): StockDocVintage[] {
  const out: StockDocVintage[] = [];
  for (const row of invRows) {
    const v = row.wine_vintage;
    const w = v?.wine;
    if (!v || !w || (row.quantity_on_hand ?? 0) <= 0) continue;
    out.push({
      id: v.id,
      wine_id: w.id,
      wine_type_id: w.wine_type_id ?? null,
      winery_id: w.winery_id,
      quantity_on_hand: row.quantity_on_hand ?? 0,
      production_year: v.production_year,
      year: v.year,
      price: v.price,
      abv: v.abv,
      wineName: wineDisplayName(w),
      wineryName: w.winery?.name?.trim() || "—",
      wineTypeName: w.wine_type?.name?.trim() || "Autre",
      wineTypeCategory: w.wine_type?.category ?? null,
      appellationLine: appellationLine(w),
      grapeNames: collectGrapeNames(v.wine_vintage_grape),
    });
  }
  return out;
}

export async function fetchStockDocVintages(
  supabase: SupabaseClient<Database>,
): Promise<{ data: StockDocVintage[]; error: string | null }> {
  const { data: invRows, error: invErr } = await supabase
    .from("inventory")
    .select("wine_vintage_id, quantity_on_hand")
    .gt("quantity_on_hand", 0);

  if (invErr) {
    return { data: [], error: invErr.message };
  }

  /** Plusieurs lignes inventaire pour le même millésime → une seule ligne doc (quantités additionnées). */
  const qtyByVintage = new Map<string, number>();
  for (const r of invRows || []) {
    const vid = r.wine_vintage_id;
    if (vid == null) continue;
    const q = r.quantity_on_hand ?? 0;
    if (q <= 0) continue;
    qtyByVintage.set(vid, (qtyByVintage.get(vid) ?? 0) + q);
  }

  if (qtyByVintage.size === 0) {
    return { data: [], error: null };
  }

  const ids = [...qtyByVintage.keys()];

  const { data: vintages, error: vErr } = await supabase
    .from("wine_vintage")
    .select(
      `
      id,
      production_year,
      year,
      price,
      abv,
      wine (
        id,
        winery_id,
        name,
        wine_type_id,
        winery (name),
        appelation (name, label (name)),
        wine_type (name, category)
      ),
      wine_vintage_grape (
        percentage,
        grape (name)
      )
    `,
    )
    .in("id", ids);

  if (vErr) {
    return { data: [], error: vErr.message };
  }

  const vintageMap = new Map((vintages || []).map((v) => [v.id, v]));

  const merged: Parameters<typeof mapInventoryToDocVintages>[0] = [];
  for (const [wine_vintage_id, quantity_on_hand] of qtyByVintage) {
    const v = vintageMap.get(wine_vintage_id);
    if (!v?.wine) continue;
    merged.push({
      quantity_on_hand,
      wine_vintage: v,
    } as Parameters<typeof mapInventoryToDocVintages>[0][number]);
  }

  return { data: mapInventoryToDocVintages(merged), error: null };
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

function sortDocVintages(a: StockDocVintage, b: StockDocVintage): number {
  const g = GROUP_ORDER.indexOf(priceGroupKey(a)) - GROUP_ORDER.indexOf(priceGroupKey(b));
  if (g !== 0) return g;
  const wA = a.wineryName.toLowerCase();
  const wB = b.wineryName.toLowerCase();
  if (wA !== wB) return wA.localeCompare(wB);
  const nA = a.wineName.toLowerCase();
  const nB = b.wineName.toLowerCase();
  if (nA !== nB) return nA.localeCompare(nB);
  return b.production_year - a.production_year;
}

export function sortedStockForDocuments(rows: StockDocVintage[]): StockDocVintage[] {
  return [...rows].sort(sortDocVintages);
}

function formatEur(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(2).replace(".", ",")} €`;
}

/** Libellé type de vin en français pour les PDF / UI documents. */
export function wineTypeLabelFr(name: string): string {
  const n = name.trim().toLowerCase();
  if (n === "white") return "Blanc";
  if (n === "red") return "Rouge";
  if (n === "rose" || n === "rosé") return "Rosé";
  if (n === "blanc") return "Blanc";
  if (n === "rouge") return "Rouge";
  return name;
}

function displayYear(v: StockDocVintage): string {
  if (v.year != null && v.year !== v.production_year) {
    return `${v.year} (${v.production_year})`;
  }
  return String(v.production_year);
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

/** jsPDF n’accepte pas le SVG ; rasterisation côté navigateur pour `static/logo-black.svg`. */
async function loadBlackLogoPngForPdf(): Promise<{
  dataUrl: string;
  aspect: number;
} | null> {
  if (typeof fetch === "undefined" || typeof document === "undefined") {
    return null;
  }
  try {
    const res = await fetch(`${base}/logo-black.svg`);
    if (!res.ok) return null;
    const svgText = await res.text();
    const blob = new Blob([svgText], {
      type: "image/svg+xml;charset=utf-8",
    });
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("logo"));
        img.src = objectUrl;
      });
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      if (!iw || !ih) return null;
      /** Raster large pour un logo net une fois réduit en mm dans le PDF. */
      const targetPxW = 3000;
      const targetPxH = Math.max(1, Math.round(targetPxW * (ih / iw)));
      img.width = targetPxW;
      img.height = targetPxH;
      const canvas = document.createElement("canvas");
      canvas.width = targetPxW;
      canvas.height = targetPxH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, targetPxW, targetPxH);
      return { dataUrl: canvas.toDataURL("image/png"), aspect: targetPxH / targetPxW };
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
    loadBlackLogoPngForPdf(),
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
    loadBlackLogoPngForPdf(),
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
    const detail = `${wineTypeLabelFr(v.wineTypeName)} / ${displayYear(v)} / ${abvStr} / Cépages : ${grapes} / ${v.appellationLine || "—"}`;

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
