<script lang="ts">
  import { createEventDispatcher, onMount, tick } from "svelte";
  import type { Customer } from "$lib/types";
  import {
    customerDisplayLabel,
    sortCustomersByLabel,
  } from "$lib/customerDisplay";

  const DROPDOWN_Z = 1100;
  const DROPDOWN_MAX_H = 224;
  const GAP = 2;

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }

  export let value = "";
  export let customers: Customer[] = [];
  export let placeholder = "Rechercher un client…";
  export let isCustomerAlreadyAdded: (customerId: string) => boolean = () =>
    false;

  const dispatch = createEventDispatcher<{ change: void }>();

  let query = "";
  let open = false;
  let prevValue = "";
  let inputEl: HTMLInputElement | undefined;
  let dropdownStyle = "";
  let listId = `customer-ac-${Math.random().toString(36).slice(2, 9)}`;

  type CustomerOption = {
    id: string;
    label: string;
    searchText: string;
    disabled: boolean;
  };

  function foldAccents(s: string): string {
    return s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function customerSearchText(c: Customer): string {
    return foldAccents(
      `${c.first_name} ${c.last_name} ${c.company_name || ""} ${c.email || ""}`,
    );
  }

  $: allOptions = sortCustomersByLabel(customers).map((c) => ({
    id: c.id,
    label: customerDisplayLabel(c),
    searchText: customerSearchText(c),
    disabled: isCustomerAlreadyAdded(c.id),
  }));

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

  $: if (value && selectedOption && !open) {
    query = selectedOption.label;
  }

  $: if (open) {
    tick().then(updateDropdownPosition);
  }

  function filterOptions(options: CustomerOption[], q: string): CustomerOption[] {
    const tokens = foldAccents(q.trim())
      .split(/\s+/)
      .filter(Boolean);
    if (tokens.length === 0) return options;
    return options.filter((o) =>
      tokens.every((t) => o.searchText.includes(t)),
    );
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

  function selectOption(opt: CustomerOption) {
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

<div class="customer-autocomplete">
  <input
    type="text"
    class="customer-autocomplete-input"
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
      class="customer-autocomplete-dropdown customer-autocomplete-list"
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
      class="customer-autocomplete-dropdown customer-autocomplete-empty"
      style={dropdownStyle}
      use:portal
    >
      Aucun client trouvé
    </div>
  {/if}
</div>

<style>
  .customer-autocomplete {
    position: relative;
    flex: 1;
    min-width: 200px;
  }

  .customer-autocomplete-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 0.9rem;
    box-sizing: border-box;
  }

  .customer-autocomplete-input:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.15);
  }

  .customer-autocomplete-dropdown {
    margin: 0;
    overflow-y: auto;
    background: white;
    border: 1px solid #ced4da;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    box-sizing: border-box;
  }

  .customer-autocomplete-list {
    padding: 0.25rem 0;
    list-style: none;
  }

  .customer-autocomplete-list button {
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

  .customer-autocomplete-list button:not(:disabled):hover,
  .customer-autocomplete-list button:not(:disabled):focus {
    background: #f1f3f5;
  }

  .customer-autocomplete-list button.disabled,
  .customer-autocomplete-list button:disabled {
    color: #adb5bd;
    cursor: not-allowed;
  }

  .customer-autocomplete-empty {
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    color: #666;
  }
</style>
