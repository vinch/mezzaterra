<script lang="ts">
  import { onMount } from "svelte";
  import { flip } from "svelte/animate";
  import { fade } from "svelte/transition";
  import { page } from "$app/stores";
  import WineCard from "$lib/components/site/WineCard.svelte";
  import { combinedAvailability, fetchAvailability, firstAvailable, type AvailabilityOf } from "$lib/publicData";
  import { fold } from "$lib/format";
  import { kindCount, PRODUCT_KINDS, productHref } from "$lib/productKinds";
  import {
    STYLE_ORDER,
    allWineStyles,
    groupFormats,
    type FormatGroup,
    wineStyle,
    vintageVolume,
    wineTitle,
    wineryFlag,
    wineryPlace,
    type WineStyleKey,
  } from "$lib/wine";

  let { data } = $props();

  let availability = $state<AvailabilityOf | null>(null);
  /* /vins et /huiles partagent ce composant : les filtres repartent de zéro au changement de catalogue. */
  let styleFilter = $derived.by<WineStyleKey | "">(() => (data.kind, ""));
  let inStockOnly = $derived.by(() => (data.kind, false));
  let query = $derived.by(() => (data.kind, ""));

  onMount(async () => {
    availability = await fetchAvailability();
  });

  let kind = $derived(PRODUCT_KINDS[data.kind]);
  let vintages = $derived(data.vintages as any[]);
  let presentStyles = $derived(allWineStyles().filter((s) =>
    vintages.some((v) => wineStyle(v.wine?.wine_type).key === s.key),
  ));

  let filtered = $derived(vintages
    .filter((v) => !styleFilter || wineStyle(v.wine?.wine_type).key === styleFilter)
    .filter((v) => !inStockOnly || !availability || availability(v.id).in_stock)
    .filter((v) => {
      if (!query.trim()) return true;
      const blob = fold(
        [
          wineTitle(v.wine),
          v.wine?.appelation?.name,
          v.wine?.winery?.name,
          v.year,
          vintageVolume(v),
          ...(v.wine_vintage_grape || []).map((g: any) => g.grape?.name),
        ]
          .filter(Boolean)
          .join(" "),
      );
      return fold(query)
        .split(/\s+/)
        .every((w) => blob.includes(w));
    })
    .sort((a, b) => {
      const sa = STYLE_ORDER.indexOf(wineStyle(a.wine?.wine_type).key);
      const sb = STYLE_ORDER.indexOf(wineStyle(b.wine?.wine_type).key);
      if (sa !== sb) return sa - sb;
      return wineTitle(a.wine).localeCompare(wineTitle(b.wine), "fr");
    }));

  type WineryGroup = { winery: any; items: FormatGroup<any>[] };

  /* Regroupement par domaine, une carte par produit et par année (ses contenants dedans). */
  function groupByWinery(list: any[]): WineryGroup[] {
    const acc = new Map<string, WineryGroup>();
    for (const v of groupFormats(list)) {
      const w = v.vintage.wine?.winery;
      const key = w?.id || "autres";
      if (!acc.has(key)) acc.set(key, { winery: w, items: [] });
      acc.get(key)!.items.push(v);
    }
    return [...acc.values()].sort((a, b) =>
      (a.winery?.name || "").localeCompare(b.winery?.name || "", "fr"),
    );
  }

  let groups = $derived(groupByWinery(filtered));
  /* Tous les domaines de la cave, indépendamment des filtres. */
  let wineries = $derived(groupByWinery(vintages).filter((g) => g.winery?.id));
</script>

<svelte:head>
  <title>{kind.catalogTitle} — Mezzaterra</title>
  <meta property="og:title" content="{kind.catalogTitle} — Mezzaterra" />
  <meta property="og:description" content={kind.catalogShare} />
  <meta property="og:url" content={$page.url.href} />
</svelte:head>

