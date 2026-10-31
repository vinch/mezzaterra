<script lang="ts" generics="T extends string">
  /** Onglets d'une page (snippet `tabs` de `ManagePageShell`) : filtre la liste affichée, avec un compte par onglet. */
  interface Props {
    items: { key: T; label: string; count?: number }[];
    value: T;
    /** Ce que filtrent les onglets (lecteurs d'écran) : « Filtrer par statut ». */
    label: string;
  }

  let { items, value = $bindable(), label }: Props = $props();
</script>

<div class="tabs" role="tablist" aria-label={label}>
  {#each items as t (t.key)}
    <button type="button" role="tab" class="tab" aria-selected={value === t.key} onclick={() => (value = t.key)}>
      {t.label}
      {#if t.count != null}<span class="tab-count">{t.count}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .tabs {
    display: flex;
    gap: 4px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .tab {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 44px;
    padding: 0 12px;
    border: none;
    background: none;
    color: var(--ink-2);
    font: inherit;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
  }

  .tab[aria-selected="true"] {
    color: var(--ink);
    font-weight: 600;
  }

  .tab[aria-selected="true"]::after {
    content: "";
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: -1px;
    height: 2px;
    background: var(--teal-600);
    border-radius: 2px;
  }

  .tab-count {
    min-width: 22px;
    padding: 1px 6px;
    border-radius: var(--r-pill);
    background: var(--table-head);
    font-size: 12px;
    font-weight: 500;
    color: var(--ink-2);
    text-align: center;
  }

  /* Mobile : puces défilant horizontalement. */
  @media (max-width: 767px) {
    .tabs {
      gap: 8px;
      padding: 12px 0;
    }

    .tab {
      padding: 0 14px;
      border: 1px solid var(--btn-border);
      border-radius: var(--r-pill);
      background: #fff;
      color: var(--ink);
    }

    .tab[aria-selected="true"] {
      background: var(--night);
      border-color: var(--night);
      color: #fff;
    }

    .tab[aria-selected="true"]::after {
      display: none;
    }

    .tab[aria-selected="true"] .tab-count {
      background: rgba(255, 255, 255, 0.18);
      color: #fff;
    }
  }
</style>
