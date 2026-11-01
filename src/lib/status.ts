import { IconCheck, IconClock, IconLock, IconTruck, IconX } from "$lib/ui/icons";

/** Statuts (valeurs en base) des ventes, commandes fournisseur et transports : libellé, ton, icône. */

export type SaleStatus = "pending" | "paid" | "delivered" | "closed" | "cancelled";
export type StatusKind = "sale" | "order" | "transport";
/** Ton de couleur (variables --st-*-bg / --st-*-fg), partagé par les trois types. */
export type StatusTone = SaleStatus;
export type StatusMeta = { label: string; tone: StatusTone; icon: any; plural?: string };

export const STATUS_META: Record<SaleStatus, Required<StatusMeta>> = {
  pending: { label: "En attente", plural: "En attente", tone: "pending", icon: IconClock },
  paid: { label: "Payée", plural: "Payées", tone: "paid", icon: IconCheck },
  delivered: { label: "Livrée", plural: "Livrées", tone: "delivered", icon: IconTruck },
  closed: { label: "Clôturée", plural: "Clôturées", tone: "closed", icon: IconLock },
  cancelled: { label: "Annulée", plural: "Annulées", tone: "cancelled", icon: IconX },
};

/** Statuts par type, dans l'ordre des listes de choix. */
export const KIND_META: Record<StatusKind, Record<string, StatusMeta>> = {
  sale: STATUS_META,
  order: {
    pending: STATUS_META.pending,
    confirmed: { label: "Confirmée", tone: "paid", icon: IconCheck },
  },
  transport: {
    pending: STATUS_META.pending,
    in_transit: { label: "En transit", tone: "delivered", icon: IconTruck },
    delivered: { label: "Livré", tone: "paid", icon: IconCheck },
    cancelled: { label: "Annulé", tone: "cancelled", icon: IconX },
  },
};

const STATUS_RANKS = Object.fromEntries(
  Object.entries(KIND_META).map(([kind, meta]) => [kind, new Map(Object.keys(meta).map((s, i) => [s, i]))]),
) as Record<StatusKind, Map<string, number>>;

/** Rang d'un statut dans l'ordre de son type (tri d'une colonne Statut) ; un statut inconnu vient en dernier. */
export function statusRank(kind: StatusKind, status: string | null | undefined): number {
  const ranks = STATUS_RANKS[kind];
  return ranks.get(status ?? "pending") ?? ranks.size;
}

export function statusMeta(kind: StatusKind, status: string | null | undefined): StatusMeta {
  return KIND_META[kind][status ?? "pending"] ?? { label: status ?? "", tone: "closed", icon: IconLock };
}

/**
 * Transitions de statut proposées dans les menus, par type (mêmes règles que set_sale_status en
 * base pour une vente). Une commande confirmée est figée ; un transport livré aussi (son stock est
 * entré, set_transport_status refuse ensuite tout changement). Chaque cible a son action dans STATUS_ACTIONS.
 */
const STATUS_TRANSITIONS: Record<StatusKind, Record<string, string[]>> = {
  sale: {
    pending: ["paid", "delivered"],
    paid: ["delivered", "closed"],
    delivered: ["paid", "closed"],
  },
  order: { pending: ["confirmed"] },
  transport: {
    pending: ["in_transit", "delivered", "cancelled"],
    in_transit: ["pending", "delivered", "cancelled"],
    cancelled: ["pending", "in_transit", "delivered"],
  },
};

/**
 * Encore modifiable ou supprimable : vente « En attente » (son stock n'est pas sorti, mêmes règles
 * que save_sale en base), commande non confirmée, transport ni livré ni annulé.
 */
export function isEditable(kind: StatusKind, status: string | null | undefined): boolean {
  if (kind === "sale") return status === "pending";
  if (kind === "order") return status !== "confirmed";
  return status !== "delivered" && status !== "cancelled";
}

/** Libellé et icône des actions qui font passer à un statut (menu du badge). */
const STATUS_ACTIONS: Record<StatusKind, Record<string, { label: string; icon: any }>> = {
  sale: {
    paid: { label: "Marquer comme payée", icon: IconCheck },
    delivered: { label: "Marquer comme livrée", icon: IconTruck },
    closed: { label: "Clôturer et facturer", icon: IconLock },
  },
  order: {
    confirmed: { label: "Confirmer la commande", icon: IconCheck },
  },
  transport: {
    pending: { label: "Remettre en attente", icon: IconClock },
    in_transit: { label: "Marquer en transit", icon: IconTruck },
    delivered: { label: "Marquer comme livré", icon: IconCheck },
    cancelled: { label: "Annuler le transport", icon: IconX },
  },
};

/** Éléments de menu (MenuItem) des transitions permises depuis `status` (vide : « En attente »). */
export function statusMenuItems(kind: StatusKind, status: string | null | undefined, onSelect: (next: string) => void) {
  return (STATUS_TRANSITIONS[kind][status || "pending"] ?? []).map((next) => ({
    ...STATUS_ACTIONS[kind][next],
    onSelect: () => onSelect(next),
  }));
}

/** Le statut peut encore changer : le badge devient un bouton. */
export function canChangeStatus(kind: StatusKind, status: string | null | undefined): boolean {
  return !!STATUS_TRANSITIONS[kind][status || "pending"]?.length;
}
