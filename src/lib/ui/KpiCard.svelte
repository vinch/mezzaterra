<script lang="ts">
  /** Indicateur : libellé en haut, chiffre en Fraunces, une ligne de contexte, petite icône sur --mist. */
  export let label: string;
  export let value: string;
  export let icon: any = null;
  export let href: string | null = null;
</script>

<svelte:element this={href ? "a" : "div"} {href} class="kpi" class:link={!!href}>
  <div class="kpi-top">
    <span class="kpi-label">{label}</span>
    {#if icon}
      <span class="kpi-icon" aria-hidden="true"><svelte:component this={icon} size={16} strokeWidth={1.75} /></span>
    {/if}
  </div>
  <span class="t-figure">{value}</span>
  {#if $$slots.default}<div class="kpi-context"><slot /></div>{/if}
</svelte:element>

<style>
  .kpi {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 16px 20px 18px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: inherit !important;
    text-decoration: none;
    min-width: 0;
  }

  .kpi.link:hover {
    border-color: var(--teal-600);
  }

  .kpi-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .kpi-label {
    font-size: 13px;
    line-height: 18px;
    color: var(--ink-2);
  }

  .kpi-icon {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: var(--r-sm);
    background: var(--mist);
    color: var(--teal-600);
  }

  @media (max-width: 767px) {
    .kpi {
      padding: 12px 14px 14px;
    }

    .kpi :global(.t-figure) {
      font-size: 22px;
      line-height: 28px;
    }
  }

  .kpi-context {
    font-size: 12px;
    line-height: 16px;
    color: var(--ink-2);
  }
</style>
