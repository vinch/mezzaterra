<script lang="ts">
  import PageHeader from "$lib/ui/PageHeader.svelte";

  /** Titre de la page (h1). */
  export let title: string;
  /** Ligne de contexte sous le titre. */
  export let subtitle = "";
  /** Lien de retour optionnel (fil d'Ariane). */
  export let back: { href: string; label: string } | null = null;
</script>

<div class="page-container">
  <PageHeader {title} {subtitle} {back} hasActions={!!$$slots.actions} hasTabs={!!$$slots.tabs}>
    <svelte:fragment slot="badge"><slot name="badge" /></svelte:fragment>
    <svelte:fragment slot="actions"><slot name="actions" /></svelte:fragment>
    <svelte:fragment slot="tabs"><slot name="tabs" /></svelte:fragment>
  </PageHeader>
  <div class="page-content">
    <slot />
  </div>
</div>
