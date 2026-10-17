<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import Combobox, { fold, type ComboOption } from "$lib/ui/Combobox.svelte";
  import WineDot, { robeOf } from "$lib/ui/WineDot.svelte";
  import { formatEUR } from "$lib/format";

  export let value = "";
  export let wineVintages: any[] = [];
  export let tastingValue = "__tasting__";
  export let placeholder = "Rechercher un produit…";
  export let getAvailableStock: (vintageId: string) => number = () => 0;
  export let isVintageAlreadyAdded: (vintageId: string) => boolean = () => false;
  export let formatLabel: (vintage: any, availableStock: number) => string = (_v, _s) => "";
  /** Option « Dégustation » (lignes de vente sans millésime). */
  export let includeTastingOption = true;
  /** Désactiver les millésimes sans stock disponible. */
  export let disableWhenNoStock = true;
  export let id: string | undefined = undefined;
  /** Afficher le stock dans les options (masqué quand il n'a pas de sens, ex. dégustations). */
  export let showStock = true;

  const dispatch = createEventDispatcher<{ change: void }>();

  function vintageSearchText(v: any): string {
    const w = v?.wine;
    if (!w) return "";
    const year = v.year != null && v.year !== "" ? String(v.year) : String(v.production_year ?? "");
    return fold(`${w.winery?.name || ""} ${w.name || w.appelation?.name || ""} ${year}`);
  }

  function wineName(v: any): string {
    const w = v?.wine;
    return (w?.name?.trim() || w?.appelation?.name?.trim() || "Vin").trim();
  }

  $: options = buildOptions(wineVintages);

  function buildOptions(list: any[]): ComboOption[] {
    const wines: ComboOption[] = list.map((v) => {
      const stock = getAvailableStock(v.id);
      return {
        id: v.id,
        label: formatLabel(v, stock) || `${wineName(v)} ${v.year ?? ""}`.trim(),
        searchText: vintageSearchText(v),
        disabled: (disableWhenNoStock && stock === 0) || isVintageAlreadyAdded(v.id),
        kind: "wine",
        robe: robeOf(v.wine?.wine_type),
        name: `${wineName(v)}${v.year ? ` ${v.year}` : ""}`,
        winery: v.wine?.winery?.name || "",
        stock,
        price: v.price,
        added: isVintageAlreadyAdded(v.id),
      };
    });
    if (!includeTastingOption) return wines;
    return [
      { id: tastingValue, label: "Dégustation", searchText: fold("Dégustation"), kind: "tasting" },
      ...wines,
    ];
  }
</script>

<Combobox bind:value {options} {placeholder} {id} emptyText="Aucun produit trouvé" on:change={() => dispatch("change")}>
  <svelte:fragment slot="option" let:option>
    {#if option.kind === "tasting"}
      <span class="opt-main"><strong>Dégustation</strong><small>Ligne sans millésime (entrée, participation…)</small></span>
    {:else}
      <WineDot robe={option.robe} />
      <span class="opt-main">
        <strong>{option.name}</strong>
        <small>{option.winery}{option.added ? " · déjà ajouté" : ""}</small>
      </span>
      {#if showStock}
        <span class="opt-stock" class:low={option.stock <= 3}>{option.stock} bt.</span>
      {/if}
      <span class="opt-price">{option.price != null ? formatEUR(option.price) : ""}</span>
    {/if}
  </svelte:fragment>
</Combobox>

<style>
  .opt-main {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    line-height: 18px;
  }

  .opt-main strong {
    font-weight: 600;
  }

  .opt-main small {
    font-size: 12px;
    color: var(--ink-2);
  }

  .opt-stock {
    font-size: 12px;
    color: var(--ink-2);
    white-space: nowrap;
  }

  .opt-stock.low {
    color: var(--warn);
    font-weight: 600;
  }

  .opt-price {
    min-width: 72px;
    text-align: right;
    white-space: nowrap;
  }
</style>
