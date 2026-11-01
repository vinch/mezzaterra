<script lang="ts">
  import { self } from "$lib/ui/events";
  import { tick, untrack } from "svelte";
  import { fade, scale } from "svelte/transition";
  import { goto } from "$app/navigation";
  import { fetchAllRows, supabase } from "$lib/supabase";
  import { customerDisplayLabel } from "$lib/customerDisplay";
  import { LOT_LABEL_SELECT, lotLabel } from "$lib/products";
  import { fold, formatDate, formatEUR } from "$lib/format";
  import { IconClipboard, IconGlasses, IconReceipt, IconSearch, IconUsers } from "$lib/ui/icons";
  import { KIND_ICONS } from "$lib/ui/kindIcons";
  import { kindOf } from "$lib/productKinds";
  import Spinner from "$lib/ui/Spinner.svelte";

  interface Props {
    /** Pages de l'admin, injectées par le layout (même source que la sidebar). */
    pages?: { href: string; label: string; icon: any }[];
    open?: boolean;
  }

  let { pages = [], open = $bindable(false) }: Props = $props();

  type Item = {
    id: string;
    group: string;
    label: string;
    hint?: string;
    href: string;
    icon: any;
    haystack: string;
  };

  let query = $state("");
  let input = $state<HTMLInputElement | undefined>();
  let active = $state(0);
  let loaded = false;
  let loadingData = $state(false);
  let dataItems = $state.raw<Item[]>([]);

  async function loadData() {
    if (loaded || loadingData) return;
    loadingData = true;
    let failed = false;
    /* Millésimes et clients lus en pages : au-delà de 1000, ils manqueraient à la recherche. */
    const [lots, customers, sales, orders, tastings] = await Promise.all([
      fetchAllRows<any>((from, to) =>
        supabase
          .from("lot")
          .select(`id, product_id, ${LOT_LABEL_SELECT}`)
          .order("id")
          .range(from, to),
      ).catch(() => {
        failed = true;
        return [];
      }),
      fetchAllRows<any>((from, to) =>
        supabase.from("customer").select("id, first_name, last_name, company_name, email, city").order("id").range(from, to),
      ).catch(() => {
        failed = true;
        return [];
      }),
      supabase
        .from("sale")
        .select("id, date, total_price, invoice_number, status, customer ( first_name, last_name, company_name )")
        .order("date", { ascending: false })
        .limit(200),
      supabase
        .from("order")
        .select("id, date, total_price, supplier ( name )")
        .order("date", { ascending: false })
        .limit(100),
      supabase.from("tasting").select("id, name, date, location").order("date", { ascending: false }),
    ]);

    const items: Item[] = [];
    for (const v of lots) {
      const label = lotLabel(v);
      items.push({
        id: `v-${v.id}`,
        group: "Produits",
        label,
        hint: "Stock",
        href: `/manage/products/${v.product_id}/stock/${v.id}`,
        icon: KIND_ICONS[kindOf(v.product)].product,
        haystack: fold(label),
      });
    }
    for (const c of customers) {
      const label = customerDisplayLabel(c);
      items.push({
        id: `c-${c.id}`,
        group: "Clients",
        label,
        hint: [c.email, c.city].filter(Boolean).join(" · "),
        href: `/manage/customers/${c.id}`,
        icon: IconUsers,
        haystack: fold(`${label} ${c.email || ""} ${c.city || ""}`),
      });
    }
    for (const s of (sales.data || []) as any[]) {
      const who = s.customer ? customerDisplayLabel(s.customer) : "—";
      items.push({
        id: `s-${s.id}`,
        group: "Ventes",
        label: `${s.invoice_number ? `${s.invoice_number} — ` : ""}${who}`,
        hint: `${formatDate(s.date)} · ${formatEUR(s.total_price)}`,
        href: `/manage/sales`,
        icon: IconReceipt,
        haystack: fold(`${s.invoice_number || ""} ${who} ${s.date}`),
      });
    }
    for (const o of (orders.data || []) as any[]) {
      items.push({
        id: `o-${o.id}`,
        group: "Commandes",
        label: `${o.supplier?.name || "Fournisseur"} — ${formatDate(o.date)}`,
        hint: formatEUR(o.total_price),
        href: `/manage/orders`,
        icon: IconClipboard,
        haystack: fold(`${o.supplier?.name || ""} ${o.date} commande`),
      });
    }
    for (const t of (tastings.data || []) as any[]) {
      const label = t.name || `Dégustation du ${formatDate(t.date)}`;
      items.push({
        id: `t-${t.id}`,
        group: "Dégustations",
        label,
        hint: [formatDate(t.date), t.location].filter(Boolean).join(" · "),
        href: `/manage/tastings/${t.id}/live`,
        icon: IconGlasses,
        haystack: fold(`${label} ${t.location || ""} ${t.date}`),
      });
    }

    dataItems = items;
    /* Lecture en échec : relancée à la prochaine ouverture plutôt que manquante toute la session. */
    loaded = !failed;
    loadingData = false;
  }

  async function onOpen() {
    query = "";
    active = 0;
    void loadData();
    await tick();
    input?.focus();
  }

  function close() {
    open = false;
  }

  function choose(item: Item | undefined) {
    if (!item) return;
    close();
    void goto(item.href);
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      active = (active + 1) % Math.max(1, results.length);
      scrollActive();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      active = (active - 1 + results.length) % Math.max(1, results.length);
      scrollActive();
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape") {
      close();
    }
  }

  async function scrollActive() {
    await tick();
    document.querySelector(".palette .row.active")?.scrollIntoView({ block: "nearest" });
  }

  function onGlobalKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      open = !open;
    }
  }
  let pageItems = $derived(pages.map<Item>((p) => ({
    id: `p-${p.href}`,
    group: "Pages",
    label: p.label,
    href: p.href,
    icon: p.icon,
    haystack: fold(p.label),
  })));
  let results = $derived((() => {
    const q = fold(query.trim());
    if (!q) return pageItems.slice(0, 8);
    const words = q.split(/\s+/);
    const scored = [...pageItems, ...dataItems]
      .filter((it) => words.every((w) => it.haystack.includes(w)))
      .map((it) => ({ it, score: it.haystack.startsWith(words[0]) ? 0 : 1 }))
      .sort((a, b) => a.score - b.score);
    return scored.slice(0, 40).map((s) => s.it);
  })());
  $effect.pre(() => {
    if (results) active = Math.min(active, Math.max(0, results.length - 1));
  });
  let grouped = $derived(results.reduce<{ group: string; items: { item: Item; index: number }[] }[]>((acc, item, index) => {
    const last = acc[acc.length - 1];
    if (last && last.group === item.group) last.items.push({ item, index });
    else acc.push({ group: item.group, items: [{ item, index }] });
    return acc;
  }, []));
  /* Seule l'ouverture déclenche onOpen (pas ce qu'il lit ensuite). */
  $effect.pre(() => {
    if (open) untrack(() => void onOpen());
  });