<section class="intro">
  <div class="mz-container mz-rise">
    <h1 class="mz-display mz-h1">{kind.catalogTitle}</h1>
    <p class="mz-lead">{kind.catalogLead}</p>
    {#if wineries.length}
      <nav class="wineries" aria-label="Les domaines">
        {#each wineries as g (g.winery.id)}
          <a class="mz-card winery-card" href="/domaines/{g.winery.id}">
            <span class="winery-card-name">{g.winery.name}</span>
            <span class="mz-muted">
              {[g.winery.city, kindCount(kind, g.items.length)].filter(Boolean).join(" · ")}
            </span>
            <span class="arrow" aria-hidden="true">→</span>
          </a>
        {/each}
      </nav>
    {/if}
  </div>
</section>

<div class="mz-container">
  <div class="toolbar">
    <div class="chips" role="group" aria-label="Filtrer par couleur">
      <!-- Une seule couleur (les huiles) : rien à filtrer. -->
      {#if presentStyles.length > 1}
        <button type="button" class="filter-chip" class:on={!styleFilter} onclick={() => (styleFilter = "")}>Tous</button>
        {#each presentStyles as s}
          <button
            type="button"
            class="filter-chip"
            class:on={styleFilter === s.key}
            onclick={() => (styleFilter = styleFilter === s.key ? "" : s.key)}
            aria-pressed={styleFilter === s.key}
          >
            <span class="mz-dot" style="background: {s.color}"></span>{s.label}
          </button>
        {/each}
      {/if}
      {#if availability}
        <label class="filter-chip toggle" class:on={inStockOnly}>
          <input type="checkbox" bind:checked={inStockOnly} />
          Disponibles
        </label>
      {/if}
    </div>
    <input class="mz-input search" type="search" placeholder={kind.searchPlaceholder} bind:value={query} aria-label="Rechercher" />
  </div>

  {#if data.error}
    <p class="mz-empty">{data.error}</p>
  {:else if groups.length === 0}
    <p class="mz-empty">{vintages.length ? "Aucun produit ne correspond à ces critères." : "Bientôt à la cave."}</p>
  {:else}
    {#each groups as group (group.winery?.id || "autres")}
      <section class="winery" id={group.winery?.id ? `domaine-${group.winery.id}` : undefined} transition:fade={{ duration: 150 }}>
        <header class="winery-head">
          <div>
            <h2 class="mz-display mz-h2">
              {#if group.winery?.id}
                <a href="/domaines/{group.winery.id}">{group.winery.name}</a>
              {:else}
                Autres
              {/if}
            </h2>
            <p class="mz-muted">
              {wineryFlag(group.winery)}
              {wineryPlace(group.winery)}
            </p>
          </div>
          {#if group.winery?.id}
            <a class="mz-btn mz-btn--ghost mz-btn--sm" href="/domaines/{group.winery.id}">Découvrir le domaine →</a>
          {/if}
        </header>
        <div class="grid">
          {#each group.items as { vintage: v, formats } (v.id)}
            <div animate:flip={{ duration: 250 }}>
              <WineCard
                vintage={v}
                {formats}
                href={productHref(firstAvailable(availability, formats))}
                availability={combinedAvailability(availability, formats)}
              />
            </div>
          {/each}
        </div>
      </section>
    {/each}
  {/if}
</div>

<style>
  .intro {
    padding: 3rem 0 1.5rem;
  }

  .intro h1 {
    margin: 0 0 0.75rem;
  }

  .toolbar {
    position: sticky;
    /* 1px sous le header (au-dessus) pour ne laisser aucun jour entre les deux. */
    top: calc(var(--mz-header-h, 4.5rem) - 1px);
    z-index: 5;
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1rem;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 0;
  }

  /* Fond flouté façon header, prolongé sur toute la largeur de la fenêtre.
     Porté par un pseudo-élément : backdrop-filter ne s'applique qu'à la boîte
     de l'élément, pas à une box-shadow. */
  .toolbar::before {
    content: "";
    position: absolute;
    inset: 0 auto;
    left: 50%;
    width: 100vw;
    transform: translateX(-50%);
    z-index: -1;
    background: color-mix(in srgb, var(--mz-paper) 88%, transparent);
    backdrop-filter: saturate(1.2) blur(10px);
    -webkit-backdrop-filter: saturate(1.2) blur(10px);
    border-bottom: 1px solid var(--mz-line-soft);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.9rem;
    border-radius: 999px;
    border: 1px solid var(--mz-line);
    background: transparent;
    color: var(--mz-ink-soft);
    font: inherit;
    font-size: 0.88rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .filter-chip:hover {
    border-color: var(--mz-teal);
    color: var(--mz-teal);
  }

  .filter-chip.on {
    background: var(--mz-teal);
    border-color: var(--mz-teal);
    color: #fff;
  }

  .toggle input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .search {
    flex: 0 1 18rem;
    padding: 0.55rem 0.9rem;
    border-radius: 999px;
    font-size: 0.92rem;
  }

  .winery {
    padding: 2rem 0 1rem;
    scroll-margin-top: 9rem;
  }

  .winery-head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 1rem;
    margin-bottom: 1.25rem;
    border-bottom: 1px solid var(--mz-line-soft);
  }

  .winery-head p {
    margin: 0.35rem 0 0;
  }

  .winery-head h2 a {
    color: inherit;
    text-decoration: none;
  }

  .winery-head h2 a:hover {
    color: var(--mz-wine-red);
  }

  .wineries {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
    gap: 1rem;
    margin-top: 1.75rem;
  }

  .winery-card {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.15rem 1rem;
    align-items: center;
    padding: 1rem 1.25rem;
    text-decoration: none;
    color: inherit;
    transition:
      border-color 0.15s ease,
      transform 0.15s ease;
  }

  .winery-card:hover {
    border-color: var(--mz-teal);
    transform: translateY(-2px);
  }

  .winery-card-name {
    font-family: var(--mz-font-display);
    font-size: 1.3rem;
    color: var(--mz-teal);
  }

  .winery-card .mz-muted {
    grid-column: 1;
    font-size: 0.88rem;
  }

  .arrow {
    grid-column: 2;
    grid-row: 1 / span 2;
    color: var(--mz-teal);
    font-size: 1.2rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
    gap: 1.25rem;
  }

  .grid > div {
    display: grid;
  }

  @media (max-width: 720px) {
    .search {
      flex: 1 1 100%;
    }
  }
</style>
