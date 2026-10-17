<script lang="ts">
  /** Carte : fond --card, bordure 1 px, sans ombre. Titre en Fraunces 19/26, actions à droite. */
  export let title = "";
  export let subtitle = "";
  export let padded = true;
  export let id: string | undefined = undefined;
</script>

<section class="card" class:padded {id} aria-labelledby={title && id ? `${id}-title` : undefined}>
  {#if title || $$slots.actions}
    <header class="card-head">
      <div>
        {#if title}<h2 class="t-card-title" id={id ? `${id}-title` : undefined}>{title}</h2>{/if}
        {#if subtitle}<p class="t-caption sub">{subtitle}</p>{/if}
      </div>
      {#if $$slots.actions}<div class="card-actions"><slot name="actions" /></div>{/if}
    </header>
  {/if}
  <slot />
</section>

<style>
  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    min-width: 0;
  }

  .card.padded {
    padding: 20px 24px 24px;
  }

  .card-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  .card:not(.padded) .card-head {
    padding: 20px 24px 0;
  }

  .sub {
    margin: 2px 0 0;
  }

  .card-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  @media (max-width: 767px) {
    .card.padded {
      padding: 16px;
    }
  }
</style>
