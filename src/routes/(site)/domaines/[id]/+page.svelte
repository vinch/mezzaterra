<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import AbruzzoMap from "$lib/components/site/AbruzzoMap.svelte";
  import ProductCard from "$lib/components/site/ProductCard.svelte";
  import WineryLinkCard from "$lib/components/site/WineryLinkCard.svelte";
  import { combinedAvailability, fetchAvailability, firstAvailable, type AvailabilityOf } from "$lib/publicData";
  import { MAIN, project } from "$lib/geo/abruzzo";
  import {
    compareProducts,
    groupFormats,
    presentStyles,
    wineryFlag,
    wineryInstagram,
    wineryMapEmbedUrl,
    wineryMapUrl,
    wineryPlace,
  } from "$lib/wine";
  import { IconInstagram, IconMapPin } from "$lib/ui/icons";
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
  let instagram = $derived(wineryInstagram(winery));

  let vintages = $derived([...data.vintages].sort(compareProducts));

  let cuveeCount = $derived(new Set(vintages.map((v) => v.wine_id)).size);
  let styles = $derived(presentStyles(vintages));
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
      <a href="/vins" class="mz-back">← Toute la cave</a>
      <h1 class="mz-display mz-h1">{winery.name}</h1>
      {#if place}
        <p class="place">{flag} {place}</p>
      {/if}

      {#if winery.description?.trim()}
        <p class="description">{winery.description.trim()}</p>
      {/if}

      {#if vintages.length}
        <dl class="mz-facts mz-facts--ruled">
          <div>
            <dt>Cuvées</dt>
            <dd>{cuveeCount}</dd>
          </div>
          {#if styles.length}
            <div>
              <dt>Couleurs</dt>
              <dd class="plain styles">
                {#each styles as s}
                  <span><span class="mz-dot" style="background: {s.color}"></span>{s.label}</span>
                {/each}
              </dd>
            </div>
          {/if}
          {#each kinds.filter((k) => k.grapes.length) as k (k.key)}
            <div class="grapes">
              <dt>{k.ingredients}</dt>
              <dd class="plain">{k.grapes.join(", ")}</dd>
            </div>
          {/each}
        </dl>
      {/if}

      {#if winery.url || instagram || mapUrl}
        <div class="links">
          {#if winery.url}
            <a class="mz-btn" href={winery.url} target="_blank" rel="noopener noreferrer">Site du domaine ↗</a>
          {/if}
          {#if instagram}
            <a
              class="mz-btn mz-btn--ghost mz-btn--icon"
              href={instagram.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram {instagram.handle} (nouvel onglet)"
              title="Instagram {instagram.handle}"
            >
              <IconInstagram aria-hidden="true" />
            </a>
          {/if}
          {#if mapUrl}
            <a
              class="mz-btn mz-btn--ghost mz-btn--icon"
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Ouvrir la carte (nouvel onglet)"
              title="Ouvrir la carte"
            >
              <IconMapPin strokeWidth={1.8} aria-hidden="true" />
            </a>
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
    <div class="mz-product-grid">
      {#each groupFormats(vintages) as { vintage: v, formats } (v.id)}
        <div>
          <ProductCard
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
        <li><WineryLinkCard id={other.id} name={other.name} detail={other.city ?? ""} /></li>
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

  .mz-back {
    margin-bottom: 0.5rem;
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

  .mz-facts > div {
    gap: 0.2rem;
  }

  .grapes {
    flex-basis: 100%;
  }

  .mz-facts dd:not(.plain) {
    line-height: 1.2;
  }

  /* Couleurs et cépages : en texte courant, pas en police d'affichage. */
  .plain {
    font: inherit;
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
    align-items: center;
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

  @media (max-width: 820px) {
    .hero-grid {
      grid-template-columns: 1fr;
      gap: 2rem;
    }
  }
</style>
