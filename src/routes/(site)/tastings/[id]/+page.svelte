<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import ProductModal from "$lib/components/site/ProductModal.svelte";
  import ProductCard from "$lib/components/site/ProductCard.svelte";
  import RegistrationForm from "$lib/components/site/RegistrationForm.svelte";
  import { fetchAvailability, isPrivateTasting, TASTING_ADDRESS, tastingTitle, type AvailabilityOf } from "$lib/publicData";
  import { buildIcs, daysAwayLabel, daysUntil, downloadTextFile, formatDateLong, formatTime, isLiveNow } from "$lib/dates";
  import { productStyle, productTitle } from "$lib/wine";
  import { formatEUR } from "$lib/format";
  import type { WineVintage } from "$lib/types";

  let { data } = $props();

  let { tasting, wineVintages, error } = $derived(data);
  let hiddenCount = $derived((data as any).hiddenCount ?? 0);
  let t = $derived(tasting as any);
  let delta = $derived(t ? daysUntil(t.date) : 0);
  let isUpcoming = $derived(delta > 0);
  let isLive = $derived(t ? isLiveNow(t.date) : false);
  /* Privée : accessible par lien (mode live, fiches de table) mais sans inscription en ligne. */
  let isPrivate = $derived(isPrivateTasting(t));
  /* Adresse seulement quand elle sert à venir ; une dégustation privée a lieu ailleurs. */
  let address = $derived((isUpcoming || isLive) && !isPrivate ? TASTING_ADDRESS : null);
  let styles = $derived(wineVintages.map((v: any) => productStyle(v.wine?.wine_type)));

  let selected = $state<WineVintage | null>(null);
  let availability = $state<AvailabilityOf | null>(null);

  onMount(async () => {
    if (isUpcoming || isLive) availability = await fetchAvailability();
  });

  function addToCalendar() {
    if (!t) return;
    const ics = buildIcs({
      uid: t.id,
      title: tastingTitle(t),
      date: t.date,
      time: t.start_time,
      location: address,
      description: t.description,
      url: $page.url.href,
    });
    downloadTextFile("degustation-mezzaterra.ics", ics, "text/calendar;charset=utf-8");
  }

  /* La veille au soir encore en cours (delta -1) : « En direct ». */
  let statusLabel = $derived(isLive && delta < 0 ? "En direct" : delta >= 0 ? daysAwayLabel(delta) : "Dégustation passée");
</script>

