<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import AbruzzoMap from "$lib/components/site/AbruzzoMap.svelte";
  import WineCard from "$lib/components/site/WineCard.svelte";
  import { combinedAvailability, fetchAvailability, firstAvailable, type AvailabilityOf } from "$lib/publicData";
  import { MAIN, project } from "$lib/geo/abruzzo";
  import {
    STYLE_ORDER,
    allWineStyles,
    groupFormats,
    wineStyle,
    wineTitle,
    wineryFlag,
    wineryMapEmbedUrl,
    wineryMapUrl,
    wineryPlace,
  } from "$lib/wine";
  import { DEFAULT_KIND, kindOf, PRODUCT_KIND_LIST, PRODUCT_KINDS, productHref } from "$lib/productKinds";

  let { data } = $props();

  let availability = $state<AvailabilityOf | null>(null);

  onMount(async () => {
    availability = await fetchAvailability();
  });

  let winery = $derived(data.winery);
  let place = $derived(wineryPlace(winery));
  let flag = $derived(wineryFlag(winery));
  let mapUrl = $derived(wineryMapUrl(winery));

  let vintages = $derived([...data.vintages].sort((a, b) => {
    const sa = STYLE_ORDER.indexOf(wineStyle(a.wine?.wine_type).key);
    const sb = STYLE_ORDER.indexOf(wineStyle(b.wine?.wine_type).key);
    if (sa !== sb) return sa - sb;
    const byTitle = wineTitle(a.wine).localeCompare(wineTitle(b.wine), "fr");
    if (byTitle) return byTitle;
    return (b.year ?? 0) - (a.year ?? 0);
  }));

  let cuveeCount = $derived(new Set(vintages.map((v) => v.wine_id)).size);
  let styles = $derived(allWineStyles().filter((s) => vintages.some((v) => wineStyle(v.wine?.wine_type).key === s.key)));
  /** Types de produit du domaine (vins, huiles…) avec leurs cépages ou variétés. */
  let kinds = $derived((() => {
    const grapesByKind = new Map<string, Set<string>>();
    for (const v of vintages) {
      const kind = kindOf(v.wine);
      if (!grapesByKind.has(kind)) grapesByKind.set(kind, new Set());
      for (const g of v.wine_vintage_grape || []) if (g.grape?.name) grapesByKind.get(kind)!.add(g.grape.name);
    }
    return PRODUCT_KIND_LIST.filter((k) => grapesByKind.has(k.key)).map((k) => ({
      ...k,
      grapes: [...grapesByKind.get(k.key)!].sort((a, b) => a.localeCompare(b, "fr")),
    }));
  })());
  let grapes = $derived(kinds.flatMap((k) => k.grapes));
  /* « vins », « huiles d’olive », « vins et huiles d’olive ». */
  let productsLabel = $derived((kinds.length ? kinds : [PRODUCT_KINDS[DEFAULT_KIND]]).map((k) => k.plural.toLowerCase()).join(" et "));

  /* La carte des Abruzzes ne couvre qu'un cadre ; au-delà, on se rabat sur OpenStreetMap. */
  function onMainMap(w: { latitude: number | null; longitude: number | null }): boolean {
    if (w.latitude == null || w.longitude == null) return false;
    const [x, y] = project(MAIN, w.longitude, w.latitude);
    return x >= 0 && x <= MAIN.width && y >= 0 && y <= MAIN.height;
  }

  let pins = $derived([winery, ...data.others].filter(onMainMap));
  let mapEmbed = $derived(onMainMap(winery) ? null : wineryMapEmbedUrl(winery));

  let ogDescription = $derived((
    winery.description?.trim() ||
    [place, cuveeCount ? `${cuveeCount} cuvée${cuveeCount > 1 ? "s" : ""} chez Mezzaterra` : "", grapes.join(", ")]
      .filter(Boolean)
      .join(" · ")
  ).slice(0, 280));
</script>

<svelte:head>
  <title>{winery.name} — Mezzaterra</title>
  <meta name="description" content={ogDescription} />
  <meta property="og:title" content="{winery.name} — Mezzaterra" />
  <meta property="og:description" content={ogDescription} />
  <meta property="og:url" content={$page.url.href} />
  <meta property="og:image" content="{$page.url.origin}/logo.png" />
</svelte:head>

