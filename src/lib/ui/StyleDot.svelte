<script lang="ts">
  import { styleByKey, swatchStyle, wineRobe, type ProductStyleKey } from "$lib/products";

  /**
   * Pastille de 10 px à la couleur de la robe : d'après le type (`product_type`, avec `kind` pour une huile), ou une clé (filtres, légendes).
   * Toujours accompagnée du nom du produit à côté : elle est décorative (aria-hidden).
   */
  interface Props {
    type?: { name?: string | null; kind?: string | null } | null | undefined;
    robe?: ProductStyleKey | null;
    size?: number;
  }

  let { type = null, robe = null, size = 10 }: Props = $props();

  let style = $derived(robe ? styleByKey(robe) : wineRobe(type));
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