<svelte:head>
  <title>{t ? tastingTitle(t) : "Dégustation"} — Mezzaterra</title>
  {#if isPrivate}
    <meta name="robots" content="noindex" />
  {/if}
  {#if t}
    <meta property="og:title" content="{tastingTitle(t)} — Mezzaterra" />
    <meta
      property="og:description"
      content="{formatDateLong(t.date)} — {wineVintages.length || hiddenCount} vins des Abruzzes à découvrir."
    />
  {/if}
</svelte:head>

{#if error}
  <div class="mz-container mz-section"><p class="mz-empty">Impossible de charger cette dégustation.</p></div>
{:else if !t}
  <div class="mz-container mz-section">
    <p class="mz-empty">Cette dégustation est introuvable. <a class="mz-link" href="/tastings">Voir toutes les dégustations</a></p>
  </div>
{:else}
  <section class="hero">
    <div class="mz-container hero-inner mz-rise">
      <a href="/tastings" class="mz-back">← Toutes les dégustations</a>
      <span class="mz-eyebrow status" class:live={isLive}>
        {#if isLive}<span class="pulse" aria-hidden="true"></span>{/if}
        {statusLabel}
      </span>
      <h1 class="mz-display mz-h1">{tastingTitle(t)}</h1>
      <ul class="facts">
        <li>{formatDateLong(t.date)}{t.start_time ? ` · ${formatTime(t.start_time)}` : ""}</li>
        {#if isPrivate}<li>Dégustation privée</li>{/if}
        {#if address}<li>{address}</li>{/if}
        {#if t.price}<li>{formatEUR(t.price)} / personne</li>{/if}
        {#if wineVintages.length || hiddenCount}<li>{wineVintages.length || hiddenCount} vins</li>{/if}
      </ul>
      {#if t.description}
        <p class="mz-lead description">{t.description}</p>
      {/if}

      <div class="cta">
        {#if isLive}
          <a class="mz-btn" href="/tastings/{t.id}/live">Suivre la dégustation en direct →</a>
        {/if}
        {#if isUpcoming}
          {#if !isPrivate}<a class="mz-btn" href="#reserver">Réserver ma place</a>{/if}
          <button type="button" class="mz-btn mz-btn--ghost" onclick={addToCalendar}>Ajouter à mon agenda</button>
        {/if}
      </div>

      {#if wineVintages.length > 1}
        <div class="journey" aria-label="Parcours de la dégustation">
          <span class="mz-eyebrow journey-label">Le parcours</span>
          <div class="journey-track">
            <span
              class="journey-line"
              style="background: linear-gradient(90deg, {styles.map((s: any) => s.color).join(', ')})"
            ></span>
            {#each wineVintages as v, i}
              <span
                class="journey-stop"
                style="--c: {styles[i].color}; --l: {styles[i].light}; left: {(i / (wineVintages.length - 1)) * 100}%"
                title="{i + 1}. {productTitle(v.wine)}"
              ></span>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </section>

  <section class="mz-container mz-section">
    {#if wineVintages.length > 0}
      <div class="mz-product-grid">
        {#each wineVintages as v, i (v.id)}
          <div class="mz-rise" style="animation-delay: {Math.min(i, 8) * 60}ms">
            <ProductCard
              vintage={v}
              position={i + 1}
              availability={availability?.(v.id) ?? null}
              onopen={(v) => (selected = v)}
            />
          </div>
        {/each}
      </div>
    {:else if hiddenCount}
      <div class="secret">
        <div class="secret-bottles" aria-hidden="true">
          {#each Array(Math.min(hiddenCount, 8)) as _, i}<span style="animation-delay: {i * 90}ms"></span>{/each}
        </div>
        <p class="secret-title">{hiddenCount} vins à découvrir</p>
        <p class="mz-muted">
          {isLive ? "Ils se dévoilent un à un pendant la soirée." : "La sélection reste une surprise jusqu’au soir de la dégustation."}
        </p>
        {#if isLive}
          <a class="mz-btn" href="/tastings/{t.id}/live">Suivre la dégustation en direct →</a>
        {/if}
      </div>
    {:else}
      <p class="mz-empty">La sélection des vins sera bientôt dévoilée…</p>
    {/if}
  </section>

  {#if isUpcoming && !isPrivate}
    <section id="reserver" class="mz-container mz-section">
      <div class="mz-card booking">
        <div>
          <span class="mz-eyebrow">Réservation</span>
          <h2 class="mz-display mz-h2">Une place à table ?</h2>
          <p class="mz-muted">
            Réservez en quelques secondes. Vous recevrez nos prochaines invitations par email.
          </p>
        </div>
        <RegistrationForm tastingId={t.id} />
      </div>
    </section>
  {/if}
{/if}

{#if selected}
  <ProductModal vintage={selected} onclose={() => (selected = null)} />
{/if}

<style>
  .hero {
    padding: 2.5rem 0 2rem;
    background:
      radial-gradient(ellipse 60% 80% at 90% 0%, color-mix(in srgb, var(--mz-teal) 10%, transparent), transparent 70%),
      var(--mz-paper);
    border-bottom: 1px solid var(--mz-line-soft);
  }

  .hero-inner {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }

  .status.live {
    color: var(--mz-wine-red);
  }

  .pulse {
    --mz-pulse: var(--mz-wine-red);
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    background: var(--mz-pulse);
    animation: mz-pulse 1.6s ease-out infinite;
  }

  .facts {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.4rem;
    color: var(--mz-ink-soft);
    font-weight: 500;
  }

  .facts li + li::before {
    content: "·";
    margin-left: -0.85rem;
    margin-right: 0.6rem;
    color: var(--mz-line);
  }

  .description {
    margin: 0.25rem 0 0;
    white-space: pre-line;
  }

  .cta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .cta:empty {
    display: none;
  }

  .journey {
    margin-top: 1.25rem;
    display: flex;
    align-items: center;
    gap: 1.25rem;
    max-width: 40rem;
  }

  .journey-label {
    color: var(--mz-muted);
    white-space: nowrap;
  }

  .journey-track {
    position: relative;
    flex: 1;
    height: 1.2rem;
    margin: 0 0.6rem;
  }

  .journey-line {
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 4px;
    transform: translateY(-50%);
    border-radius: var(--mz-radius-pill);
    opacity: 0.7;
  }

  .journey-stop {
    position: absolute;
    top: 50%;
    width: 1.05rem;
    height: 1.05rem;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    background: radial-gradient(circle at 35% 35%, var(--l), var(--c));
    box-shadow:
      0 0 0 3px var(--mz-paper),
      0 2px 6px color-mix(in srgb, var(--mz-ink) 20%, transparent);
  }

  .secret {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 3rem 1rem;
    text-align: center;
  }

  .secret-bottles {
    display: flex;
    gap: 0.6rem;
    margin-bottom: 1rem;
  }

  .secret-bottles span {
    width: 1.1rem;
    height: 3.4rem;
    border-radius: 0.55rem 0.55rem 0.25rem 0.25rem;
    background: var(--mz-line);
    animation: mz-rise 0.6s var(--mz-ease) both;
  }

  .secret-title {
    margin: 0;
    font-family: var(--mz-font-display);
    font-size: 1.6rem;
    color: var(--mz-teal);
  }

  .secret .mz-btn {
    margin-top: 0.75rem;
  }

  .booking {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
    gap: 2rem;
    padding: 2rem;
  }

  .booking h2 {
    margin: 0.5rem 0;
  }

  @media (max-width: 640px) {
    .facts {
      flex-direction: column;
      gap: 0.15rem;
    }

    .facts li + li::before {
      display: none;
    }
  }

  @media (max-width: 820px) {
    .booking {
      grid-template-columns: 1fr;
      padding: 1.5rem;
    }

    .journey {
      flex-direction: column;
      align-items: stretch;
      gap: 0.5rem;
    }
  }
</style>
