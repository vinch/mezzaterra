import { NEW_ROW, supabase } from "./supabase";
import { todayIso } from "./dates";
import { itemsSubtotal } from "./sales";

/**
 * Demandes publiques dans la gestion : « J'en veux » transformés en ventes « En attente »,
 * réservations en ligne confirmées, messages du formulaire de contact.
 * Aucune vente n'est passée en « Payée » ici : le déstockage reste déclenché depuis /manage/sales.
 */

export type ContactInput = {
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type WishItem = { wine_vintage_id: string; quantity: number };

export type WishRequest = {
  id: string;
  tasting_id: string | null;
  source: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  items: WishItem[];
  message: string | null;
  status: string;
  sale_id: string | null;
  created_at: string;
};

/** Montant d'une demande (ou d'une pré-commande du mode dégustation) au prix catalogue. */
export function wishTotal(w: { items: unknown }, prices: Map<string, number>): number {
  return wishItems(w.items).reduce((s, i) => s + i.quantity * (prices.get(i.wine_vintage_id) ?? 0), 0);
}

/**
 * Client existant (même email, sinon même téléphone) ou nouveau client : même fonction SQL
 * que pour les réservations en ligne (find_or_create_customer).
 */
export async function findOrCreateCustomer(input: ContactInput): Promise<string> {
  const { data, error } = await supabase.rpc("admin_find_or_create_customer", {
    p_first_name: input.first_name,
    p_last_name: input.last_name ?? "",
    p_email: input.email ?? "",
    p_phone: input.phone ?? "",
  });
  if (error || !data) throw new Error(error?.message || "Création du client impossible");
  return data;
}

/**
 * Lie à la dégustation le client d'un « J'en veux » (ignore le doublon). Sans place : il était
 * déjà dans la salle, souvent comme accompagnant d'une réservation.
 */
export async function linkCustomerToTasting(tastingId: string, customerId: string) {
  const { error } = await supabase
    .from("tasting_customer")
    .insert({ tasting_id: tastingId, customer_id: customerId, seats: 0 });
  if (error && error.code !== "23505") throw new Error(error.message);
}

export function wishItems(raw: unknown): WishItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r: any) => ({ wine_vintage_id: String(r?.wine_vintage_id || ""), quantity: Number(r?.quantity) || 0 }))
    .filter((r) => r.wine_vintage_id && r.quantity > 0);
}

/**
 * Crée une vente « En attente » à partir d'une demande, au prix catalogue du millésime.
 * Retourne l'id de la vente.
 */
export async function createSaleFromWish(
  wish: WishRequest,
  prices: Map<string, number>,
  tastingName?: string | null,
): Promise<string> {
  const items = wishItems(wish.items);
  if (!items.length) throw new Error("La demande ne contient aucun vin.");

  const customerId = await findOrCreateCustomer(wish);
  if (wish.tasting_id) await linkCustomerToTasting(wish.tasting_id, customerId);

  const lines = items.map((i) => ({
    wine_vintage_id: i.wine_vintage_id,
    quantity: i.quantity,
    price: prices.get(i.wine_vintage_id) ?? 0,
  }));
  const total = itemsSubtotal(lines);

  const noteParts = [
    wish.source === "live" ? `Demande « J'en veux »${tastingName ? ` — ${tastingName}` : ""}` : "Demande depuis le site",
    wish.message?.trim(),
  ].filter(Boolean);

  /* Vente, lignes et demande marquée « traitée » en une transaction (fonction SQL save_sale). */
  const { data: saleId, error } = await supabase.rpc("save_sale", {
    p_sale_id: NEW_ROW,
    p_sale: {
      date: todayIso(),
      customer_id: customerId,
      total_price: total,
      note: noteParts.join("\n"),
      tasting_id: wish.tasting_id,
    },
    p_items: lines,
    p_wish_id: wish.id,
  });
  if (error || !saleId) throw new Error(error?.message || "Création de la vente impossible");

  return saleId;
}

export async function setWishStatus(id: string, status: "new" | "done" | "dismissed") {
  const { error } = await supabase.from("wish_request").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Réservation en ligne → client + participant (fonction SQL confirm_tasting_registration).
 * Les réservations confirmées sont rattachées dès l'inscription : ceci sert à la liste d'attente,
 * à rétablir une réservation annulée et au cas rare où le rattachement automatique a échoué.
 */
export async function confirmRegistration(registrationId: string) {
  const { error } = await supabase.rpc("confirm_tasting_registration", { p_registration_id: registrationId });
  if (error) throw new Error(error.message);
}

/** Message du formulaire de contact du site (table contact_message). */
export type ContactMessage = {
  id: string;
  reason: string;
  subject: string | null;
  first_name: string;
  last_name: string | null;
  email: string;
  phone: string | null;
  page: string | null;
  message: string;
  status: string;
  created_at: string;
};

export async function setContactStatus(id: string, status: "new" | "done") {
  const { error } = await supabase.from("contact_message").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Demandes à traiter : « J'en veux » et messages du site (compteur de la barre latérale, tableau de bord). */
export async function countNewRequests(): Promise<{ wishes: number; messages: number }> {
  const [wishes, messages] = await Promise.all([
    supabase.from("wish_request").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("contact_message").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);
  return { wishes: wishes.count ?? 0, messages: messages.count ?? 0 };
}
