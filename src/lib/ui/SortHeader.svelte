<script lang="ts" generics="K extends string">
  import type { SortDir, SortState } from "$lib/sort";
  import { IconArrowDown, IconArrowUp, IconArrowUpDown } from "./icons";

  /**
   * En-tête de colonne triable d'un DataTable : clic pour trier sur la colonne, second clic pour
   * inverser le sens. `firstDir` : sens du premier clic (« desc » pour un stock, du plus grand au plus petit).
   */
  interface Props {
    column: K;
    label: string;
    sort: SortState<K>;
    num?: boolean;
    firstDir?: SortDir;
  }

  let { column, label, sort = $bindable(), num = false, firstDir = "asc" }: Props = $props();

  let active = $derived(sort.key === column);
  let Icon = $derived(!active ? IconArrowUpDown : sort.dir === "asc" ? IconArrowUp : IconArrowDown);

  function toggle() {
    sort = { key: column, dir: active ? (sort.dir === "asc" ? "desc" : "asc") : firstDir };
  }
</script>

<th scope="col" class:num aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
  <button type="button" class="ui-sort" class:on={active} onclick={toggle}>
    {label}
    <Icon size={14} strokeWidth={1.75} aria-hidden="true" />
  </button>
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
