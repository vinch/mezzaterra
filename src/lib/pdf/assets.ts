import { base } from "$app/paths";
import type jsPDF from "jspdf";
import { loadImage } from "$lib/images";

/** Polices et images partagées par les générateurs PDF (documents, fiches de table). */

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

/**
 * Roboto (Identity-H) : €, accents, etc. — Helvetica WinAnsi corrompt l’Unicode.
 * Renvoie la police à utiliser : Roboto si elle a pu être chargée, sinon Helvetica.
 */
export async function attachRobotoPdf(doc: jsPDF): Promise<"Roboto" | "helvetica"> {
  if (typeof fetch === "undefined") return "helvetica";
  const fonts = await loadRobotoBase64();
  if (!fonts) return "helvetica";
  const regName = "Roboto-Regular.ttf";
  const boldName = "Roboto-Bold.ttf";
  doc.addFileToVFS(regName, fonts[0]);
  doc.addFont(regName, "Roboto", "normal");
  doc.addFileToVFS(boldName, fonts[1]);
  doc.addFont(boldName, "Roboto", "bold");
  return "Roboto";
}

/** Image prête pour `doc.addImage`, avec son ratio hauteur / largeur. */
export type PdfImage = { dataUrl: string; aspect: number };

/** Ratio hauteur / largeur ; null si l’image n’a pas de dimensions. */
function aspectOf(img: HTMLImageElement): number | null {
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  return width && height ? height / width : null;
}

/**
 * SVG de `static/` (ex. « /logo-black.svg ») rasterisé : jsPDF n’accepte pas le SVG. Assez large pour
 * rester net une fois réduit en mm.
 */
export async function svgToPng(path: string, widthPx = 1600): Promise<PdfImage | null> {
  if (typeof fetch === "undefined" || typeof document === "undefined") {
    return null;
  }
  try {
    const res = await fetch(`${base}${path}`);
    if (!res.ok) return null;
    const blob = new Blob([await res.text()], {
      type: "image/svg+xml;charset=utf-8",
    });
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await loadImage(objectUrl);
      const aspect = aspectOf(img);
      if (!aspect) return null;
      const heightPx = Math.max(1, Math.round(widthPx * aspect));
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

/** PNG de `static/` (ex. « /qr.png ») tel quel, en data URL. */
export async function staticPng(path: string): Promise<PdfImage | null> {
  if (typeof fetch === "undefined") return null;
  try {
    const res = await fetch(`${base}${path}`);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error("read"));
      fr.readAsDataURL(blob);
    });
    const aspect = aspectOf(await loadImage(dataUrl));
    return aspect ? { dataUrl, aspect } : null;
  } catch {
    return null;
  }
}

/**
 * Morceau de nom de fichier sûr : chaque caractère qui n’est ni lettre ni chiffre devient « _ »
 * (un par caractère, sans fusion : les noms des factures et bons de commande archivés ne bougent pas).
 */
export function pdfFileSlug(s: string): string {
  return s.replace(/[^a-zA-Z0-9]/g, "_");
}
