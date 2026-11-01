<script lang="ts">
  import { onMount } from "svelte";
  import { flip } from "svelte/animate";
  import { fade } from "svelte/transition";
  import { page } from "$app/stores";
  import ProductCard from "$lib/components/site/ProductCard.svelte";
  import ProducerLinkCard from "$lib/components/site/ProducerLinkCard.svelte";
  import { combinedAvailability, fetchAvailability, firstAvailable, type AvailabilityOf } from "$lib/publicData";
  import { fold } from "$lib/format";
  import { kindCount, PRODUCT_KINDS, lotHref } from "$lib/productKinds";
  import {
    compareLotsByStyle,
    groupFormats,
    presentStyles,
    type FormatGroup,
    productStyle,
    lotVolume,
    productTitle,
    producerFlag,
    producerPlace,
  } from "$lib/products";
  import type { ProductStyleKey } from "$lib/productStyles";

  let { data } = $props();

  let availability = $state<AvailabilityOf | null>(null);
  /* /vins et /huiles partagent ce composant : les filtres repartent de zéro au changement de catalogue. */
  let styleFilter = $derived.by<ProductStyleKey | "">(() => (data.kind, ""));
  let inStockOnly = $derived.by(() => (data.kind, false));
  let query = $derived.by(() => (data.kind, ""));

  onMount(async () => {
    availability = await fetchAvailability();
  });

  let kind = $derived(PRODUCT_KINDS[data.kind]);
  /* Trié une fois : les filtres gardent l'ordre. */
  let lots = $derived([...(data.lots as any[])].sort(compareLotsByStyle));
  let styles = $derived(presentStyles(lots));

  let filtered = $derived(lots
    .filter((v) => !styleFilter || productStyle(v.product?.product_type).key === styleFilter)
    .filter((v) => !inStockOnly || !availability || availability(v.id).in_stock)
    .filter((v) => {
      if (!query.trim()) return true;
      const blob = fold(
        [
          productTitle(v.product),
          v.product?.appellation?.name,
          v.product?.producer?.name,
          v.year,
          lotVolume(v),
          ...(v.lot_variety || []).map((g: any) => g.variety?.name),
        ]
          .filter(Boolean)
          .join(" "),
      );
      return fold(query)
        .split(/\s+/)
        .every((w) => blob.includes(w));
    }));

  type ProducerGroup = { producer: any; items: FormatGroup<any>[] };

  /* Regroupement par domaine, une carte par produit et par année (ses contenants dedans). */
  function groupByProducer(list: any[]): ProducerGroup[] {
    const acc = new Map<string, ProducerGroup>();
    for (const v of groupFormats(list)) {
      const w = v.lot.product?.producer;
      const key = w?.id || "autres";
      if (!acc.has(key)) acc.set(key, { producer: w, items: [] });
      acc.get(key)!.items.push(v);
    }
    return [...acc.values()].sort((a, b) =>
      (a.producer?.name || "").localeCompare(b.producer?.name || "", "fr"),
    );
  }

  let groups = $derived(groupByProducer(filtered));
  /* Tous les domaines de la cave, indépendamment des filtres. */
  let producers = $derived(groupByProducer(lots).filter((g) => g.producer?.id));
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
    {#if producers.length}
      <nav class="producers" aria-label="Les domaines">
        {#each producers as g (g.producer.id)}
          <ProducerLinkCard
            id={g.producer.id}
            name={g.producer.name}
            detail={[g.producer.city, kindCount(kind, g.items.length)].filter(Boolean).join(" · ")}
          />
        {/each}
      </nav>
    {/if}
  </div>
</section>

<div class="mz-container">
  <div class="toolbar">
    <div class="chips" role="group" aria-label="Filtrer par couleur">
      <!-- Une seule couleur (les huiles) : rien à filtrer. -->
      {#if styles.length > 1}
        <button type="button" class="filter-chip" class:on={!styleFilter} onclick={() => (styleFilter = "")}>Tous</button>
        {#each styles as s}
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
    <p class="mz-empty">{lots.length ? "Aucun produit ne correspond à ces critères." : "Bientôt à la cave."}</p>
  {:else}
    {#each groups as group (group.producer?.id || "autres")}
      <section class="producer" id={group.producer?.id ? `domaine-${group.producer.id}` : undefined} transition:fade={{ duration: 150 }}>
        <header class="producer-head">
          <div>
            <h2 class="mz-display mz-h2">
              {#if group.producer?.id}
                <a href="/domaines/{group.producer.id}">{group.producer.name}</a>
              {:else}
                Autres
              {/if}
            </h2>
            <p class="mz-muted">
              {producerFlag(group.producer)}
              {producerPlace(group.producer)}
            </p>
          </div>
          {#if group.producer?.id}
            <a class="mz-btn mz-btn--ghost mz-btn--sm" href="/domaines/{group.producer.id}">Découvrir le domaine →</a>
          {/if}
        </header>
        <div class="mz-product-grid">
          {#each group.items as { lot: v, formats } (v.id)}
            <div animate:flip={{ duration: 250 }}>
              <ProductCard
                lot={v}
                {formats}
                href={lotHref(firstAvailable(availability, formats))}
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
    border-radius: var(--mz-radius-pill);
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
    color: var(--mz-on-brand);
  }

  .toggle input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .search {
    flex: 0 1 18rem;
    padding: 0.55rem 0.9rem;
    border-radius: var(--mz-radius-pill);
    font-size: 0.92rem;
  }

  .producer {
    padding: 2rem 0 1rem;
    scroll-margin-top: 9rem;
  }

  .producer-head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 1rem;
    margin-bottom: 1.25rem;
    border-bottom: 1px solid var(--mz-line-soft);
  }

  .producer-head p {
    margin: 0.35rem 0 0;
  }

  .producer-head h2 a {
    color: inherit;
    text-decoration: none;
  }

  .producer-head h2 a:hover {
    color: var(--mz-wine-red);
  }

  .producers {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
    gap: 1rem;
    margin-top: 1.75rem;
  }

  @media (max-width: 720px) {
    .search {
      flex: 1 1 100%;
    }
  }
</style>