<section class="hero">
  <div class="mz-container hero-grid" class:no-map={!onMainMap(winery) && !mapEmbed}>
    <div class="hero-text mz-rise">
      <a href="/vins" class="back">← Toute la cave</a>
      <h1 class="mz-display mz-h1">{winery.name}</h1>
      {#if place}
        <p class="place">{flag} {place}</p>
      {/if}

      {#if winery.description?.trim()}
        <p class="description">{winery.description.trim()}</p>
      {/if}

      {#if vintages.length}
        <dl class="facts">
          <div>
            <dt>Cuvées</dt>
            <dd>{cuveeCount}</dd>
          </div>
          {#if styles.length}
            <div>
              <dt>Couleurs</dt>
              <dd class="styles">
                {#each styles as s}
                  <span><span class="mz-dot" style="background: {s.color}"></span>{s.label}</span>
                {/each}
              </dd>
            </div>
          {/if}
          {#each kinds.filter((k) => k.grapes.length) as k (k.key)}
            <div class="grapes">
              <dt>{k.ingredients}</dt>
              <dd>{k.grapes.join(", ")}</dd>
            </div>
          {/each}
        </dl>
      {/if}

      {#if winery.url || mapUrl}
        <div class="links">
          {#if winery.url}
            <a class="mz-btn" href={winery.url} target="_blank" rel="noopener noreferrer">Site du domaine ↗</a>
          {/if}
          {#if mapUrl}
            <a class="mz-btn mz-btn--ghost" href={mapUrl} target="_blank" rel="noopener noreferrer">Ouvrir la carte</a>
          {/if}
        </div>
      {/if}
    </div>

    {#if onMainMap(winery)}
      <div class="hero-map mz-rise" style="animation-delay: 120ms">
        <AbruzzoMap wineries={pins} current={winery.id} />
      </div>
    {:else if mapEmbed}
      <div class="hero-map mz-rise" style="animation-delay: 120ms">
        <iframe class="osm" title="Carte du domaine {winery.name}" src={mapEmbed} loading="lazy"></iframe>
      </div>
    {/if}
  </div>
</section>

<section class="mz-container mz-section">
  <h2 class="section-title mz-display mz-h2">Les {productsLabel} du domaine</h2>
  {#if vintages.length}
    <div class="grid">
      {#each groupFormats(vintages) as { vintage: v, formats } (v.id)}
        <div>
          <WineCard
            vintage={v}
            {formats}
            href={productHref(firstAvailable(availability, formats))}
            availability={combinedAvailability(availability, formats)}
          />
        </div>
      {/each}
    </div>
  {:else}
    <p class="mz-empty">Aucun produit de ce domaine n’est encore à la cave.</p>
  {/if}
</section>

{#if data.others.length}
  <section class="mz-container others">
    <h2 class="section-title mz-display mz-h2">Les autres domaines</h2>
    <ul class="others-list">
      {#each data.others as other (other.id)}
        <li>
          <a class="mz-card other" href="/domaines/{other.id}">
            <span class="other-name">{other.name}</span>
            {#if other.city}<span class="mz-muted">{other.city}</span>{/if}
            <span class="arrow" aria-hidden="true">→</span>
          </a>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .hero {
    padding: 2.5rem 0 3rem;
    border-bottom: 1px solid var(--mz-line-soft);
  }

  .hero-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
    gap: 3rem;
    align-items: center;
  }

  .hero-grid.no-map {
    grid-template-columns: minmax(0, 46rem);
  }

  .hero-text {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .back {
    color: var(--mz-muted);
    text-decoration: none;
    font-size: 0.9rem;
    width: fit-content;
    margin-bottom: 0.5rem;
  }

  .back:hover {
    color: var(--mz-teal);
  }

  .hero-text h1 {
    margin: 0;
  }

  .place {
    margin: 0;
    font-size: 1.1rem;
    color: var(--mz-ink-soft);
  }

  .description {
    margin: 0.75rem 0 0;
    font-size: 1.05rem;
    line-height: 1.65;
    white-space: pre-line;
  }

  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 1.25rem 2rem;
    margin: 1rem 0 0.5rem;
    padding: 1rem 0;
    border-top: 1px solid var(--mz-line-soft);
    border-bottom: 1px solid var(--mz-line-soft);
  }

  .facts div {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .facts .grapes {
    flex-basis: 100%;
  }

  .facts dt {
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--mz-muted);
  }

  .facts dd {
    margin: 0;
    color: var(--mz-ink);
  }

  .facts div:first-child dd {
    font-family: var(--mz-font-display);
    font-size: 1.5rem;
    line-height: 1.2;
  }

  .styles {
    display: flex;
    flex-wrap: wrap;
    gap: 0.9rem;
    padding-top: 0.35rem;
  }

  .styles > span {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    margin-top: 0.75rem;
  }

  .osm {
    width: 100%;
    aspect-ratio: 4 / 3;
    border: none;
    border-radius: var(--mz-radius-sm);
    filter: saturate(0.7) sepia(0.15);
  }

  .section-title {
    margin: 0 0 1.25rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
    gap: 1.25rem;
  }

  .grid > div {
    display: grid;
  }

  .others {
    padding-bottom: 4rem;
  }

  .others-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
    gap: 1rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .other {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.15rem 1rem;
    align-items: center;
    padding: 1.1rem 1.3rem;
    text-decoration: none;
    color: inherit;
    transition:
      border-color 0.15s ease,
      transform 0.15s ease;
  }

  .other:hover {
    border-color: var(--mz-teal);
    transform: translateY(-2px);
  }

  .other-name {
    font-family: var(--mz-font-display);
    font-size: 1.3rem;
    color: var(--mz-teal);
  }

  .other .mz-muted {
    grid-column: 1;
    font-size: 0.9rem;
  }

  .arrow {
    grid-column: 2;
    grid-row: 1 / span 2;
    color: var(--mz-teal);
    font-size: 1.2rem;
  }

  @media (max-width: 820px) {
    .hero-grid {
      grid-template-columns: 1fr;
      gap: 2rem;
    }
  }
</style>