</script>

<svelte:window onkeydown={onGlobalKey} />

{#if open}
  <div class="palette-backdrop" onclick={self(() => close())} role="presentation" transition:fade={{ duration: 120 }}>
    <div class="palette" role="dialog" aria-modal="true" aria-label="Recherche" transition:scale={{ start: 0.97, duration: 140 }}>
      <div class="search">
        <IconSearch size={20} strokeWidth={1.75} />
        <input
          bind:this={input}
          bind:value={query}
          onkeydown={onKeydown}
          placeholder="Rechercher un produit, un client, une vente, une page…"
          aria-label="Rechercher"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-results"
          aria-activedescendant={results[active] ? `pal-${results[active].id}` : undefined}
        />
        <kbd>Esc</kbd>
      </div>
      <div class="results" id="palette-results" role="listbox">
        {#if results.length === 0}
          {#if loadingData}<Spinner size={20} />{:else}<p class="empty">Aucun résultat</p>{/if}
        {:else}
          {#each grouped as g}
            <div class="group-label">{g.group}</div>
            {#each g.items as { item, index } (item.id)}
              <button
                type="button"
                id="pal-{item.id}"
                class="row"
                class:active={index === active}
                role="option"
                aria-selected={index === active}
                onmouseenter={() => (active = index)}
                onclick={() => choose(item)}
              >
                <item.icon size={18} strokeWidth={1.75} />
                <span class="label">{item.label}</span>
                {#if item.hint}<span class="hint">{item.hint}</span>{/if}
              </button>
            {/each}
          {/each}
        {/if}
      </div>
      <footer><span><kbd>↑</kbd><kbd>↓</kbd> naviguer</span><span><kbd>↵</kbd> ouvrir</span><span><kbd>⌘</kbd><kbd>K</kbd> ouvrir/fermer</span></footer>
    </div>
  </div>
{/if}

<style>
  .palette-backdrop {
    position: fixed;
    inset: 0;
    z-index: 3000;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 12vh 1rem 1rem;
    background: var(--overlay);
    backdrop-filter: blur(2px);
  }

  .palette {
    width: min(640px, 100%);
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    background: var(--card);
    border-radius: var(--r-md);
    box-shadow: var(--shadow-pop);
    overflow: hidden;
    font-family: var(--font-sans);
  }

  .search {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.9rem 1rem;
    border-bottom: 1px solid var(--border-soft);
    color: var(--mz-muted);
  }

  .search input {
    flex: 1;
    border: none;
    outline: none;
    background: none;
    font: inherit;
    font-size: 1.05rem;
    color: var(--ink);
  }

  kbd {
    display: inline-block;
    padding: 0.1rem 0.4rem;
    border-radius: var(--r-sm);
    border: 1px solid var(--border);
    background: var(--table-head);
    font-family: inherit;
    font-size: 0.72rem;
    color: var(--mz-muted);
  }

  .results {
    overflow-y: auto;
    padding: 0.4rem;
  }

  .group-label {
    padding: 0.6rem 0.65rem 0.25rem;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ink-2);
  }

  .row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.6rem 0.65rem;
    border: none;
    border-radius: var(--r-sm);
    background: none;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .row.active {
    background: var(--mist);
    color: var(--teal-700);
  }

  .label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
  }

  .hint {
    font-size: 0.8rem;
    color: var(--ink-2);
    white-space: nowrap;
  }

  .empty {
    padding: 1.5rem;
    text-align: center;
    color: var(--ink-2);
  }

  footer {
    display: flex;
    gap: 1rem;
    padding: 0.55rem 1rem;
    border-top: 1px solid var(--border-soft);
    font-size: 0.75rem;
    color: var(--ink-2);
  }

  footer kbd {
    margin-right: 0.15rem;
  }
</style>
