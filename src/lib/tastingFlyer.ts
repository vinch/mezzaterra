import { base } from "$app/paths";

/** Visuel « Prochaine dégustation » (format portrait réseaux sociaux / WhatsApp). */
export const FLYER_WIDTH = 960;
export const FLYER_HEIGHT = 1280;

const BG = "#e8e5de";
const TEAL = "#256169";
const TEAL_LIGHT = "#5b7d7f";
const DIVIDER = "#b8bfbb";
/** Nom de famille dédié : évite de tomber sur un « Inter » système d’une autre version. */
const FONT = "MezzaFlyerInter";
const MAX_TEXT_WIDTH = 880;

export type FlyerAssets = {
  logo: HTMLImageElement;
  photos: HTMLImageElement;
  pin: HTMLImageElement;
};

export type FlyerOptions = {
  /** Date ISO `YYYY-MM-DD`. */
  date: string;
  /** Heure `HH:MM`. */
  time: string;
  price: number;
};

const WEEKDAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** « Vendredi 16 octobre à 18h30 » (« 1er » pour le premier du mois, « 18h » si minutes nulles). */
export function formatFlyerDate(date: string, time: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return "";
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  const day = d === 1 ? "1er" : String(d);
  let line = `${weekday} ${day} ${MONTHS[m - 1]}`;
  const [hh, mm] = time.split(":");
  if (hh) {
    line += ` à ${Number(hh)}h${mm && mm !== "00" ? mm : ""}`;
  }
  return line;
}

/** « 20€ par personne » / « 22,50€ par personne ». */
export function formatFlyerPrice(price: number): string {
  const amount = Number.isInteger(price)
    ? String(price)
    : price.toFixed(2).replace(".", ",");
  return `${amount}€ par personne`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image introuvable : ${src}`));
    img.src = src;
  });
}

async function loadFonts(): Promise<void> {
  const faces = [
    new FontFace(FONT, `url(${base}/fonts/Inter-Regular.woff2)`, { weight: "400" }),
    new FontFace(FONT, `url(${base}/fonts/Inter-Medium.woff2)`, { weight: "500" }),
    new FontFace(FONT, `url(${base}/fonts/Inter-Bold.woff2)`, { weight: "700" }),
  ];
  await Promise.all(
    faces.map(async (face) => {
      await face.load();
      document.fonts.add(face);
    }),
  );
}

export async function loadFlyerAssets(): Promise<FlyerAssets> {
  const [logo, photos, pin] = await Promise.all([
    loadImage(`${base}/flyer/logo-text.svg`),
    loadImage(`${base}/flyer/photos.jpg`),
    loadImage(`${base}/flyer/pin.png`),
    loadFonts(),
  ]);
  return { logo, photos, pin };
}

/** Texte centré ; réduit la taille si la ligne dépasse `MAX_TEXT_WIDTH`. */
function centeredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  baseline: number,
  weight: number,
  size: number,
  color: string,
) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  const width = ctx.measureText(text).width;
  if (width > MAX_TEXT_WIDTH) {
    ctx.font = `${weight} ${(size * MAX_TEXT_WIDTH) / width}px ${FONT}`;
  }
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.fillText(text, FLYER_WIDTH / 2, baseline);
}

function divider(ctx: CanvasRenderingContext2D, y: number) {
  ctx.fillStyle = DIVIDER;
  ctx.fillRect(347, y, 266, 2);
}

export function drawTastingFlyer(
  ctx: CanvasRenderingContext2D,
  assets: FlyerAssets,
  options: FlyerOptions,
) {
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, FLYER_WIDTH, FLYER_HEIGHT);

  ctx.drawImage(assets.logo, 293, 56, 368, 162);

  ctx.fillStyle = TEAL;
  ctx.fillRect(0, 260, FLYER_WIDTH, 136);
  centeredText(ctx, "Prochaine dégustation", 347, 700, 53.5, "#ffffff");

  ctx.drawImage(assets.photos, 0, 396, FLYER_WIDTH, 249);

  centeredText(ctx, formatFlyerDate(options.date, options.time), 744, 700, 60.3, TEAL);
  divider(ctx, 792.5);

  centeredText(ctx, "Dégustation de 7 vins des Abruzzes", 866, 500, 35.5, TEAL);
  centeredText(ctx, "accompagnés de fromages et charcuteries.", 911, 500, 35.5, TEAL);
  divider(ctx, 964.5);

  centeredText(ctx, formatFlyerPrice(options.price), 1056, 700, 53.4, TEAL);
  centeredText(ctx, "Places limitées – réservation obligatoire.", 1100, 400, 27.1, TEAL_LIGHT);
  divider(ctx, 1153.5);

  ctx.drawImage(assets.pin, 148, 1191);
  ctx.font = `700 35.8px ${FONT}`;
  ctx.fillStyle = TEAL;
  ctx.textAlign = "left";
  ctx.fillText("16 Rue Belle Tête, 7190 Ecaussinnes", 189, 1229);
}
