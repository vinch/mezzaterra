<script lang="ts">
  import Combobox, { type ComboOption } from "$lib/ui/Combobox.svelte";
  import { fold } from "$lib/format";
  import WineDot from "$lib/ui/WineDot.svelte";
  import { wineRobe } from "$lib/wine";
  import { formatEUR } from "$lib/format";

  interface Props {
    onchange?: () => void;
    value?: string;
    wineVintages?: any[];
    tastingValue?: string;
    placeholder?: string;
    getAvailableStock?: (vintageId: string) => number;
    isVintageAlreadyAdded?: (vintageId: string) => boolean;
    formatLabel?: (vintage: any, availableStock: number) => string;
    /** Option « Dégustation » (lignes de vente sans millésime). */
    includeTastingOption?: boolean;
    /** Désactiver les millésimes sans stock disponible. */
    disableWhenNoStock?: boolean;
  }

  let {
    value = $bindable(""),
    wineVintages = [],
    tastingValue = "__tasting__",
    placeholder = "Rechercher un produit…",
    getAvailableStock = () => 0,
    isVintageAlreadyAdded = () => false,
    formatLabel = (_v, _s) => "",
    includeTastingOption = true,
    disableWhenNoStock = true,
    onchange
  }: Props = $props();

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

  function buildOptions(list: any[]): ComboOption[] {
    const wines: ComboOption[] = list.map((v) => {
      const stock = getAvailableStock(v.id);
      return {
        id: v.id,
        label: formatLabel(v, stock) || `${wineName(v)} ${v.year ?? ""}`.trim(),
        searchText: vintageSearchText(v),
        disabled: (disableWhenNoStock && stock === 0) || isVintageAlreadyAdded(v.id),
        kind: "wine",
        robe: wineRobe(v.wine?.wine_type).key,
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
  let options = $derived(buildOptions(wineVintages));
</script>

<Combobox bind:value {options} {placeholder} emptyText="Aucun produit trouvé" {onchange}>
  {#snippet option({ option })}

      {#if option.kind === "tasting"}
        <span class="opt-main"><strong>Dégustation</strong><small>Ligne sans millésime (entrée, participation…)</small></span>
      {:else}
        <WineDot robe={option.robe} />
        <span class="opt-main">
          <strong>{option.name}</strong>
          <small>{option.winery}{option.added ? " · déjà ajouté" : ""}</small>
        </span>
        <span class="opt-stock" class:low={option.stock <= 3}>{option.stock} bt.</span>
        <span class="opt-price">{option.price != null ? formatEUR(option.price) : ""}</span>
      {/if}

  {/snippet}
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
