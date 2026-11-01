<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import AbruzzoMap from "$lib/components/site/AbruzzoMap.svelte";
  import ProductCard from "$lib/components/site/ProductCard.svelte";
  import ProducerLinkCard from "$lib/components/site/ProducerLinkCard.svelte";
  import { combinedAvailability, fetchAvailability, firstAvailable, type AvailabilityOf } from "$lib/publicData";
  import { MAIN, project } from "$lib/geo/abruzzo";
  import {
    compareProducts,
    groupFormats,
    presentStyles,
    producerFlag,
    producerInstagram,
    producerMapEmbedUrl,
    producerMapUrl,
    producerPlace,
  } from "$lib/products";
  import { IconInstagram, IconMapPin } from "$lib/ui/icons";
  import { DEFAULT_KIND, kindOf, PRODUCT_KIND_LIST, PRODUCT_KINDS, productHref } from "$lib/productKinds";

  let { data } = $props();

  let availability = $state<AvailabilityOf | null>(null);

  onMount(async () => {
    availability = await fetchAvailability();
  });

  let producer = $derived(data.producer);
  let place = $derived(producerPlace(producer));
  let flag = $derived(producerFlag(producer));
  let mapUrl = $derived(producerMapUrl(producer));
  let instagram = $derived(producerInstagram(producer));

  let lots = $derived([...data.lots].sort(compareProducts));

  let cuveeCount = $derived(new Set(lots.map((v) => v.product_id)).size);
  let styles = $derived(presentStyles(lots));
  /** Types de produit du domaine (vins, huiles…) avec leurs cépages ou variétés. */
  let kinds = $derived((() => {
    const varietiesByKind = new Map<string, Set<string>>();
    for (const v of lots) {
      const kind = kindOf(v.product);
      if (!varietiesByKind.has(kind)) varietiesByKind.set(kind, new Set());
      for (const g of v.lot_variety || []) if (g.variety?.name) varietiesByKind.get(kind)!.add(g.variety.name);
    }
    return PRODUCT_KIND_LIST.filter((k) => varietiesByKind.has(k.key)).map((k) => ({
      ...k,
      varieties: [...varietiesByKind.get(k.key)!].sort((a, b) => a.localeCompare(b, "fr")),
    }));
  })());
  let varieties = $derived(kinds.flatMap((k) => k.varieties));
  /* « vins », « huiles d’olive », « vins et huiles d’olive ». */
  let productsLabel = $derived((kinds.length ? kinds : [PRODUCT_KINDS[DEFAULT_KIND]]).map((k) => k.plural.toLowerCase()).join(" et "));

  /* La carte des Abruzzes ne couvre qu'un cadre ; au-delà, on se rabat sur OpenStreetMap. */
  function onMainMap(w: { latitude: number | null; longitude: number | null }): boolean {
    if (w.latitude == null || w.longitude == null) return false;
    const [x, y] = project(MAIN, w.longitude, w.latitude);
    return x >= 0 && x <= MAIN.width && y >= 0 && y <= MAIN.height;
  }

  let pins = $derived([producer, ...data.others].filter(onMainMap));
  let mapEmbed = $derived(onMainMap(producer) ? null : producerMapEmbedUrl(producer));

  let ogDescription = $derived((
    producer.description?.trim() ||
    [place, cuveeCount ? `${cuveeCount} cuvée${cuveeCount > 1 ? "s" : ""} chez Mezzaterra` : "", varieties.join(", ")]
      .filter(Boolean)
      .join(" · ")
  ).slice(0, 280));
</script>

<svelte:head>
  <title>{producer.name} — Mezzaterra</title>
  <meta name="description" content={ogDescription} />
  <meta property="og:title" content="{producer.name} — Mezzaterra" />
  <meta property="og:description" content={ogDescription} />
  <meta property="og:url" content={$page.url.href} />
  <meta property="og:image" content="{$page.url.origin}/logo.png" />
</svelte:head>

<section class="hero">
  <div class="mz-container hero-grid" class:no-map={!onMainMap(producer) && !mapEmbed}>
    <div class="hero-text mz-rise">
      <a href="/vins" class="mz-back">← Toute la cave</a>
      <h1 class="mz-display mz-h1">{producer.name}</h1>
      {#if place}
        <p class="place">{flag} {place}</p>
      {/if}

      {#if producer.description?.trim()}
        <p class="description">{producer.description.trim()}</p>
      {/if}

      {#if lots.length}
        <dl class="mz-facts mz-facts--ruled">
          <div>
            <dt>Cuvées</dt>
            <dd class="count">{cuveeCount}</dd>
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
          {#each kinds.filter((k) => k.varieties.length) as k (k.key)}
            <div class="varieties">
              <dt>{k.ingredients}</dt>
              <dd class="plain">{k.varieties.join(", ")}</dd>
            </div>
          {/each}
        </dl>
      {/if}

      {#if producer.url || instagram || mapUrl}
        <div class="links">
          {#if producer.url}
            <a class="mz-btn" href={producer.url} target="_blank" rel="noopener noreferrer">Site du domaine ↗</a>
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

    {#if onMainMap(producer)}
      <div class="hero-map mz-rise" style="animation-delay: 120ms">
        <AbruzzoMap producers={pins} current={producer.id} />
      </div>
    {:else if mapEmbed}
      <div class="hero-map mz-rise" style="animation-delay: 120ms">
        <iframe class="osm" title="Carte du domaine {producer.name}" src={mapEmbed} loading="lazy"></iframe>
      </div>
    {/if}
  </div>
</section>

<section class="mz-container mz-section">
  <h2 class="section-title mz-display mz-h2">Les {productsLabel} du domaine</h2>
  {#if lots.length}
    <div class="mz-product-grid">
      {#each groupFormats(lots) as { lot: v, formats } (v.id)}
        <div>
          <ProductCard
            lot={v}
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
        <li><ProducerLinkCard id={other.id} name={other.name} detail={other.city} /></li>
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

  .varieties {
    flex-basis: 100%;
  }

  .count {
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
