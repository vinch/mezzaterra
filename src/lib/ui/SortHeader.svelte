<script lang="ts" module>
  export type SortDir = "asc" | "desc";
  export type SortState<K extends string = string> = { key: K; dir: SortDir };

  /** Compare deux valeurs dans le sens du tri ; une valeur absente (null) reste en fin de liste dans les deux sens. */
  export function compareValues(a: string | number | null | undefined, b: string | number | null | undefined, dir: SortDir): number {
    if (a == null || b == null) return Number(a == null) - Number(b == null);
    const c = typeof a === "string" || typeof b === "string" ? String(a).localeCompare(String(b), "fr") : a - b;
    return dir === "asc" ? c : -c;
  }
</script>

<script lang="ts" generics="K extends string">
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

  function toggle() {
    sort = { key: column, dir: active ? (sort.dir === "asc" ? "desc" : "asc") : firstDir };
  }
</script>

<th scope="col" class:num aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
  <button type="button" class="ui-sort" class:on={active} onclick={toggle}>
    {label}
    {#if !active}
      <IconArrowUpDown size={14} strokeWidth={1.75} aria-hidden="true" />
    {:else if sort.dir === "asc"}
      <IconArrowUp size={14} strokeWidth={1.75} aria-hidden="true" />
    {:else}
      <IconArrowDown size={14} strokeWidth={1.75} aria-hidden="true" />
    {/if}
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
