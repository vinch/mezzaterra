import { fetchAllRows, supabase } from "./supabase";
import { VINTAGE_PUBLIC_SELECT } from "./wine";
import { DEFAULT_KIND, PRODUCT_KIND_LIST, type ProductKind } from "./productKinds";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Identifiant de page plausible (évite d'interroger la base pour une URL fantaisiste). */
export function isUuid(id: string): boolean {
  return UUID.test(id);
}

export type Availability = { in_stock: boolean; low_stock: boolean };
/** Disponibilité d'un millésime d'après son identifiant. */
export type AvailabilityOf = (vintageId: string) => Availability;

const SOLD_OUT: Availability = { in_stock: false, low_stock: false };

/**
 * Disponibilité publique par millésime ; `null` si la fonction SQL n'est pas (encore) déployée.
 * Un millésime absent de la vue `inventory` (aucun mouvement de stock) est épuisé, comme
 * dans la liste des vins de l'admin.
 */
export async function fetchAvailability(): Promise<AvailabilityOf | null> {
  try {
    /* Paginé : une ligne tronquée par la limite PostgREST passerait pour épuisée. */
    const rows = await fetchAllRows<{ wine_vintage_id: string; in_stock: boolean; low_stock: boolean }>((a, b) =>
      supabase.rpc("public_wine_availability").order("wine_vintage_id").range(a, b),
    );
    const byVintage = new Map(rows.map((r) => [r.wine_vintage_id, { in_stock: r.in_stock, low_stock: r.low_stock }]));
    return (vintageId) => byVintage.get(vintageId) ?? SOLD_OUT;
  } catch {
    return null;
  }
}

/**
 * Types de produit à présenter sur le site : le vin toujours, les autres dès qu'un de leurs lots est
 * au catalogue public (pas de lien « Nos huiles » vers une page vide).
 */
export async function fetchCatalogKinds(): Promise<ProductKind[]> {
  try {
    /* Un lot suffit : une petite requête par autre type de produit, en parallèle. */
    const others = await Promise.all(
      PRODUCT_KIND_LIST.filter((k) => k.key !== DEFAULT_KIND).map(async (k) => {
        const { data } = await supabase
          .from("wine_vintage")
          .select("id, wine!inner ( kind )")
          .eq("wine.kind", k.key)
          .is("discontinued_at", null)
          .limit(1);
        return data?.length ? [k.key] : [];
      }),
    );
    return [DEFAULT_KIND, ...others.flat()];
  } catch {
    return [DEFAULT_KIND];
  }
}

/** Plusieurs contenants présentés ensemble : en stock si l'un l'est, « dernières bouteilles » si tous ceux en stock le sont. */
export function combinedAvailability(of: AvailabilityOf | null, lots: { id: string }[]): Availability | null {
  if (!of) return null;
  const inStock = lots.map((l) => of(l.id)).filter((a) => a.in_stock);
  return { in_stock: inStock.length > 0, low_stock: inStock.length > 0 && inStock.every((a) => a.low_stock) };
}

/** Contenant vers lequel mène une carte : le premier en stock, sinon le plus petit. */
export function firstAvailable<T extends { id: string }>(of: AvailabilityOf | null, lots: T[]): T {
  return (of && lots.find((l) => of(l.id).in_stock)) || lots[0];
}

export type SeatInfo = { capacity: number | null; seats_taken: number; seats_left: number | null };

/** Places des réservations en ligne confirmées. */
export function onlineSeats(registrations: { status: string; seats: number }[]): number {
  return registrations.filter((r) => r.status === "confirmed").reduce((n, r) => n + r.seats, 0);
}

type RegistrationSeats = { status: string; seats: number; customer_id: string | null };

/** Réservation confirmée et rattachée à un client : elle figure parmi les participants. */
export function isParticipantRegistration(r: RegistrationSeats): r is RegistrationSeats & { customer_id: string } {
  return r.status === "confirmed" && r.customer_id != null;
}

/** Places réservées en ligne (confirmées) par client participant. */
export function onlineSeatsByCustomer(registrations: RegistrationSeats[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of registrations.filter(isParticipantRegistration)) m.set(r.customer_id, (m.get(r.customer_id) ?? 0) + r.seats);
  return m;
}

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

/** Adresse des dégustations publiques. Le champ « Lieu » d'une dégustation est un repère interne (« Grange »). */
export const TASTING_ADDRESS = "16 Rue Belle Tête, 7190 Ecaussinnes";

/** Nom public d'une dégustation. */
export function tastingTitle(t: { name?: string | null } | null | undefined): string {
  return t?.name?.trim() || "Dégustation Mezzaterra";
}

/** Dégustation privée (chez un client, en externe) : absente des listes publiques. */
export function isPrivateTasting(t: { is_private?: boolean | null } | null | undefined): boolean {
  return t?.is_private === true;
}
