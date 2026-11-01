<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import OrganicLogo from "$lib/components/site/OrganicLogo.svelte";
  import ProductBottle from "$lib/components/site/ProductBottle.svelte";
  import ProductAbout from "$lib/components/site/ProductAbout.svelte";
  import ProductCard from "$lib/components/site/ProductCard.svelte";
  import { contactHref } from "$lib/contact";
  import { fetchAvailability, type AvailabilityOf } from "$lib/publicData";
  import {
    findNote,
    varietiesText,
    styleLabel,
    formatsText,
    lotVolume,
    producerFlag,
    producerInstagram,
    producerPlace,
    productStyle,
    productSubtitle,
    productTitle,
  } from "$lib/products";
  import { formatEUR } from "$lib/format";
  import { formatVolume, kindInfo, productHref } from "$lib/productKinds";

  let { data } = $props();

  let v = $derived(data.lot);
  let product = $derived(v.product);
  let kind = $derived(kindInfo(product));
  let style = $derived(productStyle(product.product_type));
  let title = $derived(productTitle(product));
  let varieties = $derived(varietiesText(v.lot_variety, true));
  let producer = $derived(product.producer);
  let region = $derived(producerPlace(producer));
  let flag = $derived(producerFlag(producer));
  let instagram = $derived(producerInstagram(producer));
  let ogDescription = $derived([
    productSubtitle(product),
    producer?.name,
    v.year,
    varieties,
    findNote(v.note, "mouth") || findNote(v.note, "nose"),
  ]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 280));

  let availability = $state<AvailabilityOf | null>(null);
  let shareFeedback = $state("");

  onMount(async () => {
    availability = await fetchAvailability();
  });

  let stock = $derived(availability ? availability(v.id) : null);

  async function share() {
    const url = $page.url.href;
    const shareData = { title: `${title} — Mezzaterra`, text: ogDescription, url };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(url);
      shareFeedback = "Lien copié !";
    } catch {
      /* Partage annulé par l'utilisateur. */
    }
    setTimeout(() => (shareFeedback = ""), 2500);
  }

  let orderHref = $derived(contactHref("commande", [title, v.year, lotVolume(v)].filter(Boolean).join(" ")));
</script>

