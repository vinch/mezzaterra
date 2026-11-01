<script lang="ts">
  import OrganicLogo from "./OrganicLogo.svelte";
  import WineBottle from "./WineBottle.svelte";
  import { formatsText, grapesText, styleLabel, wineStyle, wineSubtitle, wineTitle } from "$lib/wine";
  import { formatEUR } from "$lib/format";
  import { kindInfo } from "$lib/productKinds";
  import type { Availability } from "$lib/publicData";

  interface Props {
    onopen?: (vintage: any) => void;
    vintage: any;
    /** Numéro de passage (1-based) dans une dégustation. */
    position?: number | null;
    /** Lien vers la fiche ; sinon la carte émet `open`. */
    href?: string | null;
    availability?: Availability | null;
    /** Contenants présentés sur cette carte (dont `vintage`, le plus petit) : « 50 cl · 1 L · 5 L », prix « dès ». */
    formats?: any[] | null;
  }

  let {
    vintage,
    position = null,
    href = null,
    availability = null,
    formats = null,
    onopen
  }: Props = $props();

  let wine = $derived(vintage?.wine);
  let style = $derived(wineStyle(wine?.wine_type));
  let title = $derived(wineTitle(wine));
  let subtitle = $derived(wineSubtitle(wine));
  let grapes = $derived(grapesText(vintage?.wine_vintage_grape));
  let soldOut = $derived(!!availability && !availability.in_stock);
  let lowStock = $derived(!soldOut && !!availability?.low_stock);
  let lots = $derived(formats?.length ? formats : [vintage]);
  /* Contenants affichés dès qu'il y en a plusieurs, ou qu'il ne s'agit pas de la bouteille standard. */
  let volumes = $derived(formatsText(lots));
  /* Un prix à 0 (bouteille réservée aux dégustations…) n'est pas affiché, comme avant. */
  let prices = $derived(lots.map((f) => Number(f.price)).filter((p) => p > 0));
  let priceText = $derived(
    prices.length ? `${new Set(prices).size > 1 ? "dès " : ""}${formatEUR(Math.min(...prices))}` : "",
  );
</script>

<svelte:element
  this={href ? "a" : "button"}
  {href}
  type={href ? undefined : "button"}
  class="wine-card"
  class:sold-out={soldOut}
  style="--robe: {style.color}; --robe-light: {style.light};"
  onclick={() => !href && onopen?.(vintage)}
  role={href ? undefined : "button"}
>
  <div class="visual">
    {#if position != null}
      <span class="position" aria-label="{kindInfo(wine).label} numéro {position}">{position}</span>
    {/if}
    <WineBottle src={vintage?.image_url} alt={title} wine={style} height="10.5rem" />
  </div>

  <div class="body">
    <div class="meta-top">
      <span class="style"><span class="mz-dot" style="background: {style.color}"></span>{styleLabel(wine?.wine_type)}</span>
      {#if vintage?.organic}
        <span class="organic"><OrganicLogo /></span>
      {/if}
    </div>

    <h3 class="title">{title}</h3>
    {#if subtitle}
      <p class="subtitle">{subtitle}</p>
    {/if}
    {#if wine?.winery?.name}
      <p class="winery">{wine.winery.name}</p>
    {/if}
    {#if grapes}
      <p class="grapes">{grapes}</p>
    {/if}
    {#if volumes}
      <p class="volumes">{volumes}</p>
    {/if}

    <div class="foot">
      {#if soldOut}
        <span class="stock out">Épuisé</span>
      {:else if lowStock}
        <span class="stock low">Dernières bouteilles</span>
      {/if}
      <div class="meta-bottom">
        {#if vintage?.year}
          <span class="year">{vintage.year}</span>
        {/if}
        {#if priceText}
          <span class="price">{priceText}</span>
        {/if}
      </div>
    </div>
  </div>
</svelte:element>

<style>
  .wine-card {
    position: relative;
    display: grid;
    grid-template-columns: 6.5rem 1fr;
    gap: 1.1rem;
    align-items: stretch;
    padding: 1.1rem 1.25rem 1.1rem 0.75rem;
    background: var(--mz-paper-raised);
    border: 1px solid var(--mz-line-soft);
    border-radius: var(--mz-radius);
    box-shadow: var(--mz-shadow-sm);
    color: inherit;
    text-decoration: none;
    text-align: left;
    font: inherit;
    cursor: pointer;
    overflow: hidden;
    transition:
      transform 0.25s var(--mz-ease),
      box-shadow 0.25s ease,
      border-color 0.25s ease;
  }

  /* Liseré couleur de robe. */
  .wine-card::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    background: linear-gradient(180deg, var(--robe-light), var(--robe));
  }

  .wine-card:hover,
  .wine-card:focus-visible {
    transform: translateY(-3px);
    box-shadow: var(--mz-shadow);
    border-color: var(--mz-line);
    outline: none;
  }

  .wine-card:hover :global(.bottle img),
  .wine-card:hover :global(.bottle svg) {
    transform: rotate(-3deg) translateY(-2px);
  }

  .wine-card :global(.bottle img),
  .wine-card :global(.bottle svg) {
    transition: transform 0.35s var(--mz-ease);
  }

  .visual {
    position: relative;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  .position {
    position: absolute;
    top: 0;
    left: 0.4rem;
    z-index: 2;
    width: 1.9rem;
    height: 1.9rem;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--mz-teal);
    color: var(--mz-white);
    font-family: var(--mz-font-display);
    font-weight: 600;
    font-size: 0.95rem;
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  .meta-top {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.75rem;
    align-items: center;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--mz-muted);
    margin-bottom: 0.2rem;
  }

  .style {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .organic {
    display: inline-flex;
    margin-left: auto;
  }

  .title {
    margin: 0;
    font-family: var(--mz-font-display);
    font-weight: 500;
    font-size: 1.35rem;
    line-height: 1.15;
    color: var(--mz-teal);
  }

  .subtitle,
  .winery,
  .grapes {
    margin: 0;
    font-size: 0.9rem;
    color: var(--mz-ink-soft);
  }

  .winery {
    font-weight: 600;
  }

  .grapes {
    color: var(--mz-muted);
    font-style: italic;
  }

  .volumes {
    margin: 0;
    font-size: 0.85rem;
    color: var(--mz-ink-soft);
    font-variant-numeric: tabular-nums;
  }

  .foot {
    margin-top: auto;
    padding-top: 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .meta-bottom {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
  }

  .year {
    font-family: var(--mz-font-display);
    font-size: 1.1rem;
    color: var(--mz-ink-soft);
  }

  .price {
    margin-left: auto;
    font-weight: 700;
    color: var(--mz-ink);
    font-variant-numeric: tabular-nums;
  }

  /* Disponibilité : pastille discrète, sur sa ligne au-dessus du prix. */
  .stock {
    align-self: flex-end;
    padding: 0.1rem 0.55rem;
    border-radius: var(--mz-radius-pill);
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .stock.low {
    color: var(--mz-warning);
    background: color-mix(in srgb, var(--mz-warning) 12%, transparent);
  }

  .stock.out {
    color: var(--mz-muted);
    background: color-mix(in srgb, var(--mz-muted) 14%, transparent);
  }

  /* Épuisé : bouteille ternie et prix en retrait. */
  .sold-out .visual {
    filter: grayscale(0.85);
    opacity: 0.55;
  }

  .sold-out .price {
    color: var(--mz-muted);
    font-weight: 600;
  }
</style>
