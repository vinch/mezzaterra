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

export function statusMeta(kind: StatusKind, status: string | null | undefined): StatusMeta {
  return KIND_META[kind][status ?? "pending"] ?? { label: status ?? "", tone: "closed", icon: IconLock };
}

/** Transitions de statut d'une vente proposées dans les menus (mêmes règles que set_sale_status en base). */
export const SALE_TRANSITIONS: Record<string, SaleStatus[]> = {
  pending: ["paid", "delivered"],
  paid: ["delivered", "closed"],
  delivered: ["paid", "closed"],
};

/** Ventes encore modifiables : leur badge devient un bouton. */
export const EDITABLE_STATUSES: SaleStatus[] = ["pending", "paid", "delivered"];
