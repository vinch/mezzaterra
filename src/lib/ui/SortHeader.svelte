<script lang="ts" generics="K extends string">
  import type { SortDir, SortState } from "$lib/sort";
  import { IconArrowDown, IconArrowUp, IconArrowUpDown } from "./icons";

  /**
   * En-tête de colonne triable d'un DataTable : clic pour trier sur la colonne, second clic pour
   * inverser le sens. `firstDir` : sens du premier clic (« desc » pour un stock, du plus grand au plus petit).
   * `also` : second tri dans la même colonne, quand la cellule a deux lignes (« Produit · Domaine ») ;
   * il partage `num` et `firstDir`, et `aria-pressed` indique lequel des deux trie.
   */
  interface Props {
    column: K;
    label: string;
    sort: SortState<K>;
    also?: { column: K; label: string };
    num?: boolean;
    firstDir?: SortDir;
  }

  let { column, label, sort = $bindable(), also, num = false, firstDir = "asc" }: Props = $props();

  let active = $derived(sort.key === column || sort.key === also?.column);

  function toggle(key: K) {
    sort = { key, dir: sort.key === key ? (sort.dir === "asc" ? "desc" : "asc") : firstDir };
  }
</script>

{#snippet sortButton(key: K, text: string)}
  {@const on = sort.key === key}
  {@const Icon = !on ? IconArrowUpDown : sort.dir === "asc" ? IconArrowUp : IconArrowDown}
  <button type="button" class="ui-sort" class:on aria-pressed={also ? on : undefined} onclick={() => toggle(key)}>
    {text}
    <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
  </button>
{/snippet}

<th scope="col" class:num aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
  {@render sortButton(column, label)}
  {#if also}<span class="ui-sort-sep" aria-hidden="true">·</span>{@render sortButton(also.column, also.label)}{/if}
</th>

<style>
  .ui-sort {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    vertical-align: middle;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
    color: inherit;
    cursor: pointer;
  }

  .ui-sort-sep {
    margin: 0 6px;
    vertical-align: middle;
  }

  /* Colonne chiffrée : flèche à gauche, le libellé reste aligné sur les nombres. */
  .num .ui-sort {
    flex-direction: row-reverse;
  }

  .ui-sort:hover,
  .ui-sort.on {
    color: var(--ink);
  }

  /* Flèche neutre discrète tant que la colonne n'est pas triée. */
  .ui-sort:not(.on) :global(svg) {
    opacity: 0.4;
  }

  .ui-sort:hover :global(svg) {
    opacity: 1;
  }
</style>
