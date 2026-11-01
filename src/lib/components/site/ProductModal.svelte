<script lang="ts">
  import { self } from "$lib/ui/events";
  import { fade, fly } from "svelte/transition";
  import type { WineVintage } from "$lib/types";
  import WineBottle from "./WineBottle.svelte";
  import ProductAbout from "./ProductAbout.svelte";
  import {
    grapesText,
    styleLabel,
    vintageVolume,
    wineryFlag,
    wineStyle,
    wineSubtitle,
    wineTitle,
  } from "$lib/wine";
  import { kindInfo, productHref } from "$lib/productKinds";
  import { formatEUR } from "$lib/format";

  /** Fiche rapide d'un lot du site (chargé avec `VINTAGE_PUBLIC_SELECT`) ; fermée quand `vintage` est vide. */
  interface Props {
    onclose?: () => void;
    vintage?: WineVintage | null;
  }

  let { vintage = null, onclose }: Props = $props();

  let v = $derived(vintage as any);
  let wine = $derived(v?.wine);
  let kind = $derived(kindInfo(wine));
  let volume = $derived(v ? vintageVolume(v) : "");
  let style = $derived(wineStyle(wine?.wine_type));
  let region = $derived(wine?.winery?.region?.name || wine?.winery?.country?.name || "");
  let flag = $derived(wineryFlag(wine?.winery));
  let grapes = $derived(grapesText(v?.wine_vintage_grape, true));

  function closeModal() {
    onclose?.();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") closeModal();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if v && wine}
  <div
    class="backdrop"
    transition:fade={{ duration: 180 }}
    onclick={self(() => closeModal())}
    role="presentation"
  >
    <div
      class="sheet"
      style="--robe: {style.color}; --robe-light: {style.light};"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-modal-title"
      transition:fly={{ y: 24, duration: 260 }}
    >
      <button class="close" onclick={closeModal} aria-label="Fermer">×</button>

      <header class="hero">
        <div class="hero-bottle">
          <WineBottle src={v.image_url} alt={wineTitle(wine)} wine={style} height="15rem" />
        </div>
        <div class="hero-text">
          <span class="mz-eyebrow">
            <span class="mz-dot" style="background: {style.color}"></span>
            {styleLabel(wine.wine_type)}{v.organic ? " · Bio" : ""}
          </span>
          <h2 id="product-modal-title" class="title">{wineTitle(wine)}</h2>
          {#if wineSubtitle(wine)}
            <p class="appellation">{wineSubtitle(wine)}</p>
          {/if}
          {#if wine.winery?.name}
            <p class="winery">{wine.winery.name}</p>
          {/if}
          {#if region}
            <p class="region">{flag} {region}</p>
          {/if}

          <dl class="mz-facts facts">
            {#if v.year}
              <div><dt>{kind.yearFact}</dt><dd>{v.year}</dd></div>
            {/if}
            {#if volume}
              <div><dt>Contenant</dt><dd>{volume}</dd></div>
            {/if}
            {#if v.abv}
              <div><dt>Alcool</dt><dd>{v.abv} % vol.</dd></div>
            {/if}
            {#if v.price}
              <div><dt>Prix</dt><dd>{formatEUR(v.price)}</dd></div>
            {/if}
          </dl>

          {#if v.organic}
            <img src="/organic.png" alt="Agriculture biologique" class="organic" />
          {/if}
        </div>
      </header>

      <div class="content">
        {#if grapes}
          <section>
            <h3 class="mz-eyebrow mz-eyebrow--heading">{kind.ingredients}</h3>
            <p>{grapes}</p>
          </section>
        {/if}

        <ProductAbout vintage={v} compact />

        <!-- Millésime retiré : sa fiche publique n'existe plus (404). -->
        {#if !v.discontinued_at}
          <footer class="actions">
            <a class="mz-btn mz-btn--ghost mz-btn--sm" href={productHref(v)}>Fiche complète &amp; partage →</a>
          </footer>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    background: var(--mz-backdrop);
    backdrop-filter: blur(3px);
  }

  .sheet {
    position: relative;
    width: min(820px, 100%);
    max-height: 92vh;
    overflow-y: auto;
    background: var(--mz-paper-raised);
    border-radius: var(--mz-radius-lg);
    box-shadow: var(--mz-shadow-lg);
    font-family: var(--mz-font-body);
    color: var(--mz-ink);
  }

  .close {
    position: absolute;
    top: 0.75rem;
    right: 0.9rem;
    z-index: 2;
    width: 2.4rem;
    height: 2.4rem;
    border-radius: 50%;
    border: none;
    background: color-mix(in srgb, var(--mz-white) 75%, transparent);
    font-size: 1.6rem;
    line-height: 1;
    color: var(--mz-ink-soft);
    cursor: pointer;
  }

  .close:hover {
    background: var(--mz-white);
    color: var(--mz-ink);
  }

  .hero {
    display: grid;
    grid-template-columns: 11rem 1fr;
    gap: 1.5rem;
    padding: 2rem 2rem 1.5rem;
    background:
      radial-gradient(ellipse at 15% 100%, color-mix(in srgb, var(--robe-light) 45%, transparent), transparent 60%),
      linear-gradient(180deg, var(--mz-paper) 0%, var(--mz-paper-raised) 100%);
    border-bottom: 1px solid var(--mz-line-soft);
  }

  .hero-bottle {
    display: flex;
    justify-content: center;
    align-items: flex-end;
  }

  .hero-text {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    min-width: 0;
  }

  .title {
    margin: 0.35rem 0 0;
    font-family: var(--mz-font-display);
    font-weight: 500;
    font-size: clamp(1.8rem, 4vw, 2.5rem);
    line-height: 1.05;
    color: var(--mz-teal);
  }

  .appellation,
  .winery,
  .region {
    margin: 0;
    color: var(--mz-ink-soft);
  }

  .winery {
    font-weight: 600;
  }

  /* Fiche rapide : plus serrée que la fiche complète. */
  .facts {
    gap: 1.5rem;
    margin-top: 1rem;
  }

  .facts dd {
    font-size: 1.35rem;
  }

  .organic {
    width: 3.2rem;
    margin-top: 0.75rem;
  }

  .content {
    padding: 1.5rem 2rem 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  section p {
    margin: 0;
    line-height: 1.6;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
  }

  @media (max-width: 640px) {
    .backdrop {
      align-items: flex-end;
      padding: 0;
    }

    .sheet {
      max-height: 94vh;
      border-radius: var(--mz-radius-lg) var(--mz-radius-lg) 0 0;
    }

    .hero {
      grid-template-columns: 1fr;
      padding: 1.5rem 1.25rem 1.25rem;
    }

    .hero-bottle {
      --bottle-h: 11rem;
      height: 11rem;
    }


    .content {
      padding: 1.25rem;
    }
  }
</style>
