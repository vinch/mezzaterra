<script lang="ts">
  import type { Snippet } from "svelte";
  /**
   * Tableau du design system : en-tête --table-head, lignes de 56 px, survol.
   * Défilement horizontal dans son conteneur si la place manque.
   * Contenu : <thead>/<tbody> passés en contenu ; classes utilitaires .num, .col-actions, .is-clickable.
   */
  interface Props {
    caption?: string;
    children?: Snippet;
  }

  let { caption = "", children }: Props = $props();
</script>

<div class="ui-table-wrap">
  <table class="ui-table">
    {#if caption}<caption class="sr-only">{caption}</caption>{/if}
    {@render children?.()}
  </table>
</div>
