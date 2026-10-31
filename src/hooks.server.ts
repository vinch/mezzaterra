import { redirect, type Handle } from "@sveltejs/kit";

/** Anciennes adresses de la gestion, d'avant les huiles d'olive : les favoris restent valides. */
const MOVED: [from: string, to: string][] = [
  ["/manage/wines", "/manage/products"],
  ["/manage/wineries", "/manage/producers"],
  ["/manage/grapes", "/manage/varieties"],
];

export const handle: Handle = ({ event, resolve }) => {
  const { pathname, search } = event.url;
  for (const [from, to] of MOVED) {
    if (pathname === from || pathname.startsWith(`${from}/`)) redirect(308, to + pathname.slice(from.length) + search);
  }
  return resolve(event);
};
