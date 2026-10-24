import { base } from "$app/paths";
import type jsPDF from "jspdf";

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
