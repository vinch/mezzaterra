<script lang="ts">
  import "$lib/styles/site.css";
  import { page } from "$app/stores";
  import SiteFooter from "$lib/components/SiteFooter.svelte";

  const links: { href: string; label: string; also?: string[] }[] = [
    { href: "/", label: "Accueil" },
    { href: "/tastings", label: "Dégustations" },
    { href: "/vins", label: "Nos vins", also: ["/domaines"] },
  ];

  $: path = $page.url.pathname;
  /* Le mode live a son propre habillage plein écran (thème « cave »). */
  $: immersive = path.endsWith("/live");
</script>

{#if immersive}
  <slot />
{:else}
  <div class="site">
    <header class="site-header">
      <div class="header-inner">
        <a href="/" class="brand" aria-label="Mezzaterra — accueil">
          <img src="/flyer/logo-text.svg" alt="Mezzaterra" />
        </a>
        <nav class="site-nav" aria-label="Navigation principale">
          {#each links as link}
            <a
              href={link.href}
              class="nav-link"
              class:active={[link.href, ...(link.also || [])].some((h) => path === h || path.startsWith(h + "/"))}
              aria-current={path === link.href ? "page" : undefined}>{link.label}</a
            >
          {/each}
        </nav>
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

  .site-nav {
    display: flex;
    gap: 0.25rem;
  }

  .nav-link {
    position: relative;
    padding: 0.5rem 0.85rem;
    border-radius: 999px;
    color: var(--mz-ink-soft);
    text-decoration: none;
    font-weight: 500;
    font-size: 0.95rem;
    white-space: nowrap;
    transition:
      background-color 0.2s ease,
      color 0.2s ease;
  }

  .nav-link:hover {
    background: var(--mz-teal-wash);
    color: var(--mz-teal);
  }

  .nav-link.active {
    color: var(--mz-teal);
    background: var(--mz-teal-wash);
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

    .site-nav {
      overflow-x: auto;
      justify-content: center;
      scrollbar-width: none;
      margin: 0 -1rem;
      padding: 0 1rem;
    }

    .site-nav::-webkit-scrollbar {
      display: none;
    }

    .nav-link {
      font-size: 0.9rem;
      padding: 0.45rem 0.75rem;
    }
  }
</style>
