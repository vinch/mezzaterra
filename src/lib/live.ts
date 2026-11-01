import { browser } from "$app/environment";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { escapeLike, supabase } from "./supabase";

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

/** Valeur rangée par dégustation dans le localStorage, sous la clé `${prefix}:${tastingId}`. */
function perTasting<T>(prefix: string, parse: (stored: any) => T) {
  return {
    get: (tastingId: string): T => parse(read(`${prefix}:${tastingId}`, null)),
    save: (tastingId: string, value: T) => write(`${prefix}:${tastingId}`, value),
  };
}

export const localRatings = perTasting<Record<string, LocalRating>>("mz-ratings", (v) => v ?? {});
/** Dernier vin servi vu sur ce téléphone : un rechargement ne perd pas la progression. */
export const localServed = perTasting<number>("mz-served", (v) => Number(v) || 0);
export const localCart = perTasting<Record<string, number>>("mz-cart", (v) => v ?? {});
/** Panier changé mais pas encore en base (hors ligne, page quittée) : renvoyé à la prochaine occasion. */
const preorderDirty = perTasting<boolean>("mz-preorder-dirty", (v) => v === true);

/** Position valide dans un déroulé de `count` vins (0 si vide). */
export function clampPosition(p: number, count: number): number {
  return Math.max(0, Math.min(Math.max(0, count - 1), Math.round(p)));
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
 * Notes à jour d'une dégustation (une par invité et par vin) ou d'un client, d'après son email
 * (une par dégustation et par vin). tasting_feedback ne reçoit que des insertions : la plus
 * récente fait foi. Relevé en échec : aucune note.
 */
export async function fetchLatestFeedback(filter: { tastingId: string } | { guestEmail: string }) {
  const query = supabase
    .from("tasting_feedback")
    .select("id, tasting_id, guest_id, guest_name, wine_vintage_id, rating, comment, created_at");
  const byTasting = "tastingId" in filter;
  const { data } = await (byTasting
    ? query.eq("tasting_id", filter.tastingId)
    : query.ilike("guest_email", escapeLike(filter.guestEmail))
  ).order("created_at", { ascending: true });
  const latest = new Map<string, NonNullable<typeof data>[number]>();
  for (const f of data || []) latest.set(`${byTasting ? f.guest_id : f.tasting_id}:${f.wine_vintage_id}`, f);
  return [...latest.values()];
}

/**
 * Enregistre la pré-commande du téléphone (panier vide : supprimée), ou la confirme.
 * Faux en cas d'échec : le panier reste sur le téléphone.
 */
async function savePreorder(opts: {
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

/**
 * Envoi de la pré-commande d'un téléphone : enregistrée 700 ms après le dernier changement,
 * renvoyée tant qu'elle n'est pas en base (marque « non enregistré » dans le localStorage).
 * `snapshot` est lu au moment de l'envoi : c'est le panier du moment qui part.
 */
export function createPreorderSync(
  tastingId: string,
  snapshot: () => { cart: Record<string, number>; profile: GuestProfile },
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  /* Un envoi à la fois : une pré-commande en retard ne doit pas revenir après la confirmation. */
  let queue: Promise<unknown> = Promise.resolve();
  /** Numéro du dernier changement : seul son envoi réussi marque le panier comme enregistré. */
  let version = 0;

  /** Envoie le panier tel qu'il est au moment de l'envoi, après les envois précédents. */
  function push(confirm = false): Promise<boolean> {
    if (timer) clearTimeout(timer);
    timer = null;
    const run = queue.then(() => savePreorder({ tastingId, ...snapshot(), confirm }));
    queue = run;
    return run;
  }

  function schedule() {
    const v = ++version;
    preorderDirty.save(tastingId, true);
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      if ((await push()) && v === version) preorderDirty.save(tastingId, false);
    }, 700);
  }

  return {
    schedule,
    /** Changement pas encore enregistré (hors ligne, page quittée) : on le renvoie. */
    resume() {
      if (preorderDirty.get(tastingId)) schedule();
    },
    /** Confirme la pré-commande. En échec, elle reste sur le téléphone et sera renvoyée. */
    async confirm(): Promise<boolean> {
      if (!(await push(true))) {
        schedule();
        return false;
      }
      version++;
      preorderDirty.save(tastingId, false);
      return true;
    },
    /** En quittant la page : un changement de moins de 700 ms est envoyé quand même. */
    flush() {
      if (timer) void push();
    },
  };
}

type LiveEvents = {
  onPosition?: (position: number) => void;
  onSyncRequest?: () => void;
  onStatus?: (connected: boolean) => void;
};

function liveChannelName(tastingId: string): string {
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
