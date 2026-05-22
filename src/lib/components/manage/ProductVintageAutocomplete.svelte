<script lang="ts">
  import { createEventDispatcher, onMount, tick } from "svelte";

  const DROPDOWN_Z = 1100;
  const DROPDOWN_MAX_H = 224;
  const GAP = 2;

  /** Rend le menu dans document.body pour éviter le clipping des modales (overflow). */
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }

  export let value = "";
  export let wineVintages: any[] = [];
  export let tastingValue = "__tasting__";
  export let placeholder = "Rechercher un produit…";
  export let getAvailableStock: (vintageId: string) => number = () => 0;
  export let isVintageAlreadyAdded: (vintageId: string) => boolean = () => false;
  export let formatLabel: (vintage: any, availableStock: number) => string = (
    _v,
    _s,
  ) => "";
  /** Option « Dégustation » (lignes de vente sans millésime). */
  export let includeTastingOption = true;
  /** Désactiver les millésimes sans stock disponible. */
  export let disableWhenNoStock = true;

  const dispatch = createEventDispatcher<{ change: void }>();

  let query = "";
  let open = false;
  let prevValue = "";
  let inputEl: HTMLInputElement | undefined;
  let dropdownStyle = "";
  let listId = `product-ac-${Math.random().toString(36).slice(2, 9)}`;

  type ProductOption = {
    id: string;
    label: string;
    /** Texte utilisé pour la recherche (vignoble, nom, année uniquement). */
    searchText: string;
    disabled: boolean;
  };

  function foldAccents(s: string): string {
    return s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function vintageSearchText(vintage: any): string {
    const w = vintage?.wine;
    if (!w) return "";
    const winery = (w.winery?.name || "").trim();
    const name = (w.name?.trim() || w.appelation?.name?.trim() || "").trim();
    const year =
      vintage.year != null && vintage.year !== ""
        ? String(vintage.year)
        : String(vintage.production_year ?? "");
    return foldAccents(`${winery} ${name} ${year}`);
  }

  $: allOptions = buildOptions();
  $: filteredOptions = filterOptions(allOptions, query);
  $: selectedOption = value
    ? allOptions.find((o) => o.id === value) ?? null
    : null;

  $: {
    if (!value && prevValue) {
      query = "";
    }
    prevValue = value;
  }

  $: if (open) {
    tick().then(updateDropdownPosition);
  }

  function updateDropdownPosition() {
    if (!inputEl || !open) return;
    const rect = inputEl.getBoundingClientRect();
    const left = rect.left;
    const width = rect.width;
    const spaceBelow = window.innerHeight - rect.bottom - GAP;
    const spaceAbove = rect.top - GAP;
    const openUp = spaceBelow < 140 && spaceAbove > spaceBelow;

    if (openUp) {
      const maxHeight = Math.min(DROPDOWN_MAX_H, spaceAbove);
      dropdownStyle = `position:fixed;z-index:${DROPDOWN_Z};left:${left}px;width:${width}px;bottom:${window.innerHeight - rect.top + GAP}px;max-height:${maxHeight}px;`;
    } else {
      const maxHeight = Math.min(DROPDOWN_MAX_H, spaceBelow);
      dropdownStyle = `position:fixed;z-index:${DROPDOWN_Z};left:${left}px;width:${width}px;top:${rect.bottom + GAP}px;max-height:${maxHeight}px;`;
    }
  }

  onMount(() => {
    const reposition = () => {
      if (open) updateDropdownPosition();
    };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  });

  function buildOptions(): ProductOption[] {
    const wines: ProductOption[] = wineVintages.map((vintage) => {
      const stock = getAvailableStock(vintage.id);
      const noStock = disableWhenNoStock && stock === 0;
      return {
        id: vintage.id,
        label: formatLabel(vintage, stock),
        searchText: vintageSearchText(vintage),
        disabled: noStock || isVintageAlreadyAdded(vintage.id),
      };
    });
    if (!includeTastingOption) return wines;
    const tasting: ProductOption = {
      id: tastingValue,
      label: "Dégustation",
      searchText: foldAccents("Dégustation"),
      disabled: false,
    };
    return [tasting, ...wines];
  }

  function filterOptions(options: ProductOption[], q: string): ProductOption[] {
    const tokens = foldAccents(q.trim())
      .split(/\s+/)
      .filter(Boolean);
    if (tokens.length === 0) return options;
    return options.filter((o) =>
      tokens.every((t) => o.searchText.includes(t)),
    );
  }

  function selectOption(opt: ProductOption) {
    if (opt.disabled) return;
    value = opt.id;
    query = opt.label;
    open = false;
    dispatch("change");
  }

  function onInput() {
    open = true;
    if (value && selectedOption && query !== selectedOption.label) {
      value = "";
    }
    tick().then(updateDropdownPosition);
  }

  function onFocus() {
    open = true;
    tick().then(updateDropdownPosition);
  }

  function onBlur() {
    setTimeout(() => {
      open = false;
      if (selectedOption) {
        query = selectedOption.label;
      } else if (!value) {
        query = "";
      }
    }, 150);
  }

  function onKeydown(ev: KeyboardEvent) {
    if (ev.key === "Escape") {
      open = false;
      if (selectedOption) {
        query = selectedOption.label;
      }
    }
  }
</script>

<div class="product-autocomplete">
  <input
    type="text"
    class="product-autocomplete-input"
    role="combobox"
    aria-expanded={open}
    aria-controls={listId}
    aria-autocomplete="list"
    {placeholder}
    bind:this={inputEl}
    bind:value={query}
    on:input={onInput}
    on:focus={onFocus}
    on:blur={onBlur}
    on:keydown={onKeydown}
  />
  {#if open && filteredOptions.length > 0}
    <ul
      id={listId}
      class="product-autocomplete-dropdown product-autocomplete-list"
      style={dropdownStyle}
      role="listbox"
      use:portal
    >
      {#each filteredOptions as opt (opt.id)}
        <li role="presentation">
          <button
            type="button"
            role="option"
            aria-selected={value === opt.id}
            class:disabled={opt.disabled}
            disabled={opt.disabled}
            on:mousedown|preventDefault={() => selectOption(opt)}
          >
            {opt.label}
          </button>
        </li>
      {/each}
    </ul>
  {:else if open && query.trim() && filteredOptions.length === 0}
    <div
      class="product-autocomplete-dropdown product-autocomplete-empty"
      style={dropdownStyle}
      use:portal
    >
      Aucun produit trouvé
    </div>
  {/if}
</div>

<style>
  .product-autocomplete {
    position: relative;
    flex: 1;
    min-width: 200px;
  }

  .product-autocomplete-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 0.9rem;
    box-sizing: border-box;
  }

  .product-autocomplete-input:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.15);
  }

  .product-autocomplete-dropdown {
    margin: 0;
    overflow-y: auto;
    background: white;
    border: 1px solid #ced4da;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    box-sizing: border-box;
  }

  .product-autocomplete-list {
    padding: 0.25rem 0;
    list-style: none;
  }

  .product-autocomplete-list button {
    display: block;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: none;
    background: none;
    text-align: left;
    font-size: 0.875rem;
    cursor: pointer;
    color: #212529;
  }

  .product-autocomplete-list button:not(:disabled):hover,
  .product-autocomplete-list button:not(:disabled):focus {
    background: #f1f3f5;
  }

  .product-autocomplete-list button.disabled,
  .product-autocomplete-list button:disabled {
    color: #adb5bd;
    cursor: not-allowed;
  }

  .product-autocomplete-empty {
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    color: #666;
  }
</style>
