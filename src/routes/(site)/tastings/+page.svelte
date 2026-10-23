<script lang="ts">
  import { daysUntil, formatDayMonth, formatDateLong, formatTime } from "$lib/dates";
  import { isPrivateTasting, tastingTitle } from "$lib/publicData";
  import { formatEur } from "$lib/wine";
  import { contactHref } from "$lib/contact";

  export let data;

  $: ({ error } = data);
  /* Les dégustations privées (chez un client, en externe) ne sont pas listées. */
  $: tastings = data.tastings.filter((t: any) => !isPrivateTasting(t));
  /* À venir : la plus proche d'abord. Passées : la plus récente d'abord. */
  $: upcoming = tastings.filter((t: any) => daysUntil(t.date) >= 0).reverse();
  $: past = tastings.filter((t: any) => daysUntil(t.date) < 0);

  function wineCount(t: any): number {
    return t.tasting_wine_vintage?.length ?? 0;
  }
</script>

<svelte:head>
  <title>Dégustations — Mezzaterra</title>
  <meta property="og:title" content="Dégustations — Mezzaterra" />
  <meta property="og:description" content="Des soirées pour découvrir les vins des Abruzzes, en petit comité." />
</svelte:head>

<section class="intro">
  <div class="mz-container mz-rise">
    <h1 class="mz-display mz-h1">Dégustations</h1>
    <p class="mz-lead">
      Des soirées en petit comité pour découvrir les vins des Abruzzes — un vigneron, une histoire et
      quelque chose de bon à grignoter avec chaque verre.
    </p>
  </div>
</section>

<div class="mz-container">
  {#if error}
    <p class="mz-empty">Impossible de charger les dégustations pour le moment.</p>
  {:else}
    <section class="block">
      <h2 class="section-title">À venir</h2>
      {#if upcoming.length === 0}
        <div class="mz-card empty-upcoming">
          <p>Aucune date n’est encore annoncée.</p>
          <a class="mz-btn mz-btn--sm" href="/#newsletter">Être prévenu·e de la prochaine</a>
        </div>
      {:else}
        <div class="upcoming">
          {#each upcoming as t, i (t.id)}
            {@const d = formatDayMonth(t.date)}
            {@const delta = daysUntil(t.date)}
            <a href="/tastings/{t.id}" class="upcoming-card mz-rise" style="animation-delay: {i * 80}ms">
              <div class="date-tile" aria-hidden="true">
                <span class="day">{d.day}</span>
                <span class="month">{d.month}</span>
              </div>
              <div class="upcoming-body">
                <span class="mz-eyebrow" class:today={delta === 0}>
                  {delta === 0 ? "Aujourd’hui" : delta === 1 ? "Demain" : `Dans ${delta} jours`}
                </span>
                <h3 class="mz-display mz-h3">{tastingTitle(t)}</h3>
                <p class="meta">
                  {formatDateLong(t.date)}{t.start_time ? ` · ${formatTime(t.start_time)}` : ""}{t.location
                    ? ` · ${t.location}`
                    : ""}
                </p>
                <p class="meta">
                  {#if wineCount(t)}{wineCount(t)} vins{/if}{#if t.price}{wineCount(t) ? " · " : ""}{formatEur(t.price)} / pers.{/if}
                </p>
              </div>
              <span class="go" aria-hidden="true">→</span>
            </a>
          {/each}
        </div>
      {/if}
    </section>

    {#if past.length}
      <section class="block">
        <h2 class="section-title">Passées</h2>
        <ol class="past">
          {#each past as t (t.id)}
            {@const d = formatDayMonth(t.date)}
            <li>
              <a href="/tastings/{t.id}" class="past-row">
                <span class="past-date">{d.day} {d.month} {d.year}</span>
                <span class="past-name">{tastingTitle(t)}</span>
                <span class="past-meta">
                  {t.location || ""}{t.location && wineCount(t) ? " · " : ""}{wineCount(t) ? `${wineCount(t)} vins` : ""}
                </span>
                <span class="go" aria-hidden="true">→</span>
              </a>
            </li>
          {/each}
        </ol>
      </section>
    {/if}
  {/if}

  <section class="block">
    <div class="mz-card private-cta">
      <h2 class="mz-display mz-h3">Envie d’une dégustation privée chez vous ?</h2>
      <a class="mz-btn" href={contactHref("prive")}>Contactez-nous</a>
    </div>
  </section>
</div>

<style>
  .intro {
    padding: 3rem 0 1.5rem;
  }

  .intro h1 {
    margin: 0 0 0.75rem;
  }

  .block {
    padding: 1.5rem 0 2rem;
  }

  .section-title {
    margin: 0 0 1rem;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--mz-muted);
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .section-title::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--mz-line-soft);
  }

  .empty-upcoming {
    padding: 1.5rem;
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: center;
    justify-content: space-between;
  }

  .empty-upcoming p {
    margin: 0;
    color: var(--mz-ink-soft);
  }

  .private-cta {
    padding: 1.5rem;
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: center;
    justify-content: space-between;
  }

  .private-cta h2 {
    margin: 0;
  }

  .upcoming {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr));
    gap: 1rem;
  }

  .upcoming-card {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 1.25rem;
    align-items: center;
    padding: 1.25rem 1.5rem;
    background: var(--mz-paper-raised);
    border: 1px solid var(--mz-line-soft);
    border-radius: var(--mz-radius);
    color: inherit;
    text-decoration: none;
    box-shadow: var(--mz-shadow-sm);
    transition:
      transform 0.25s var(--mz-ease),
      box-shadow 0.25s ease;
  }

  .upcoming-card:hover {
    transform: translateY(-3px);
    box-shadow: var(--mz-shadow);
  }

  .date-tile {
    width: 4.5rem;
    height: 4.8rem;
    border-radius: 12px;
    background: var(--mz-teal);
    color: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  .day {
    font-family: var(--mz-font-display);
    font-size: 2rem;
    font-weight: 500;
  }

  .month {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-top: 0.3rem;
    opacity: 0.85;
  }

  .upcoming-body h3 {
    margin: 0.25rem 0;
  }

  .today {
    color: var(--mz-wine-red);
  }

  .meta {
    margin: 0.1rem 0 0;
    font-size: 0.92rem;
    color: var(--mz-ink-soft);
  }

  .meta:empty {
    display: none;
  }

  .go {
    font-size: 1.3rem;
    color: var(--mz-teal);
    transition: transform 0.25s var(--mz-ease);
  }

  .upcoming-card:hover .go,
  .past-row:hover .go {
    transform: translateX(4px);
  }

  .past {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .past-row {
    display: grid;
    grid-template-columns: 9rem 1fr auto auto;
    gap: 1rem;
    align-items: baseline;
    padding: 1rem 0.5rem;
    border-bottom: 1px solid var(--mz-line-soft);
    color: inherit;
    text-decoration: none;
    transition: background-color 0.2s ease;
  }

  .past-row:hover {
    background: var(--mz-teal-wash);
  }

  .past-date {
    font-size: 0.85rem;
    color: var(--mz-muted);
    font-variant-numeric: tabular-nums;
  }

  .past-name {
    font-family: var(--mz-font-display);
    font-size: 1.2rem;
    color: var(--mz-teal);
  }

  .past-meta {
    font-size: 0.85rem;
    color: var(--mz-muted);
  }

  @media (max-width: 640px) {
    .past-row {
      grid-template-columns: 1fr auto;
    }

    .past-date {
      grid-column: 1 / -1;
    }

    .past-meta {
      display: none;
    }
  }
</style>
