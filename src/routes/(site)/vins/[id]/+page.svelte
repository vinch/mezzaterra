<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import WineBottle from "$lib/components/site/WineBottle.svelte";
  import WineCard from "$lib/components/site/WineCard.svelte";
  import { contactHref } from "$lib/contact";
  import { fetchAvailability, type Availability } from "$lib/publicData";
  import {
    NOTE_TYPES,
    findNote,
    formatEur,
    grapesText,
    wineStyle,
    wineSubtitle,
    wineTitle,
  } from "$lib/wine";

  export let data;

  $: v = data.vintage;
  $: wine = v?.wine;
  $: style = wineStyle(wine?.wine_type);
  $: title = wine ? wineTitle(wine) : "";
  $: grapes = grapesText(v?.wine_vintage_grape, true);
  $: notes = NOTE_TYPES.map((t) => ({ ...t, content: findNote(v?.note, t.key) })).filter((n) => n.content);
  $: pairings = (wine?.wine_pairing || []).map((wp: any) => wp.pairing).filter(Boolean);
  $: winery = wine?.winery;
  $: region = [winery?.city, winery?.region?.name].filter(Boolean).join(", ");
  $: flag = winery?.region?.country?.flag || winery?.country?.flag || "";
  $: ogDescription = [
    wineSubtitle(wine),
    winery?.name,
    v?.year,
    grapes,
    findNote(v?.note, "mouth") || findNote(v?.note, "nose"),
  ]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 280);

  let availability: Map<string, Availability> | null = null;
  let shareFeedback = "";

  onMount(async () => {
    availability = await fetchAvailability();
  });

  $: stock = v && availability ? availability.get(v.id) : null;

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

  $: orderHref = contactHref("commande", [title, v?.year].filter(Boolean).join(" "));
  $: hasAbout = Boolean(wine?.description || notes.length || pairings.length);
</script>

