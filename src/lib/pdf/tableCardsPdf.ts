import jsPDF from "jspdf";
import { attachRobotoPdf, pdfFileSlug, svgToPng } from "./assets";
import { qrDataUrl } from "$lib/qr";
import { formatDateLong } from "$lib/dates";
import { tastingTitle } from "$lib/publicData";
import { kindInfo, productHref } from "$lib/productKinds";
import {
  findNote,
  grapesText,
  wineStyle,
  wineSubtitle,
  winePairings,
  wineTitle,
} from "$lib/wine";
import { formatEUR } from "$lib/format";

/**
 * Fiches de table A5 (une par vin, à poser à côté de la bouteille) + une affiche A4
 * « Suivez la dégustation » avec le QR du mode live.
 */

const TEAL: [number, number, number] = [37, 97, 105];
const INK: [number, number, number] = [29, 42, 44];
const MUTED: [number, number, number] = [102, 120, 122];
const PAPER: [number, number, number] = [244, 242, 237];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export async function downloadTableCardsPdf(tasting: any, wines: any[], origin: string) {
  const doc = new jsPDF({ unit: "mm", format: "a5", orientation: "portrait" });
  const [font, logo] = await Promise.all([attachRobotoPdf(doc), svgToPng("/flyer/logo-text.svg")]);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;

  /* ——— Affiche « Suivez la dégustation » ——— */
  doc.addPage("a4", "portrait");
  doc.deletePage(1);
  {
    const PW = doc.internal.pageSize.getWidth();
    const PH = doc.internal.pageSize.getHeight();
    doc.setFillColor(...PAPER);
    doc.rect(0, 0, PW, PH, "F");
    if (logo) doc.addImage(logo.dataUrl, "PNG", (PW - 90) / 2, 22, 90, 90 * logo.aspect);
    doc.setFont(font, "bold");
    doc.setTextColor(...TEAL);
    doc.setFontSize(30);
    doc.text("Suivez la dégustation", PW / 2, 88, { align: "center" });
    doc.setFont(font, "normal");
    doc.setFontSize(14);
    doc.setTextColor(...INK);
    doc.text("Scannez, notez chaque vin et mettez vos coups de cœur de côté.", PW / 2, 98, { align: "center" });
    const liveQr = await qrDataUrl(`${origin}/tastings/${tasting.id}/live`, { size: 900 });
    doc.addImage(liveQr, "PNG", (PW - 110) / 2, 112, 110, 110);
    doc.setFontSize(12);
    doc.setTextColor(...MUTED);
    doc.text(`${tastingTitle(tasting)} — ${formatDateLong(tasting.date)}`, PW / 2, 236, { align: "center" });
    doc.text(`${wines.length} vins`, PW / 2, 243, { align: "center" });
  }

  /* ——— Une fiche A5 par vin ——— */
  for (let i = 0; i < wines.length; i++) {
    const v = wines[i];
    const wine = v.wine;
    const kind = kindInfo(wine);
    const style = wineStyle(wine?.wine_type);
    const robe = hexToRgb(style.color);
    doc.addPage("a5", "portrait");

    doc.setFillColor(...PAPER);
    doc.rect(0, 0, W, H, "F");
    doc.setFillColor(...robe);
    doc.rect(0, 0, 4, H, "F");

    if (logo) doc.addImage(logo.dataUrl, "PNG", W - M - 34, M - 2, 34, 34 * logo.aspect);

    /* Numéro de passage */
    doc.setFillColor(...TEAL);
    doc.circle(M + 7, M + 7, 7, "F");
    doc.setFont(font, "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(String(i + 1), M + 7, M + 9.3, { align: "center" });

    let y = M + 28;
    doc.setTextColor(...MUTED);
    doc.setFont(font, "normal");
    doc.setFontSize(8.5);
    doc.text(`${style.label.toUpperCase()}${v.year ? `  ·  ${v.year}` : ""}${v.abv ? `  ·  ${v.abv} % vol.` : ""}${v.organic ? "  ·  BIO" : ""}`, M, y);

    y += 9;
    doc.setTextColor(...TEAL);
    doc.setFont(font, "bold");
    doc.setFontSize(22);
    const titleLines = doc.splitTextToSize(wineTitle(wine), W - 2 * M);
    doc.text(titleLines, M, y);
    y += titleLines.length * 8.5;

    doc.setFont(font, "normal");
    doc.setTextColor(...INK);
    doc.setFontSize(11);
    if (wineSubtitle(wine)) {
      doc.text(wineSubtitle(wine), M, y);
      y += 5.5;
    }
    if (wine?.winery?.name) {
      doc.setFont(font, "bold");
      doc.text(wine.winery.name + (wine.winery.region?.name ? ` — ${wine.winery.region.name}` : ""), M, y);
      doc.setFont(font, "normal");
      y += 5.5;
    }
    const grapes = grapesText(v.wine_vintage_grape, true);
    if (grapes) {
      doc.setTextColor(...MUTED);
      doc.setFontSize(10);
      doc.text(doc.splitTextToSize(`${kind.ingredients} : ${grapes}`, W - 2 * M), M, y);
      y += 6;
    }

    y += 3;
    doc.setDrawColor(205, 200, 188);
    doc.line(M, y, W - M, y);
    y += 7;

    for (const nt of kind.noteTypes) {
      const content = findNote(v.note, nt.key);
      if (!content) continue;
      doc.setFont(font, "bold");
      doc.setFontSize(10);
      doc.setTextColor(...TEAL);
      doc.text(nt.label, M, y);
      doc.setFont(font, "normal");
      doc.setTextColor(...INK);
      const lines = doc.splitTextToSize(content, W - 2 * M - 22);
      doc.text(lines, M + 22, y);
      y += Math.max(1, lines.length) * 4.6 + 3;
      if (y > H - 62) break;
    }

    const pairings = winePairings(wine);
    if (pairings.length && y < H - 58) {
      doc.setFont(font, "bold");
      doc.setFontSize(10);
      doc.setTextColor(...TEAL);
      doc.text("À table", M, y);
      doc.setFont(font, "normal");
      doc.setTextColor(...INK);
      doc.text(doc.splitTextToSize(pairings.join(" · "), W - 2 * M - 22), M + 22, y);
    }

    /* Pied : prix + QR fiche */
    const qrSize = 30;
    const footY = H - M - qrSize;
    const qr = await qrDataUrl(`${origin}${productHref(v)}`, { size: 500 });
    doc.addImage(qr, "PNG", W - M - qrSize, footY, qrSize, qrSize);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("Fiche & partage", W - M - qrSize / 2, footY - 2, { align: "center" });

    if (v.price) {
      doc.setFont(font, "bold");
      doc.setFontSize(24);
      doc.setTextColor(...INK);
      doc.text(formatEUR(v.price).replace(/ /g, " "), M, H - M - 8);
      doc.setFont(font, "normal");
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text("la bouteille", M, H - M - 2);
    }
  }

  doc.save(`Fiches_table_${pdfFileSlug(tasting.name || tasting.date)}.pdf`);
}
