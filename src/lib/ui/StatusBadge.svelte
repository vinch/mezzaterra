<script lang="ts">
  import { statusMeta, type StatusKind } from "$lib/status";
  import { IconChevronDown } from "./icons";

  interface Props {
    onclick?: (e: MouseEvent) => void;
    onkeydown?: (e: KeyboardEvent) => void;
    status: string | null | undefined;
    kind?: StatusKind;
    /** Affiche un chevron et rend le badge cliquable (changement de statut). */
    interactive?: boolean;
    expanded?: boolean | undefined;
    el?: HTMLElement | null;
  }

  let {
    status,
    kind = "sale",
    interactive = false,
    expanded = undefined,
    el = $bindable(),
    onclick,
    onkeydown
  }: Props = $props();

  let meta = $derived(statusMeta(kind, status));
</script>

{#if interactive}
  <button
    bind:this={el}
    type="button"
    class="badge badge--{meta.tone} badge--button"
    aria-haspopup="menu"
    aria-expanded={expanded}
    aria-label="Statut : {meta.label}. Changer le statut"
    {onclick}
    {onkeydown}
  >
    <meta.icon size={14} strokeWidth={1.75} aria-hidden="true" />
    {meta.label}
    <IconChevronDown size={14} strokeWidth={1.75} aria-hidden="true" />
  </button>
{:else}
  <span class="badge badge--{meta.tone}">
    <meta.icon size={14} strokeWidth={1.75} aria-hidden="true" />
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
