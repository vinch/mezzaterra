<script lang="ts">
  import type { ProductStyle } from "$lib/productStyles";

  interface Props {
    /** Photo détourée de la bouteille (sinon silhouette teintée à la couleur de la robe). */
    src?: string | null | undefined;
    alt?: string;
    style: ProductStyle;
    /** Hauteur CSS de la bouteille. */
    height?: string;
  }

  let {
    src = null,
    alt = "",
    style,
    height = "12rem"
  }: Props = $props();

  /* Image en échec : on retombe sur la bouteille dessinée, jusqu'à ce que `src` change. */
  let failedSrc = $state<string | null>(null);
  let failed = $derived(failedSrc === src);
  /* Id déterministe (SSR/hydratation) : deux bouteilles de même robe partagent des dégradés identiques. */
  let gid = $derived(`mz-bottle-${style.key}`);
</script>

<div class="bottle" style="--bottle-h-default: {height}; --robe: {style.color}; --robe-light: {style.light};">
  {#if src && !failed}
    <img {src} {alt} loading="lazy" onerror={() => (failedSrc = src ?? null)} />
  {:else}
    <svg viewBox="0 0 71 200" role="img" aria-label={alt || style.label}>
      <defs>
        <linearGradient id="{gid}-glass" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stop-color="#132527" />
          <stop offset="0.3" stop-color="#2c484b" />
          <stop offset="0.55" stop-color="#1c3335" />
          <stop offset="1" stop-color="#0e1c1e" />
        </linearGradient>
        <linearGradient id="{gid}-liquid" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stop-color={style.color} stop-opacity="0.96" />
          <stop offset="0.38" stop-color={style.light} stop-opacity="0.92" />
          <stop offset="1" stop-color={style.color} stop-opacity="0.96" />
        </linearGradient>
      </defs>
      <!-- Bouteille bordelaise : col court, épaules marquées -->
      <path
        d="M27 14h17v30c0 10 3 15 9 21 7 7 10 14 10 26v94a10 10 0 0 1-10 10H18a10 10 0 0 1-10-10V91c0-12 3-19 10-26 6-6 9-11 9-21z"
        fill="url(#{gid}-glass)"
      />
      <path d="M9 100h53v85a9 9 0 0 1-9 9H18a9 9 0 0 1-9-9z" fill="url(#{gid}-liquid)" opacity="0.88" />
      <rect x="26" y="3" width="19" height="15" rx="3" fill={style.color} />
      <rect x="26" y="15" width="19" height="3" fill="rgba(0,0,0,0.25)" />
      <rect class="label" x="15" y="112" width="41" height="50" rx="3.5" />
      <rect class="label-title" x="21" y="123" width="29" height="3" rx="1.5" />
      <rect class="label-line" x="24" y="131" width="23" height="2" rx="1" />
      <rect class="label-line" x="24" y="137" width="23" height="2" rx="1" />
      <circle cx="35.5" cy="150" r="3.6" fill={style.color} />
      <path d="M19 95c1-11 8-19 13-24" stroke="rgba(255,255,255,0.2)" stroke-width="2.6" stroke-linecap="round" fill="none" />
      <path d="M14 108v70" stroke="rgba(255,255,255,0.12)" stroke-width="2.6" stroke-linecap="round" />
    </svg>
  {/if}
</div>

<style>
  .bottle {
    position: relative;
    /* --bottle-h (posé par le parent, ex. en media query) l'emporte sur la prop height. */
    height: var(--bottle-h, var(--bottle-h-default));
    aspect-ratio: 71 / 200;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    flex-shrink: 0;
  }

  .bottle::before {
    content: "";
    position: absolute;
    left: 50%;
    bottom: 2%;
    width: 220%;
    height: 22%;
    transform: translateX(-50%);
    background: radial-gradient(ellipse at center, var(--robe-light) 0%, transparent 70%);
    opacity: 0.45;
    filter: blur(6px);
    z-index: 0;
  }

  img,
  svg {
    position: relative;
    z-index: 1;
    height: 100%;
    width: auto;
    max-width: 260%;
    object-fit: contain;
    filter: drop-shadow(0 10px 14px color-mix(in srgb, var(--mz-ink) 22%, transparent));
  }

  /* Étiquette dessinée, aux couleurs de la marque. */
  .label {
    fill: var(--mz-paper-raised);
  }

  .label-title {
    fill: var(--mz-teal);
  }

  .label-line {
    fill: var(--mz-teal-soft);
  }
</style>
