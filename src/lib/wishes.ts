import { escapeLike, supabase } from "./supabase";
import { todayIso } from "./dates";

/**
 * Transformation des demandes publiques (inscriptions, « J'en veux ») en données de gestion :
 * clients, participants de dégustation, ventes « En attente ».
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

/** Montant d'une demande au prix catalogue. */
export function wishTotal(w: WishRequest, prices: Map<string, number>): number {
  return wishItems(w.items).reduce((s, i) => s + i.quantity * (prices.get(i.wine_vintage_id) ?? 0), 0);
}

/** Client existant (même email, sinon même téléphone) ou nouveau client. */
export async function findOrCreateCustomer(input: ContactInput): Promise<{ id: string; created: boolean }> {
  const email = input.email?.trim().toLowerCase() || null;
  const phone = input.phone?.trim() || null;

  if (email) {
    const { data } = await supabase.from("customer").select("id").ilike("email", escapeLike(email)).limit(1);
    if (data?.length) return { id: data[0].id, created: false };
  }
  if (phone) {
    const { data } = await supabase.from("customer").select("id").eq("phone_number", phone).limit(1);
    if (data?.length) return { id: data[0].id, created: false };
  }

  const { data: created, error } = await supabase
    .from("customer")
    .insert({
      first_name: input.first_name.trim() || "—",
      last_name: input.last_name?.trim() || "",
      email,
      phone_number: phone,
    })
    .select("id")
    .single();

  if (error || !created) throw new Error(error?.message || "Création du client impossible");
  return { id: created.id, created: true };
}

/** Lie un client à une dégustation (ignore le doublon). */
export async function linkCustomerToTasting(tastingId: string, customerId: string) {
  const { error } = await supabase
    .from("tasting_customer")
    .insert({ tasting_id: tastingId, customer_id: customerId });
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

  const customer = await findOrCreateCustomer(wish);
  if (wish.tasting_id) await linkCustomerToTasting(wish.tasting_id, customer.id);

  const lines = items.map((i) => ({
    wine_vintage_id: i.wine_vintage_id,
    quantity: i.quantity,
    price: prices.get(i.wine_vintage_id) ?? 0,
  }));
  const total = Math.round(lines.reduce((s, l) => s + l.price * l.quantity, 0) * 100) / 100;

  const noteParts = [
    wish.source === "live" ? `Demande « J'en veux »${tastingName ? ` — ${tastingName}` : ""}` : "Demande depuis le site",
    wish.message?.trim(),
  ].filter(Boolean);

  const { data: sale, error } = await supabase
    .from("sale")
    .insert({
      date: todayIso(),
      customer_id: customer.id,
      status: "pending",
      total_price: total,
      note: noteParts.join("\n"),
      tasting_id: wish.tasting_id,
    })
    .select("id")
    .single();

  if (error || !sale) throw new Error(error?.message || "Création de la vente impossible");

  const { error: itemsError } = await supabase.from("sale_item").insert(
    lines.map((l) => ({
      sale_id: sale.id,
      wine_vintage_id: l.wine_vintage_id,
      quantity: l.quantity,
      price: l.price,
      discount: null,
      discount_type: null,
      note: null,
    })),
  );
  if (itemsError) throw new Error(itemsError.message);

  const { error: updError } = await supabase
    .from("wish_request")
    .update({ status: "done", sale_id: sale.id })
    .eq("id", wish.id);
  if (updError) throw new Error(updError.message);

  return sale.id;
}

export async function setWishStatus(id: string, status: "new" | "done" | "dismissed") {
  const { error } = await supabase.from("wish_request").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Inscription → client + participant de la dégustation. */
export async function confirmRegistrationAsGuest(reg: {
  id: string;
  tasting_id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone: string | null;
}): Promise<string> {
  const customer = await findOrCreateCustomer(reg);
  await linkCustomerToTasting(reg.tasting_id, customer.id);
  await supabase.from("tasting_registration").update({ customer_id: customer.id }).eq("id", reg.id);
  return customer.id;
}
