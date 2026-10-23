<script lang="ts">
  import "$lib/styles/site.css";
  import { page } from "$app/stores";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import SiteNav from "$lib/components/site/SiteNav.svelte";

  $: path = $page.url.pathname;
  /* Le mode live a son propre habillage plein écran (thème « cave »). */
  $: immersive = path.endsWith("/live");
  /* Hauteur réelle du header, pour coller les barres sticky juste dessous. */
  let headerHeight = 0;
</script>

{#if immersive}
  <slot />
{:else}
  <div class="site" style={headerHeight ? `--mz-header-h: ${headerHeight}px` : undefined}>
    <header class="site-header" bind:offsetHeight={headerHeight}>
      <div class="header-inner">
        <a href="/" class="brand" aria-label="Mezzaterra — accueil">
          <img src="/flyer/logo-text.svg" alt="Mezzaterra" />
        </a>
        <SiteNav />
      </div>
    </header>

    <main class="site-main">
      <slot />
    </main>

    <SiteFooter />
  </div>
{/if}

<style>
  .site {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    font-family: var(--mz-font-body);
    color: var(--mz-ink);
    background: var(--mz-paper);
    /* Évite un défilement horizontal dû aux fonds pleine largeur (100vw). */
    overflow-x: clip;
  }

  .site-header {
    position: sticky;
    top: 0;
    z-index: 40;
    background: color-mix(in srgb, var(--mz-paper) 88%, transparent);
    backdrop-filter: saturate(1.2) blur(10px);
    -webkit-backdrop-filter: saturate(1.2) blur(10px);
    border-bottom: 1px solid var(--mz-line-soft);
  }

  .header-inner {
    max-width: 1160px;
    margin: 0 auto;
    padding: 0.9rem 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
  }

  .brand img {
    display: block;
    height: 2.6rem;
    width: auto;
  }

  .site-main {
    flex: 1;
  }

  @media (max-width: 720px) {
    .header-inner {
      flex-direction: column;
      align-items: stretch;
      gap: 0.6rem;
      padding: 0.75rem 1rem 0.5rem;
    }

    .brand {
      align-self: center;
    }

    .brand img {
      height: 2.1rem;
    }
  }
</style>
