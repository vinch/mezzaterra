<script lang="ts">
  import { self } from "$lib/ui/events";
  import { fade, fly } from "svelte/transition";
  import type { WineVintage } from "$lib/types";
  import WineBottle from "$lib/components/site/WineBottle.svelte";
  import {
    grapesText,
    vintageNotes,
    winePairings,
    wineryFlag,
    wineStyle,
    wineSubtitle,
    wineTitle,
  } from "$lib/wine";
  import { formatEUR } from "$lib/format";

  interface Props {
    onclose?: () => void;
    wineVintage?: WineVintage | null;
  }

  let { wineVintage = null,
    onclose
  }: Props = $props();

  let v = $derived(wineVintage as any);
  let wine = $derived(v?.wine);
  let style = $derived(wineStyle(wine?.wine_type));
  let region = $derived(wine?.winery?.region?.name || wine?.winery?.country?.name || "");
  let flag = $derived(wineryFlag(wine?.winery));
  let grapes = $derived(grapesText(v?.wine_vintage_grape, true));
  let notes = $derived(vintageNotes(v?.note));
  /* Les millésimes du site sont chargés avec VINTAGE_PUBLIC_SELECT, accords compris. */
  let pairings = $derived(winePairings(wine));

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
      aria-labelledby="wine-modal-title"
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
            {style.label}{v.organic ? " · Bio" : ""}
          </span>
          <h2 id="wine-modal-title" class="title">{wineTitle(wine)}</h2>
          {#if wineSubtitle(wine)}
            <p class="appellation">{wineSubtitle(wine)}</p>
          {/if}
          {#if wine.winery?.name}
            <p class="winery">{wine.winery.name}</p>
          {/if}
          {#if region}
            <p class="region">{flag} {region}</p>
          {/if}

          <dl class="facts">
            {#if v.year}
              <div><dt>Millésime</dt><dd>{v.year}</dd></div>
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
            <h3>Cépages</h3>
            <p>{grapes}</p>
          </section>
        {/if}

        {#if wine.description}
          <section>
            <h3>Le vin</h3>
            <p class="prose">{wine.description}</p>
          </section>
        {/if}

        {#if notes.length}
          <section>
            <h3>Notes de dégustation</h3>
            <div class="notes">
              {#each notes as note}
                <div class="note">
                  <span class="note-label">{note.label}</span>
                  <p>{note.content}</p>
                </div>
              {/each}
            </div>
          </section>
        {/if}

        {#if pairings.length}
          <section>
            <h3>À table avec</h3>
            <div class="pairings">
              {#each pairings as p}
                <span class="mz-chip">{p}</span>
              {/each}
            </div>
          </section>
        {/if}

        <!-- Millésime retiré : sa fiche publique n'existe plus (404). -->
        {#if !v.discontinued_at}
          <footer class="actions">
            <a class="mz-btn mz-btn--ghost mz-btn--sm" href="/vins/{v.id}">Fiche complète &amp; partage →</a>
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
    background: rgba(14, 24, 25, 0.55);
    backdrop-filter: blur(3px);
  }

  .sheet {
    position: relative;
    width: min(820px, 100%);
    max-height: 92vh;
    overflow-y: auto;
    background: var(--mz-paper-raised);
    border-radius: var(--mz-radius-lg);
    box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.45);
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
    background: rgba(255, 255, 255, 0.75);
    font-size: 1.6rem;
    line-height: 1;
    color: var(--mz-ink-soft);
    cursor: pointer;
  }

  .close:hover {
    background: #fff;
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

  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
    margin: 1rem 0 0;
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
    font-size: 1.35rem;
    color: var(--mz-ink);
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

  section h3 {
    margin: 0 0 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--mz-teal-soft);
  }

  section p {
    margin: 0;
    line-height: 1.6;
  }

  .prose {
    white-space: pre-line;
  }

  .notes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: 0.75rem;
  }

  .note {
    padding: 0.9rem 1rem;
    border-radius: var(--mz-radius-sm);
    background: var(--mz-paper);
    border-left: 3px solid var(--robe);
  }

  .note-label {
    display: block;
    font-family: var(--mz-font-display);
    font-size: 1.05rem;
    color: var(--mz-teal);
    margin-bottom: 0.2rem;
  }

  .note p {
    font-size: 0.95rem;
    color: var(--mz-ink-soft);
  }

  .pairings {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
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
