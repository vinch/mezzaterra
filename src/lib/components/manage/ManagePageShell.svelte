<script lang="ts">
  import type { Snippet } from "svelte";
  import PageHeader from "$lib/ui/PageHeader.svelte";

  interface Props {
    /** Titre de la page (h1). */
    title: string;
    /** Ligne de contexte sous le titre. */
    subtitle?: string;
    /** Lien de retour optionnel (fil d'Ariane). */
    back?: { href: string; label: string } | null;
    actions?: Snippet;
    tabs?: Snippet;
    badge?: Snippet;
    children?: Snippet;
  }

  let { title, subtitle = "", back = null, actions, tabs, badge, children }: Props = $props();
</script>

<div class="page-container">
  <PageHeader {title} {subtitle} {back} {badge} {actions} {tabs} />
  <div class="page-content">
    {@render children?.()}
  </div>
</div>
