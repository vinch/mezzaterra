<script lang="ts">
  import Combobox, { type ComboOption } from "$lib/ui/Combobox.svelte";
  import { fold } from "$lib/format";
  import StyleDot from "$lib/ui/StyleDot.svelte";
  import { lotShortLabel, lotVolume, wineRobe } from "$lib/products";
  import { formatEUR } from "$lib/format";

  interface Props {
    onchange?: () => void;
    value?: string;
    /** Id du champ, pour un <label for> (sinon généré). */
    id?: string;
    lots?: any[];
    tastingValue?: string;
    placeholder?: string;
    /**
     * Stock ajoutable d'un millésime (ventes) : affiché avec le prix de vente, option désactivée
     * sans stock (null : stock inconnu, « — »). Absent (commandes, dégustations) : ni stock ni prix.
     */
    getAvailableStock?: (lotId: string) => number | null;
    isLotAlreadyAdded?: (lotId: string) => boolean;
    formatLabel?: (lot: any, availableStock: number | null) => string;
    /** Option « Dégustation » (lignes de vente sans millésime). */
    includeTastingOption?: boolean;
  }

  let {
    value = $bindable(""),
    id = undefined,
    lots = [],
    tastingValue = "__tasting__",
    placeholder = "Rechercher un produit…",
    getAvailableStock,
    isLotAlreadyAdded = () => false,
    formatLabel = (_v, _s) => "",
    includeTastingOption = true,
    onchange
  }: Props = $props();

  function lotSearchText(v: any): string {
    const w = v?.product;
    if (!w) return "";
    const year = v.year != null && v.year !== "" ? String(v.year) : String(v.production_year ?? "");
    return fold(`${w.producer?.name || ""} ${w.name || w.appellation?.name || ""} ${year} ${lotVolume(v)}`);
  }

  /** « Riserva 2019 », « Olio 2025 · 5 L » ; un non-millésimé sans année (pas de confusion avec un millésime). */
  function optionName(v: any): string {
    return lotShortLabel({ ...v, production_year: null });
  }

  function buildOptions(list: any[]): ComboOption[] {
    const lotOptions: ComboOption[] = list.map((v) => {
      const stock = getAvailableStock ? getAvailableStock(v.id) : null;
      return {
        id: v.id,
        label: formatLabel(v, stock) || optionName(v),
        searchText: lotSearchText(v),
        disabled: (!!getAvailableStock && !stock) || isLotAlreadyAdded(v.id),
        kind: "product",
        robe: wineRobe(v.product?.product_type).key,
        name: optionName(v),
        producer: v.product?.producer?.name || "",
        stock,
        price: v.price,
        added: isLotAlreadyAdded(v.id),
      };
    });
    if (!includeTastingOption) return lotOptions;
    return [
      { id: tastingValue, label: "Dégustation", searchText: fold("Dégustation"), kind: "tasting" },
      ...lotOptions,
    ];
  }
  let options = $derived(buildOptions(lots));
</script>

<Combobox bind:value {id} {options} {placeholder} emptyText="Aucun produit trouvé" {onchange}>
  {#snippet option({ option })}
      {#if option.kind === "tasting"}
        <span class="opt-main"><strong>Dégustation</strong><small>Ligne sans produit (entrée, participation…)</small></span>
      {:else}
        <StyleDot robe={option.robe} />
        <span class="opt-main">
          <strong>{option.name}</strong>
          <small>{option.producer}{option.added ? " · déjà ajouté" : ""}</small>
        </span>
        {#if getAvailableStock}
          <span class="opt-stock" class:low={option.stock != null && option.stock <= 3}>{option.stock ?? "—"} bt.</span>
          <span class="opt-price">{option.price != null ? formatEUR(option.price) : ""}</span>
        {/if}
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