<svelte:head>
  {#if v}
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
  {:else}
    <title>Vin introuvable — Mezzaterra</title>
  {/if}
</svelte:head>

{#if !v}
  <div class="mz-container mz-section">
    <p class="mz-empty">Ce vin est introuvable. <a class="mz-link" href="/vins">Voir toute la cave</a></p>
  </div>
{:else}
  <article style="--robe: {style.color}; --robe-light: {style.light};">
    <section class="hero">
      <div class="mz-container hero-grid">
        <div class="bottle-stage mz-rise">
          <WineBottle src={v.image_url} alt={title} wine={style} height="min(28rem, 60vh)" />
        </div>
        <div class="hero-text mz-rise" style="animation-delay: 80ms">
          <a href="/vins" class="back">← Toute la cave</a>
          <span class="mz-eyebrow">
            <span class="mz-dot" style="background: {style.color}"></span>
            {style.label}{v.organic ? " · Bio" : ""}
          </span>
          <h1 class="mz-display mz-h1">{title}</h1>
          {#if wineSubtitle(wine)}
            <p class="appellation">{wineSubtitle(wine)}</p>
          {/if}
          {#if winery?.name}
            <p class="winery">
              {#if winery.id}<a href="/domaines/{winery.id}">{winery.name}</a>{:else}{winery.name}{/if}{region ? ` — ${flag} ${region}` : ""}
            </p>
          {/if}

          <dl class="facts">
            {#if v.year}<div><dt>Millésime</dt><dd>{v.year}</dd></div>{/if}
            {#if v.abv}<div><dt>Alcool</dt><dd>{v.abv} % vol.</dd></div>{/if}
            {#if v.price}<div><dt>Prix</dt><dd>{formatEur(v.price)}</dd></div>{/if}
            {#if grapes}<div><dt>Cépages</dt><dd class="small">{grapes}</dd></div>{/if}
            {#if stock}
              <div>
                <dt>Disponibilité</dt>
                <dd class="small stock" class:out={!stock.in_stock} class:low={stock.low_stock}>
                  {!stock.in_stock ? "Épuisé" : stock.low_stock ? "Dernières bouteilles" : "En stock"}
                </dd>
              </div>
            {/if}
          </dl>

          {#if data.siblings.length}
            <p class="mz-muted siblings">
              Autres millésimes :
              {#each data.siblings as s, i}
                <a class="mz-link" href="/vins/{s.id}">{s.year ?? s.production_year}</a>{i < data.siblings.length - 1 ? ", " : ""}
              {/each}
            </p>
          {/if}

          <div class="actions">
            {#if !stock || stock.in_stock}
              <a class="mz-btn" href={orderHref}>Commander ce vin</a>
            {/if}
            <button type="button" class="mz-btn mz-btn--ghost" on:click={share}>Partager</button>
            {#if shareFeedback}<span class="share-feedback" role="status">{shareFeedback}</span>{/if}
          </div>
        </div>
      </div>
    </section>

    {#if hasAbout}
      <section class="mz-container about">
        {#if wine.description}
          <div class="block">
            <h2>Le vin</h2>
            <p class="prose">{wine.description}</p>
          </div>
        {/if}

        {#if notes.length}
          <div class="block">
            <h2>Notes de dégustation</h2>
            <div class="notes">
              {#each notes as note}
                <div class="note">
                  <span class="note-label">{note.label}</span>
                  <p>{note.content}</p>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if pairings.length}
          <div class="block">
            <h2>À table avec</h2>
            <div class="pairings">
              {#each pairings as p}
                <span class="mz-chip">{p.description}</span>
              {/each}
            </div>
          </div>
        {/if}
      </section>
    {/if}

    {#if data.fromWinery.length}
      <section class="mz-container mz-section">
        <div class="more-head">
          <h2 class="mz-display mz-h2">Du même domaine</h2>
          <div class="more-links">
            {#if winery?.id}
              <a class="mz-link" href="/domaines/{winery.id}">Découvrir {winery.name} →</a>
            {/if}
            {#if winery?.url}
              <a class="mz-link" href={winery.url} target="_blank" rel="noopener noreferrer">Site du domaine ↗</a>
            {/if}
          </div>
        </div>
        <div class="grid">
          {#each data.fromWinery as other (other.id)}
            <div><WineCard vintage={other} href="/vins/{other.id}" availability={availability?.get(other.id) ?? null} /></div>
          {/each}
        </div>
      </section>
    {/if}
  </article>
{/if}

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

  .appellation {
    margin: 0;
    font-size: 1.15rem;
    color: var(--mz-ink-soft);
  }

  .winery {
    margin: 0;
    font-weight: 600;
    color: var(--mz-ink-soft);
  }

  .winery a {
    color: inherit;
    text-decoration: underline;
    text-decoration-color: var(--mz-line);
    text-underline-offset: 3px;
  }

  .winery a:hover {
    color: var(--mz-teal);
    text-decoration-color: currentColor;
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
    font-family: var(--mz-font-display);
    font-size: 1.5rem;
    color: var(--mz-ink);
  }

  /* Valeurs textuelles (cépages, disponibilité) : plus petites que les chiffres. */
  .facts dd.small {
    font-size: 1.15rem;
    line-height: 1.6;
  }

  .stock {
    color: var(--mz-success) !important;
  }

  .stock.low {
    color: var(--mz-warning) !important;
  }

  .stock.out {
    color: var(--mz-danger) !important;
  }

  .siblings {
    margin: 0;
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

  .about {
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
    padding-top: 3rem;
    padding-bottom: 1rem;
  }

  .block h2 {
    margin: 0 0 0.75rem;
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--mz-teal-soft);
  }

  .block p {
    margin: 0;
    line-height: 1.65;
  }

  .prose {
    max-width: 44rem;
    white-space: pre-line;
    font-size: 1.05rem;
  }

  .notes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr));
    gap: 1.25rem 2rem;
  }

  .note {
    padding-left: 1rem;
    border-left: 3px solid var(--robe);
  }

  .note-label {
    font-family: var(--mz-font-display);
    font-size: 1.25rem;
    color: var(--mz-teal);
  }

  .pairings {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
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

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
    gap: 1.25rem;
  }

  .grid > div {
    display: grid;
  }

  @media (max-width: 820px) {
    .hero-grid {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }

    .bottle-stage {
      min-height: 0;
    }

    .bottle-stage :global(.bottle) {
      --h: 17rem !important;
    }
  }
</style>
