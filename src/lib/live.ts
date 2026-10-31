import { browser } from "$app/environment";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/**
 * Mode dégustation live.
 * - La position du vin servi est poussée par l'admin via Realtime Broadcast
 *   et persistée dans `tasting.live_position` pour les retardataires.
 * - Les notes et le panier des invités vivent d'abord dans le localStorage (ça marche hors-ligne),
 *   puis sont envoyés en base quand c’est possible.
 * - Le panier est une pré-commande (live_preorder) : « J'en veux » l'enregistre sans rien demander,
 *   l'invité la confirme depuis son récap et elle devient une demande « J'en veux » (wish_request).
 */

export type GuestProfile = { firstName: string; lastName: string; email: string; phone: string };
export type LocalRating = { rating: number | null; comment: string; updatedAt: string };


const GUEST_ID_KEY = "mz-guest-id";
const PROFILE_KEY = "mz-guest-profile";

function read<T>(key: string, fallback: T): T {
  if (!browser) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (!browser) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Quota / navigation privée : tant pis, l'état reste en mémoire. */
  }
}

function uuid(): string {
  if (browser && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/* Gardé en mémoire : sans localStorage, le même téléphone garde le même id jusqu'au rechargement. */
let guestId: string | null = null;

export function getGuestId(): string {
  if (!browser) return uuid();
  guestId ??= read<string | null>(GUEST_ID_KEY, null);
  if (!guestId) {
    guestId = uuid();
    write(GUEST_ID_KEY, guestId);
  }
  return guestId;
}

export function getProfile(): GuestProfile {
  return read<GuestProfile>(PROFILE_KEY, { firstName: "", lastName: "", email: "", phone: "" });
}

/** « Prénom Nom », tel que l'invité l'a saisi. */
export function guestName(p: GuestProfile): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
}

export function saveProfile(p: GuestProfile) {
  write(PROFILE_KEY, p);
}

export function getRatings(tastingId: string): Record<string, LocalRating> {
  return read(`mz-ratings:${tastingId}`, {});
}

export function saveRatings(tastingId: string, ratings: Record<string, LocalRating>) {
  write(`mz-ratings:${tastingId}`, ratings);
}

/** Dernier vin servi vu sur ce téléphone : un rechargement ne perd pas la progression. */
export function getServed(tastingId: string): number {
  return Number(read(`mz-served:${tastingId}`, 0)) || 0;
}

export function saveServed(tastingId: string, position: number) {
  write(`mz-served:${tastingId}`, position);
}

export function getCart(tastingId: string): Record<string, number> {
  return read(`mz-cart:${tastingId}`, {});
}

export function saveCart(tastingId: string, cart: Record<string, number>) {
  write(`mz-cart:${tastingId}`, cart);
}

/** Panier changé mais pas encore en base (hors ligne, page quittée) : renvoyé à la prochaine occasion. */
export function isPreorderDirty(tastingId: string): boolean {
  return read<boolean>(`mz-preorder-dirty:${tastingId}`, false) === true;
}

export function setPreorderDirty(tastingId: string, dirty: boolean) {
  write(`mz-preorder-dirty:${tastingId}`, dirty);
}

/** Envoie une note en base (insert-only ; la plus récente fait foi). Silencieux en cas d'échec. */
export async function pushFeedback(opts: {
  tastingId: string;
  vintageId: string;
  rating: number | null;
  comment: string;
  profile: GuestProfile;
}): Promise<boolean> {
  try {
    const name = guestName(opts.profile);
    const { error } = await supabase.from("tasting_feedback").insert({
      tasting_id: opts.tastingId,
      wine_vintage_id: opts.vintageId,
      guest_id: getGuestId(),
      guest_name: name || null,
      guest_email: opts.profile.email.trim().toLowerCase() || null,
      rating: opts.rating,
      comment: opts.comment.trim().slice(0, 1000) || null,
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Enregistre la pré-commande du téléphone (panier vide : supprimée), ou la confirme.
 * Faux en cas d'échec : le panier reste sur le téléphone.
 */
export async function savePreorder(opts: {
  tastingId: string;
  cart: Record<string, number>;
  profile: GuestProfile;
  confirm?: boolean;
}): Promise<boolean> {
  try {
    const { error } = await supabase.rpc("save_live_preorder", {
      p_tasting_id: opts.tastingId,
      p_guest_id: getGuestId(),
      p_items: Object.entries(opts.cart).map(([wine_vintage_id, quantity]) => ({ wine_vintage_id, quantity })),
      p_first_name: opts.profile.firstName,
      p_last_name: opts.profile.lastName,
      p_email: opts.profile.email,
      p_phone: opts.profile.phone,
      p_confirm: opts.confirm ?? false,
    });
    return !error;
  } catch {
    return false;
  }
}

export type LiveEvents = {
  onPosition?: (position: number) => void;
  onSyncRequest?: () => void;
  onStatus?: (connected: boolean) => void;
};

export function liveChannelName(tastingId: string): string {
  return `tasting-live-${tastingId}`;
}

export function joinLiveChannel(
  tastingId: string,
  events: LiveEvents & { onGuestCount?: (n: number) => void },
  role: "guest" | "host" = "guest",
): RealtimeChannel {
  const channel = supabase.channel(liveChannelName(tastingId), {
    config: {
      broadcast: { self: false },
      presence: { key: role === "guest" ? getGuestId() : `host-${Math.random().toString(36).slice(2)}` },
    },
  });

  channel
    .on("broadcast", { event: "position" }, ({ payload }) => {
      const p = Number(payload?.position);
      if (Number.isFinite(p)) events.onPosition?.(p);
    })
    .on("broadcast", { event: "sync-request" }, () => events.onSyncRequest?.())
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<{ role?: string }>();
      const guests = Object.values(state).filter((metas) => metas.some((m) => m.role === "guest"));
      events.onGuestCount?.(guests.length);
    })
    .subscribe((status) => {
      const ok = status === "SUBSCRIBED";
      events.onStatus?.(ok);
      if (ok) void channel.track({ role });
    });

  return channel;
}

export function broadcastPosition(channel: RealtimeChannel, position: number) {
  return channel.send({ type: "broadcast", event: "position", payload: { position } });
}

export function requestSync(channel: RealtimeChannel) {
  return channel.send({ type: "broadcast", event: "sync-request", payload: {} });
}
