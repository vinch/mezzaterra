<script lang="ts" module>
  export type ComboOption = {
    id: string;
    /** Texte affiché dans le champ une fois l'option choisie. */
    label: string;
    /** Texte de recherche (sans accents, en minuscules). */
    searchText: string;
    disabled?: boolean;
    [key: string]: any;
  };

</script>

<script lang="ts">
  import { preventDefault } from "$lib/ui/events";
  import { onMount, tick, type Snippet } from "svelte";
  import { IconSearch } from "./icons";
  import { portal } from "./portal";
  import { fold } from "$lib/format";

  /**
   * Autocomplétion accessible (role=combobox) : taper, ↑ ↓ puis Entrée pour choisir, Échap ferme.
   * La liste est rendue dans <body> (jamais rognée par une modale). Rendu riche via le snippet `option`.
   */
  interface Props {
    onchange?: () => void;
    value?: string;
    options?: ComboOption[];
    id?: any;
    placeholder?: string;
    emptyText?: string;
    describedby?: string | undefined;
    invalid?: boolean;
    maxResults?: number;
    option?: Snippet<[any]>;
  }

  let {
    value = $bindable(""),
    options = [],
    id = `combo-${Math.random().toString(36).slice(2, 9)}`,
    placeholder = "Rechercher…",
    emptyText = "Aucun résultat",
    describedby = undefined,
    invalid = false,
    maxResults = 60,
    option,
    onchange
  }: Props = $props();

  const listId = `${id}-list`;

  let query = $state("");
  let open = $state(false);
  let active = $state(-1);
  let inputEl = $state<HTMLInputElement | undefined>();
  let listStyle = $state("");
  let prevValue = value;

  let selected = $derived(value ? options.find((o) => o.id === value) ?? null : null);
  let tokens = $derived(fold(query.trim()).split(/\s+/).filter(Boolean));
  let filtered = $derived((
    selected && query === selected.label
      ? options
      : tokens.length
        ? options.filter((o) => tokens.every((t) => o.searchText.includes(t)))
        : options
  ).slice(0, maxResults));

  /* Valeur remise à zéro de l'extérieur → on vide le champ ; valeur choisie → on affiche son libellé. */
  $effect.pre(() => {
    if (value !== prevValue) {
      prevValue = value;
      query = selected ? selected.label : "";
    }
  });
  $effect.pre(() => {
    if (selected && !open && query !== selected.label) query = selected.label;
  });

  function position() {
    if (!inputEl || !open) return;
    const r = inputEl.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 4;
    const up = below < 160 && r.top > below;
    const maxH = Math.min(280, up ? r.top - 8 : below - 4);
    listStyle = up
      ? `left:${r.left}px;width:${Math.max(r.width, 280)}px;bottom:${window.innerHeight - r.top + 4}px;max-height:${maxH}px;`
      : `left:${r.left}px;width:${Math.max(r.width, 280)}px;top:${r.bottom + 4}px;max-height:${maxH}px;`;
  }

  onMount(() => {
    const re = () => open && position();
    window.addEventListener("scroll", re, true);
    window.addEventListener("resize", re);
    return () => {
      window.removeEventListener("scroll", re, true);
      window.removeEventListener("resize", re);
    };
  });

  async function show() {
    open = true;
    await tick();
    position();
  }

  function choose(opt: ComboOption) {
    if (opt.disabled) return;
    value = opt.id;
    prevValue = value;
    query = opt.label;
    open = false;
    active = -1;
    onchange?.();
  }

  function move(delta: number) {
    if (!filtered.length) return;
    let i = active;
    for (let n = 0; n < filtered.length; n++) {
      i = (i + delta + filtered.length) % filtered.length;
      if (!filtered[i].disabled) break;
    }
    active = i;
    tick().then(() => document.getElementById(`${id}-opt-${active}`)?.scrollIntoView({ block: "nearest" }));
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) void show();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter") {
      if (open && active >= 0 && filtered[active]) {
        e.preventDefault();
        choose(filtered[active]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        open = false;
        if (selected) query = selected.label;
      }
    }
  }

  function onInput() {
    active = -1;
    if (value && selected && query !== selected.label) {
      value = "";
      prevValue = "";
      onchange?.();
    }
    void show();
  }

  function onBlur() {
    setTimeout(() => {
      /* Revenu dans le champ entre-temps : ne pas effacer la saisie en cours. */
      if (document.activeElement === inputEl) return;
      open = false;
      query = selected ? selected.label : value ? query : "";
    }, 120);
  }
</script>

<div class="combo">
  <span class="combo-icon" aria-hidden="true"><IconSearch size={16} strokeWidth={1.75} /></span>
  <input
    bind:this={inputEl}
    {id}
    type="text"
    class="ui-control"
    role="combobox"
    autocomplete="off"
    aria-autocomplete="list"
    aria-expanded={open}
    aria-controls={listId}
    aria-activedescendant={open && active >= 0 ? `${id}-opt-${active}` : undefined}
    aria-describedby={describedby}
    aria-invalid={invalid ? "true" : undefined}
    {placeholder}
    bind:value={query}
    oninput={onInput}
    onfocus={show}
    onclick={show}
    onblur={onBlur}
    onkeydown={onKeydown}
  />
</div>

{#if open}
  <ul id={listId} class="combo-list" role="listbox" style={listStyle} use:portal>
    {#if filtered.length === 0}
      <li class="combo-empty" role="presentation">{emptyText}</li>
    {/if}
    {#each filtered as opt, i (opt.id)}
      <li
        id="{id}-opt-{i}"
        role="option"
        aria-selected={value === opt.id}
        aria-disabled={opt.disabled ? "true" : undefined}
        class="combo-opt"
        class:active={i === active}
        class:disabled={opt.disabled}
        onmousedown={preventDefault(() => choose(opt))}
        onmouseenter={() => (active = i)}
      >
        {#if option}{@render option({ option: opt })}{:else}{opt.label}{/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .combo {
    position: relative;
    min-width: 0;
    flex: 1;
  }

  .combo-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    color: var(--ink-2);
    pointer-events: none;
  }

  .combo input {
    padding-left: 36px;
  }

  .combo-list {
    position: fixed;
    z-index: 2600;
    margin: 0;
    padding: 6px;
    list-style: none;
    overflow-y: auto;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    box-shadow: var(--shadow-pop);
    font-family: var(--font-sans);
    font-size: 14px;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }

  .combo-opt {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 40px;
    padding: 6px 10px;
    border-radius: var(--r-sm);
    cursor: pointer;
  }

  .combo-opt.active {
    background: var(--mist);
  }

  .combo-opt[aria-selected="true"] {
    font-weight: 600;
  }

  .combo-opt.disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .combo-empty {
    padding: 10px;
    color: var(--ink-2);
  }
</style>
