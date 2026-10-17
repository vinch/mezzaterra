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
    <svg viewBox="0 0 60 200" role="img" aria-label={alt || wine.label}>
      <defs>
        <linearGradient id="{gid}-glass" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stop-color="#16292b" />
          <stop offset="0.35" stop-color="#2a4447" />
          <stop offset="0.6" stop-color="#1b3133" />
          <stop offset="1" stop-color="#0f1e20" />
        </linearGradient>
        <linearGradient id="{gid}-wine" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stop-color={wine.color} stop-opacity="0.95" />
          <stop offset="0.4" stop-color={wine.light} stop-opacity="0.9" />
          <stop offset="1" stop-color={wine.color} stop-opacity="0.95" />
        </linearGradient>
      </defs>
      <path
        d="M24 4h12v40c0 8 14 18 14 34v108a10 10 0 0 1-10 10H20a10 10 0 0 1-10-10V78c0-16 14-26 14-34z"
        fill="url(#{gid}-glass)"
      />
      <path
        d="M11 96h38v90a8 8 0 0 1-8 8H19a8 8 0 0 1-8-8z"
        fill="url(#{gid}-wine)"
        opacity="0.85"
      />
      <rect x="23" y="2" width="14" height="14" rx="2" fill={wine.color} />
      <rect x="14" y="112" width="32" height="44" rx="3" fill="#f4f2ed" />
      <rect x="18" y="122" width="24" height="2.5" rx="1" fill="#256169" />
      <rect x="21" y="129" width="18" height="1.6" rx="0.8" fill="#5b7d7f" />
      <rect x="21" y="134" width="18" height="1.6" rx="0.8" fill="#5b7d7f" />
      <circle cx="30" cy="145" r="3.2" fill={wine.color} />
      <path d="M16 70c2-10 8-16 8-24" stroke="rgba(255,255,255,0.18)" stroke-width="2" fill="none" />
    </svg>
  {/if}
</div>

<style>
  .bottle {
    position: relative;
    height: var(--h);
    aspect-ratio: 3 / 10;
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
