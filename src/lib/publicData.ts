import { supabase } from "./supabase";
import { VINTAGE_PUBLIC_SELECT } from "./wine";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Identifiant de page plausible (évite d'interroger la base pour une URL fantaisiste). */
export function isUuid(id: string): boolean {
  return UUID.test(id);
}

export type Availability = { in_stock: boolean; low_stock: boolean };

/** Disponibilité publique par millésime ; `null` si la fonction SQL n'est pas (encore) déployée. */
export async function fetchAvailability(): Promise<Map<string, Availability> | null> {
  try {
    const { data, error } = await supabase.rpc("public_wine_availability");
    if (error || !data) return null;
    return new Map(
      data.map((r) => [r.wine_vintage_id, { in_stock: r.in_stock, low_stock: r.low_stock }]),
    );
  } catch {
    return null;
  }
}

export type SeatInfo = { capacity: number | null; seats_taken: number; seats_left: number | null };

export async function fetchSeats(tastingId: string): Promise<SeatInfo | null> {
  try {
    const { data, error } = await supabase.rpc("tasting_availability", { p_tasting_id: tastingId });
    if (error || !data?.length) return null;
    return data[0];
  } catch {
    return null;
  }
}

/** Dégustation + vins dans l'ordre de passage. */
export async function fetchTastingWithWines(tastingId: string, opts: { reveal?: (date: string) => boolean } = {}) {
  const fetchLinks = () =>
    supabase
      .from("tasting_wine_vintage")
      .select(`order, wine_vintage ( ${VINTAGE_PUBLIC_SELECT} )`)
      .eq("tasting_id", tastingId)
      .order("order");

  /* Sans condition de dévoilement, les vins se lisent en même temps que la dégustation. */
  const [{ data: tasting, error }, eagerLinks] = await Promise.all([
    supabase.from("tasting").select("*").eq("id", tastingId).maybeSingle(),
    opts.reveal ? null : fetchLinks(),
  ]);

  if (error) return { tasting: null, wineVintages: [] as any[], error: error.message };
  if (!tasting) return { tasting: null, wineVintages: [] as any[], error: null };

  /* Vins encore secrets : on ne les charge pas, seulement leur nombre. */
  if (opts.reveal && !opts.reveal(tasting.date)) {
    const { count } = await supabase
      .from("tasting_wine_vintage")
      .select("wine_vintage_id", { count: "exact", head: true })
      .eq("tasting_id", tastingId);
    return { tasting, wineVintages: [] as any[], hiddenCount: count ?? 0, error: null };
  }

  const { data: links, error: linksError } = eagerLinks ?? (await fetchLinks());

  if (linksError) console.error("Erreur chargement des vins :", linksError);

  const wineVintages = ((links || []) as any[])
    .map((l) => l.wine_vintage)
    .filter(Boolean);

  return { tasting, wineVintages, hiddenCount: 0, error: null };
}

/** Nom public d'une dégustation. */
export function tastingTitle(t: { name?: string | null } | null | undefined): string {
  return t?.name?.trim() || "Dégustation Mezzaterra";
}

/** Dégustation privée (chez un client, en externe) : absente des listes publiques. */
export function isPrivateTasting(t: { is_private?: boolean | null } | null | undefined): boolean {
  return t?.is_private === true;
}
