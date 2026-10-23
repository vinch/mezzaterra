<script lang="ts">
  import { styleByKey, type WineStyleKey } from "$lib/wine";

  /**
   * Pastille de 10 px à la couleur de la robe (clé de wineStyle).
   * Toujours accompagnée du nom du vin à côté : elle est décorative (aria-hidden).
   */
  export let robe: WineStyleKey = "other";
  export let size = 10;

  $: style = styleByKey(robe);
</script>

<span
  class="dot"
  style="--size: {size}px; background: {style.color};{style.ring ? ` box-shadow: inset 0 0 0 1px ${style.ring};` : ''}"
  aria-hidden="true"
></span>

<style>
  .dot {
    display: inline-block;
    flex-shrink: 0;
    width: var(--size);
    height: var(--size);
    border-radius: 50%;
  }
</style>
