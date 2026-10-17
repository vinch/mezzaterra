<script lang="ts">
  /**
   * Tableau du design system : en-tête --table-head, lignes de 56 px, survol.
   * Défilement horizontal dans son conteneur si la place manque.
   * Contenu : <thead>/<tbody> passés en slot ; classes utilitaires .num, .col-actions, .is-clickable.
   */
  export let caption = "";
</script>

<div class="ui-table-wrap">
  <table class="ui-table">
    {#if caption}<caption class="sr-only">{caption}</caption>{/if}
    <slot />
  </table>
</div>
