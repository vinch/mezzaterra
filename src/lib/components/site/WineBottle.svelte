<script lang="ts">
  import type { WineStyle } from "$lib/wine";

  /** Photo détourée de la bouteille (sinon silhouette teintée à la couleur de la robe). */
  export let src: string | null | undefined = null;
  export let alt = "";
  export let wine: WineStyle;
  /** Hauteur CSS de la bouteille. */
  export let height = "12rem";
  export let glow = true;

  let failed = false;
  $: if (src) failed = false;
  /* Id déterministe (SSR/hydratation) : deux bouteilles de même robe partagent des dégradés identiques. */
  $: gid = `mz-bottle-${wine.key}`;
</script>

<div class="bottle" class:glow style="--h: {height}; --robe: {wine.color}; --robe-light: {wine.light};">
  {#if src && !failed}
    <img {src} {alt} loading="lazy" on:error={() => (failed = true)} />
  {:else}
    <svg viewBox="0 0 71 200" role="img" aria-label={alt || wine.label}>
      <defs>
        <linearGradient id="{gid}-glass" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stop-color="#132527" />
          <stop offset="0.3" stop-color="#2c484b" />
          <stop offset="0.55" stop-color="#1c3335" />
          <stop offset="1" stop-color="#0e1c1e" />
        </linearGradient>
        <linearGradient id="{gid}-wine" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stop-color={wine.color} stop-opacity="0.96" />
          <stop offset="0.38" stop-color={wine.light} stop-opacity="0.92" />
          <stop offset="1" stop-color={wine.color} stop-opacity="0.96" />
        </linearGradient>
      </defs>
      <!-- Bouteille bordelaise : col court, épaules marquées -->
      <path
        d="M27 14h17v30c0 10 3 15 9 21 7 7 10 14 10 26v94a10 10 0 0 1-10 10H18a10 10 0 0 1-10-10V91c0-12 3-19 10-26 6-6 9-11 9-21z"
        fill="url(#{gid}-glass)"
      />
      <path d="M9 100h53v85a9 9 0 0 1-9 9H18a9 9 0 0 1-9-9z" fill="url(#{gid}-wine)" opacity="0.88" />
      <rect x="26" y="3" width="19" height="15" rx="3" fill={wine.color} />
      <rect x="26" y="15" width="19" height="3" fill="rgba(0,0,0,0.25)" />
      <rect x="15" y="112" width="41" height="50" rx="3.5" fill="#f4f2ed" />
      <rect x="21" y="123" width="29" height="3" rx="1.5" fill="#256169" />
      <rect x="24" y="131" width="23" height="2" rx="1" fill="#5b7d7f" />
      <rect x="24" y="137" width="23" height="2" rx="1" fill="#5b7d7f" />
      <circle cx="35.5" cy="150" r="3.6" fill={wine.color} />
      <path d="M19 95c1-11 8-19 13-24" stroke="rgba(255,255,255,0.2)" stroke-width="2.6" stroke-linecap="round" fill="none" />
      <path d="M14 108v70" stroke="rgba(255,255,255,0.12)" stroke-width="2.6" stroke-linecap="round" />
    </svg>
  {/if}
</div>

<style>
  .bottle {
    position: relative;
    height: var(--h);
    aspect-ratio: 71 / 200;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    flex-shrink: 0;
  }

  .bottle.glow::before {
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
    filter: drop-shadow(0 10px 14px rgba(29, 42, 44, 0.22));
  }
</style>
