<script lang="ts">
  /** Titre affiché dans l’en-tête blanc (h1). */
  export let title: string;
</script>

<div class="page-container">
  <header class="page-header">
    <h1>{title}</h1>
    {#if $$slots.actions}
      <div class="page-header-actions">
        <slot name="actions" />
      </div>
    {/if}
  </header>
  <div class="page-content">
    <slot />
  </div>
</div>
