<script lang="ts">
  import { styleByKey, swatchStyle, wineRobe, type WineStyleKey } from "$lib/wine";

  /**
   * Pastille de 10 px à la couleur de la robe : d'après le type de vin, ou une clé (filtres, légendes).
   * Toujours accompagnée du nom du vin à côté : elle est décorative (aria-hidden).
   */
  export let type: { name?: string | null } | null | undefined = null;
  export let robe: WineStyleKey | null = null;
  export let size = 10;

  $: style = robe ? styleByKey(robe) : wineRobe(type);
</script>

<span class="dot" style="--size: {size}px; {swatchStyle(style)}" aria-hidden="true"></span>

<style>
  .dot {
    display: inline-block;
    flex-shrink: 0;
    width: var(--size);
    height: var(--size);
    border-radius: 50%;
  }
</style>
