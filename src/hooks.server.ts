import { redirect, type Handle } from "@sveltejs/kit";

/** Anciennes adresses : les favoris, les liens des e-mails envoyés et les QR codes imprimés restent valides. */
const MOVED: [from: string, to: string][] = [
  // Gestion, d'avant les huiles d'olive.
  ["/manage/wines", "/manage/products"],
  ["/manage/wineries", "/manage/producers"],
  ["/manage/grapes", "/manage/varieties"],
  // Site public, en français.
  ["/tastings", "/degustations"],
];

export const handle: Handle = ({ event, resolve }) => {
  const { pathname, search } = event.url;
  for (const [from, to] of MOVED) {
    if (pathname === from || pathname.startsWith(`${from}/`)) redirect(308, to + pathname.slice(from.length) + search);
  }
  return resolve(event);
};
