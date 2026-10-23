<script lang="ts" context="module">
  import { IconCheck, IconChevronDown, IconClock, IconLock, IconTruck, IconX } from "./icons";

  /** Statuts de vente (valeurs en base) → libellé, icône, couleurs. */
  export type SaleStatus = "pending" | "paid" | "delivered" | "closed" | "cancelled";
  export type StatusKind = "sale" | "order" | "transport";
  type Tone = "pending" | "paid" | "delivered" | "closed" | "cancelled";
  type Meta = { label: string; plural: string; tone: Tone; icon: any };

  export const STATUS_META: Record<SaleStatus, Meta> = {
    pending: { label: "En attente", plural: "En attente", tone: "pending", icon: IconClock },
    paid: { label: "Payée", plural: "Payées", tone: "paid", icon: IconCheck },
    delivered: { label: "Livrée", plural: "Livrées", tone: "delivered", icon: IconTruck },
    closed: { label: "Clôturée", plural: "Clôturées", tone: "closed", icon: IconLock },
    cancelled: { label: "Annulée", plural: "Annulées", tone: "cancelled", icon: IconX },
  };

  /** Statuts des commandes fournisseur et des transports, mêmes tons que les ventes. */
  const KIND_META: Record<StatusKind, Record<string, Meta>> = {
    sale: STATUS_META,
    order: {
      pending: { label: "En attente", plural: "En attente", tone: "pending", icon: IconClock },
      confirmed: { label: "Confirmée", plural: "Confirmées", tone: "paid", icon: IconCheck },
    },
    transport: {
      pending: { label: "En attente", plural: "En attente", tone: "pending", icon: IconClock },
      in_transit: { label: "En transit", plural: "En transit", tone: "delivered", icon: IconTruck },
      delivered: { label: "Livré", plural: "Livrés", tone: "paid", icon: IconCheck },
      cancelled: { label: "Annulé", plural: "Annulés", tone: "cancelled", icon: IconX },
    },
  };

  export function statusMeta(kind: StatusKind, status: string | null | undefined): Meta {
    return KIND_META[kind][status ?? "pending"] ?? { label: status ?? "", plural: status ?? "", tone: "closed", icon: IconLock };
  }

  /** Statuts encore modifiables : le badge devient un bouton. */
  export const EDITABLE_STATUSES: SaleStatus[] = ["pending", "paid", "delivered"];
</script>

<script lang="ts">
  export let status: string | null | undefined;
  export let kind: StatusKind = "sale";
  /** Affiche un chevron et rend le badge cliquable (changement de statut). */
  export let interactive = false;
  export let expanded: boolean | undefined = undefined;
  export let el: HTMLElement | null = null;

  $: meta = statusMeta(kind, status);
  $: icon = meta.icon;
</script>

{#if interactive}
  <button
    bind:this={el}
    type="button"
    class="badge badge--{meta.tone} badge--button"
    aria-haspopup="menu"
    aria-expanded={expanded}
    aria-label="Statut : {meta.label}. Changer le statut"
    on:click
    on:keydown
  >
    <svelte:component this={icon} size={14} strokeWidth={1.75} aria-hidden="true" />
    {meta.label}
    <IconChevronDown size={14} strokeWidth={1.75} aria-hidden="true" />
  </button>
{:else}
  <span class="badge badge--{meta.tone}">
    <svelte:component this={icon} size={14} strokeWidth={1.75} aria-hidden="true" />
    {meta.label}
  </span>
{/if}

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    padding: 0 10px;
    border-radius: var(--r-pill);
    border: 1px solid transparent;
    font: inherit;
    font-size: 12px;
    font-weight: 500;
    line-height: 1;
    white-space: nowrap;
  }

  .badge--button {
    cursor: pointer;
  }

  .badge--button:hover {
    filter: brightness(0.96);
    border-color: currentColor;
  }

  .badge--pending {
    background: var(--st-pending-bg);
    color: var(--st-pending-fg);
  }

  .badge--paid {
    background: var(--st-paid-bg);
    color: var(--st-paid-fg);
  }

  .badge--delivered {
    background: var(--st-delivered-bg);
    color: var(--st-delivered-fg);
  }

  .badge--closed {
    background: var(--st-closed-bg);
    color: var(--st-closed-fg);
  }

  .badge--cancelled {
    background: var(--st-cancelled-bg);
    color: var(--st-cancelled-fg);
  }

  .badge--pending.badge--button {
    border-color: #e7cf8f;
  }

  .badge--paid.badge--button {
    border-color: #b8d3ad;
  }

  .badge--delivered.badge--button {
    border-color: #b3c9dc;
  }

  @media (max-width: 767px) {
    .badge--button {
      height: 32px;
    }
  }
</style>
