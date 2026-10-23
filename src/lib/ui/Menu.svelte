<script lang="ts" context="module">
  export type MenuItem = {
    label: string;
    icon?: any;
    onSelect?: () => void;
    href?: string;
    /** Action destructive (rouge). « Supprimer… » toujours en dernier. */
    danger?: boolean;
    /** Trait de séparation avant l'élément. */
    separator?: boolean;
    disabled?: boolean;
  };
</script>

<script lang="ts">
  import { createEventDispatcher, onDestroy, tick } from "svelte";
  import { portal } from "./portal";

  /**
   * Menu déroulant accessible (role=menu), rendu dans <body> pour ne jamais être rogné.
   * Clavier : ↑ ↓ Début Fin pour naviguer, Entrée pour choisir, Échap ferme et rend le focus.
   */
  export let open = false;
  export let anchor: HTMLElement | null = null;
  export let items: MenuItem[] = [];
  export let label = "Actions";
  export let id = `menu-${Math.random().toString(36).slice(2, 9)}`;
  export let align: "end" | "start" = "end";

  const dispatch = createEventDispatcher<{ close: void }>();
  let menuEl: HTMLElement;
  let style = "";

  function position() {
    if (!anchor || !menuEl) return;
    const r = anchor.getBoundingClientRect();
    const m = menuEl.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const top = below < m.height + 12 && r.top > m.height + 12 ? r.top - m.height - 6 : r.bottom + 6;
    let left = align === "end" ? r.right - m.width : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - m.width - 8));
    style = `top:${top}px;left:${left}px;`;
  }

  function enabledItems(): HTMLElement[] {
    return menuEl ? Array.from(menuEl.querySelectorAll<HTMLElement>("[role=menuitem]:not([aria-disabled=true])")) : [];
  }

  async function onOpen() {
    await tick();
    position();
    enabledItems()[0]?.focus();
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("pointerdown", onOutside, true);
  }

  function cleanup() {
    window.removeEventListener("scroll", close, true);
    window.removeEventListener("resize", close);
    document.removeEventListener("pointerdown", onOutside, true);
  }

  $: if (open) void onOpen();
  $: if (!open) cleanup();
  onDestroy(cleanup);

  function close() {
    if (!open) return;
    open = false;
    dispatch("close");
  }

  function closeAndFocus() {
    close();
    anchor?.focus();
  }

  function onOutside(e: Event) {
    const t = e.target as Node;
    if (menuEl?.contains(t) || anchor?.contains(t)) return;
    close();
  }

  function onKeydown(e: KeyboardEvent) {
    const list = enabledItems();
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      list[(i + 1) % list.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      list[(i - 1 + list.length) % list.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      list[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      list[list.length - 1]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeAndFocus();
    } else if (e.key === "Tab") {
      close();
    }
  }

  function choose(item: MenuItem) {
    if (item.disabled) return;
    closeAndFocus();
    item.onSelect?.();
  }
</script>

{#if open}
  <div
    bind:this={menuEl}
    use:portal
    {id}
    class="menu"
    role="menu"
    aria-label={label}
    tabindex="-1"
    {style}
    on:keydown={onKeydown}
  >
    {#each items as item}
      {#if item.separator}<div class="sep" role="separator"></div>{/if}
      {#if item.href && !item.disabled}
        <a
          role="menuitem"
          tabindex="-1"
          class="item"
          class:danger={item.danger}
          href={item.href}
          on:click={() => close()}
        >
          {#if item.icon}<svelte:component this={item.icon} size={16} strokeWidth={1.75} aria-hidden="true" />{/if}
          <span>{item.label}</span>
        </a>
      {:else}
        <button
          type="button"
          role="menuitem"
          tabindex="-1"
          class="item"
          class:danger={item.danger}
          aria-disabled={item.disabled ? "true" : undefined}
          on:click={() => choose(item)}
        >
          {#if item.icon}<svelte:component this={item.icon} size={16} strokeWidth={1.75} aria-hidden="true" />{/if}
          <span>{item.label}</span>
        </button>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .menu {
    position: fixed;
    z-index: 2500;
    min-width: 220px;
    max-width: 320px;
    padding: 6px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    box-shadow: var(--shadow-pop);
    font-family: var(--font-sans);
    font-size: 14px;
  }

  .menu:focus {
    outline: none;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 36px;
    padding: 0 10px;
    border: none;
    border-radius: var(--r-sm);
    background: none;
    color: var(--ink);
    font: inherit;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
  }

  .item:hover,
  .item:focus {
    background: var(--mist);
    outline: none;
  }

  .item:focus-visible {
    outline: 2px solid var(--teal-600);
    outline-offset: -2px;
  }

  .item[aria-disabled="true"] {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .item.danger {
    color: var(--danger);
  }

  .item.danger:hover,
  .item.danger:focus {
    background: #fbefef;
  }

  .sep {
    height: 1px;
    margin: 6px 4px;
    background: var(--border-soft);
  }

  @media (max-width: 767px) {
    .item {
      min-height: 44px;
    }
  }
</style>