<svelte:head>
  <title>{title}{v.year ? ` ${v.year}` : ""} — Mezzaterra</title>
  <meta name="description" content={ogDescription} />
  <meta property="og:type" content="product" />
  <meta property="og:title" content="{title}{v.year ? ` ${v.year}` : ''} — Mezzaterra" />
  <meta property="og:description" content={ogDescription} />
  <meta property="og:url" content={$page.url.href} />
  {#if v.image_url}
    <meta property="og:image" content={v.image_url} />
  {:else}
    <meta property="og:image" content="{$page.url.origin}/logo.png" />
  {/if}
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<article style="--robe: {style.color}; --robe-light: {style.light};">
  <section class="hero">
    <div class="mz-container hero-grid">
      <div class="bottle-stage mz-rise">
        <ProductBottle src={v.image_url} alt={title} {style} height="min(28rem, 60vh)" />
      </div>
      <div class="hero-text mz-rise" style="animation-delay: 80ms">
        <a href="/{kind.slug}" class="mz-back">← {kind.catalogTitle}</a>
        <span class="mz-eyebrow">
          <span class="mz-dot" style="background: {style.color}"></span>
          {styleLabel(product.product_type)}
          {#if v.organic}<OrganicLogo height="1.3rem" />{/if}
        </span>
        <h1 class="mz-display mz-h1">{title}</h1>
        {#if productSubtitle(product)}
          <p class="appellation">{productSubtitle(product)}</p>
        {/if}
        {#if producer?.name}
          <p class="producer">
            {#if producer.id}<a href="/domaines/{producer.id}">{producer.name}</a>{:else}{producer.name}{/if}{region ? ` — ${flag} ${region}` : ""}
          </p>
        {/if}

        <dl class="mz-facts mz-facts--ruled">
          {#if v.year}<div><dt>{kind.yearFact}</dt><dd>{v.year}</dd></div>{/if}
          {#if v.abv}<div><dt>Alcool</dt><dd>{v.abv} % vol.</dd></div>{/if}
          {#if formatsText(data.formats)}<div><dt>Contenant</dt><dd>{formatVolume(v.volume_ml)}</dd></div>{/if}
          {#if v.price}<div><dt>Prix</dt><dd>{formatEUR(v.price)}</dd></div>{/if}
          {#if varieties}<div><dt>{kind.ingredients}</dt><dd class="mz-facts-text">{varieties}</dd></div>{/if}
          {#if stock}
            <div>
              <dt>Disponibilité</dt>
              <dd class="mz-facts-text stock" class:out={!stock.in_stock} class:low={stock.low_stock}>
                {!stock.in_stock ? "Épuisé" : stock.low_stock ? "Dernières bouteilles" : "En stock"}
              </dd>
            </div>
          {/if}
        </dl>

        {#if data.formats.length > 1}
          <nav class="formats" aria-label="Contenants">
            {#each data.formats as f (f.id)}
              <a
                class="mz-chip format"
                class:on={f.id === v.id}
                href="/{kind.slug}/{f.id}"
                aria-current={f.id === v.id ? "page" : undefined}
                data-sveltekit-noscroll
              >
                {formatVolume(f.volume_ml)}{f.price != null ? ` · ${formatEUR(f.price)}` : ""}
              </a>
            {/each}
          </nav>
        {/if}

        {#if data.siblings.length}
          <p class="mz-muted siblings">
            {kind.otherYears} :
            {#each data.siblings as s, i}
              <a class="mz-link" href="/{kind.slug}/{s.id}">{s.year ?? s.production_year}</a>{i < data.siblings.length - 1 ? ", " : ""}
            {/each}
          </p>
        {/if}

        <div class="actions">
          {#if !stock || stock.in_stock}
            <a class="mz-btn" href={orderHref}>Commander {kind.thisLabel}</a>
          {/if}
          <button type="button" class="mz-btn mz-btn--ghost" onclick={share}>Partager</button>
          {#if shareFeedback}<span class="share-feedback" role="status">{shareFeedback}</span>{/if}
        </div>
      </div>
    </div>
  </section>

  <ProductAbout lot={v} class="mz-container" />

  {#if data.fromProducer.length}
    <section class="mz-container mz-section">
      <div class="more-head">
        <h2 class="mz-display mz-h2">Du même domaine</h2>
        <div class="more-links">
          {#if producer?.id}
            <a class="mz-link" href="/domaines/{producer.id}">Découvrir {producer.name} →</a>
          {/if}
          {#if producer?.url}
            <a class="mz-link" href={producer.url} target="_blank" rel="noopener noreferrer">Site du domaine ↗</a>
          {/if}
          {#if instagram}
            <a class="mz-link" href={instagram.url} target="_blank" rel="noopener noreferrer">Instagram {instagram.handle} ↗</a>
          {/if}
        </div>
      </div>
      <div class="mz-product-grid">
        {#each data.fromProducer as other (other.id)}
          <div><ProductCard lot={other} href={productHref(other)} availability={availability?.(other.id) ?? null} /></div>
        {/each}
      </div>
    </section>
  {/if}
</article>

<style>
  .hero {
    padding: 2.5rem 0 3rem;
    background:
      radial-gradient(ellipse 45% 70% at 22% 85%, color-mix(in srgb, var(--robe-light) 45%, transparent), transparent 70%),
      var(--mz-paper);
    border-bottom: 1px solid var(--mz-line-soft);
  }

  .hero-grid {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.4fr);
    gap: 3rem;
    align-items: center;
  }

  .bottle-stage {
    display: flex;
    justify-content: center;
    align-items: flex-end;
    min-height: 18rem;
  }

  .hero-text {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .mz-back {
    margin-bottom: 0.5rem;
  }

  .appellation {
    margin: 0;
    font-size: 1.15rem;
    color: var(--mz-ink-soft);
  }

  .producer {
    margin: 0;
    font-weight: 600;
    color: var(--mz-ink-soft);
  }

  .producer a {
    color: inherit;
    text-decoration: underline;
    text-decoration-color: var(--mz-line);
    text-underline-offset: 3px;
  }

  .producer a:hover {
    color: var(--mz-teal);
    text-decoration-color: currentColor;
  }

  .stock {
    color: var(--mz-success);
  }

  .stock.low {
    color: var(--mz-warning);
  }

  .stock.out {
    color: var(--mz-danger);
  }

  .siblings {
    margin: 0;
  }

  .formats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .format {
    text-decoration: none;
    background: transparent;
    border: 1px solid var(--mz-line);
    color: var(--mz-ink-soft);
  }

  .format:hover,
  .format.on {
    border-color: var(--mz-teal);
    background: var(--mz-teal-wash);
    color: var(--mz-teal);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
    margin-top: 0.75rem;
  }

  .share-feedback {
    color: var(--mz-success);
    font-weight: 600;
    font-size: 0.9rem;
  }

  .more-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem 1rem;
    margin-bottom: 1.25rem;
  }

  .more-head h2 {
    margin: 0;
  }

  .more-links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.5rem;
  }

  @media (max-width: 820px) {
    .hero-grid {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }

    .bottle-stage {
      --bottle-h: 17rem;
      min-height: 0;
    }

  }
</style>
