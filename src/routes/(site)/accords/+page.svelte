<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import { flip } from "svelte/animate";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import WineCard from "$lib/components/site/WineCard.svelte";
  import { fetchAvailability, type Availability } from "$lib/publicData";
  import { STYLE_ORDER, wineStyle, wineTitle } from "$lib/wine";

  export let data;

  let availability: Map<string, Availability> | null = null;
  $: selectedId = $page.url.searchParams.get("plat") || "";

  onMount(async () => {
    availability = await fetchAvailability();
  });

  const GLYPHS: [RegExp, string][] = [
    [/fromage/i, "🧀"],
    [/poisson|fruits de mer|crustac/i, "🐟"],
    [/barbecue|grill/i, "🔥"],
    [/gibier/i, "🦌"],
    [/viande rouge|bœuf|boeuf/i, "🥩"],
    [/viande blanche|volaille|poulet/i, "🍗"],
    [/salaison|charcut/i, "🥓"],
    [/pâtes|pates|pasta/i, "🍝"],
    [/pizza/i, "🍕"],
    [/houmous|humus|légume|legume/i, "🥙"],
    [/dessert|chocolat/i, "🍫"],
    [/apéro|apero/i, "🫒"],
  ];

  function glyph(desc: string): string {
    return GLYPHS.find(([re]) => re.test(desc))?.[1] ?? "🍽️";
  }

  function pick(id: string) {
    const url = new URL($page.url);
    if (!id || id === selectedId) url.searchParams.delete("plat");
    else url.searchParams.set("plat", id);
    goto(url, { replaceState: true, noScroll: true, keepFocus: true });
  }

  /* Un seul millésime par vin : on préfère celui en stock, puis le plus récent. */
  function bestPerWine(vintages: any[]): any[] {
    const byWine = new Map<string, any>();
    for (const v of vintages) {
      const prev = byWine.get(v.wine_id);
      if (!prev) {
        byWine.set(v.wine_id, v);
        continue;
      }
      const sv = availability?.get(v.id)?.in_stock ? 1 : 0;
      const sp = availability?.get(prev.id)?.in_stock ? 1 : 0;
      if (sv > sp || (sv === sp && (v.year ?? 0) > (prev.year ?? 0))) byWine.set(v.wine_id, v);
    }
    return [...byWine.values()];
  }

  $: selected = data.pairings.find((p) => p.id === selectedId) ?? null;
  $: matches = selected
    ? bestPerWine(
        data.vintages.filter((v: any) =>
          (v.wine?.wine_pairing || []).some((wp: any) => wp.pairing_id === selected!.id),
        ),
      ).sort((a, b) => {
        const sa = availability?.get(a.id)?.in_stock === false ? 1 : 0;
        const sb = availability?.get(b.id)?.in_stock === false ? 1 : 0;
        if (sa !== sb) return sa - sb;
        const ka = STYLE_ORDER.indexOf(wineStyle(a.wine?.wine_type).key);
        const kb = STYLE_ORDER.indexOf(wineStyle(b.wine?.wine_type).key);
        if (ka !== kb) return ka - kb;
        return wineTitle(a.wine).localeCompare(wineTitle(b.wine), "fr");
      })
    : [];

  function countFor(id: string): number {
    return new Set(
      data.vintages
        .filter((v: any) => (v.wine?.wine_pairing || []).some((wp: any) => wp.pairing_id === id))
        .map((v: any) => v.wine_id),
    ).size;
  }
</script>

<svelte:head>
  <title>Accords mets & vins — Mezzaterra</title>
  <meta property="og:title" content="Qu’est-ce qu’on boit ce soir ? — Mezzaterra" />
  <meta property="og:description" content="Choisissez votre plat, on vous propose le vin des Abruzzes qui va avec." />
</svelte:head>

<section class="intro">
  <div class="mz-container mz-rise">
    <h1 class="mz-display mz-h1">Qu’est-ce qu’on boit ce soir ?</h1>
    <p class="mz-lead">Dites-nous ce qu’il y a dans l’assiette, on s’occupe du verre.</p>
  </div>
</section>

<div class="mz-container">
  <div class="dishes" role="radiogroup" aria-label="Choisissez un plat">
    {#each data.pairings as p, i}
      <button
        type="button"
        class="dish mz-rise"
        class:on={p.id === selectedId}
        style="animation-delay: {i * 40}ms"
        role="radio"
        aria-checked={p.id === selectedId}
        on:click={() => pick(p.id)}
      >
        <span class="glyph" aria-hidden="true">{glyph(p.description)}</span>
        <span class="dish-name">{p.description}</span>
        <span class="dish-count">{countFor(p.id)} vin{countFor(p.id) > 1 ? "s" : ""}</span>
      </button>
    {/each}
  </div>

  <section class="results" aria-live="polite">
    {#if selected}
      <h2 class="mz-display mz-h2" in:fade={{ duration: 200 }}>
        {glyph(selected.description)} Avec {selected.description.toLowerCase()}
      </h2>
      {#if matches.length}
        <div class="grid">
          {#each matches as v (v.id)}
            <div animate:flip={{ duration: 250 }} in:fade={{ duration: 200 }}>
              <WineCard vintage={v} href="/vins/{v.id}" availability={availability?.get(v.id) ?? null} />
            </div>
          {/each}
        </div>
      {:else}
        <p class="mz-empty">Pas encore d’accord pour ce plat… mais demandez-nous lors d’une dégustation !</p>
      {/if}
    {:else}
      <p class="hint">↑ Choisissez un plat pour découvrir nos suggestions.</p>
    {/if}
  </section>
</div>

<style>
  .intro {
    padding: 3rem 0 1.5rem;
  }

  .intro h1 {
    margin: 0 0 0.75rem;
  }

  .dishes {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
    gap: 0.75rem;
  }

  .dish {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    padding: 1.1rem 0.75rem 0.9rem;
    border-radius: var(--mz-radius);
    border: 1px solid var(--mz-line-soft);
    background: var(--mz-paper-raised);
    font: inherit;
    color: var(--mz-ink);
    cursor: pointer;
    transition:
      transform 0.2s var(--mz-ease),
      border-color 0.2s ease,
      background-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .dish:hover {
    transform: translateY(-2px);
    border-color: var(--mz-teal-soft);
  }

  .dish.on {
    background: var(--mz-teal);
    border-color: var(--mz-teal);
    color: #fff;
    box-shadow: 0 10px 24px -12px rgba(37, 97, 105, 0.8);
  }

  .glyph {
    font-size: 2rem;
    line-height: 1;
    transition: transform 0.3s var(--mz-ease);
  }

  .dish:hover .glyph,
  .dish.on .glyph {
    transform: scale(1.12) rotate(-6deg);
  }

  .dish-name {
    font-weight: 600;
    font-size: 0.92rem;
    text-align: center;
  }

  .dish-count {
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .results {
    padding: 2.5rem 0 1rem;
    min-height: 14rem;
  }

  .results h2 {
    margin-bottom: 1.25rem;
  }

  .hint {
    text-align: center;
    color: var(--mz-muted);
    font-style: italic;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
    gap: 1.25rem;
  }

  .grid > div {
    display: grid;
  }
</style>
