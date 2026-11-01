<script lang="ts">
  import { page } from "$app/stores";
  import { contactHref } from "$lib/contact";
  import { DEFAULT_KIND, PRODUCT_KINDS, type ProductKind } from "$lib/productKinds";

  interface Props {
    /** Catalogues à proposer (`fetchCatalogKinds`) : les vins, puis les huiles s'il y en a. */
    kinds?: ProductKind[];
  }

  let { kinds = [DEFAULT_KIND] }: Props = $props();

  let links = $derived<{ href: string; label: string; also?: string[] }[]>([
    { href: "/", label: "Accueil" },
    { href: "/tastings", label: "Dégustations" },
    ...kinds.map((k) => ({
      href: `/${PRODUCT_KINDS[k].slug}`,
      label: PRODUCT_KINDS[k].catalogTitle,
      /* Les pages domaine relèvent du catalogue principal. */
      also: k === DEFAULT_KIND ? ["/domaines"] : undefined,
    })),
  ]);

  let path = $derived($page.url.pathname);
</script>

<nav class="site-nav" aria-label="Navigation principale">
  {#each links as link}
    <a
      href={link.href}
      class="nav-link"
      class:home={link.href === "/"}
      class:active={[link.href, ...(link.also || [])].some((h) => path === h || path.startsWith(h + "/"))}
      aria-current={path === link.href ? "page" : undefined}>{link.label}</a
    >
  {/each}
  <!-- Vins, huiles… : un appel valable pour tout le catalogue ; « Commander » seul sur les très petits écrans. -->
  <a href={contactHref("commande")} class="nav-cta"><span class="cta-long">Passer une commande</span><span class="cta-short">Commander</span></a>
</nav>

<style>
  .site-nav {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .nav-link {
    position: relative;
    padding: 0.5rem 0.85rem;
    border-radius: var(--mz-radius-pill);
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

  /* L'appel principal : plein, à part des liens de navigation. */
  .nav-cta {
    margin-left: 0.6rem;
    padding: 0.55rem 1.1rem;
    border-radius: var(--mz-radius-pill);
    background: var(--mz-teal);
    color: var(--mz-paper-raised);
    text-decoration: none;
    font-weight: 600;
    font-size: 0.95rem;
    white-space: nowrap;
    box-shadow: var(--mz-shadow-sm);
    transition:
      background-color 0.2s ease,
      transform 0.2s var(--mz-ease);
  }

  .nav-cta:hover {
    background: var(--mz-teal-deep);
    transform: translateY(-1px);
  }

  @media (max-width: 720px) {
    .site-nav {
      overflow-x: auto;
      justify-content: safe center;
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

    .nav-cta {
      margin-left: 0.35rem;
      font-size: 0.9rem;
      padding: 0.45rem 0.9rem;
    }
  }

  /* Petit écran : le logo mène déjà à l'accueil, on garde la place pour l'appel. */
  @media (max-width: 480px) {
    .nav-link.home {
      display: none;
    }

    .nav-link {
      padding: 0.45rem 0.6rem;
    }
  }

  @media (max-width: 380px) {
    .site-nav {
      gap: 0;
    }

    .nav-link,
    .nav-cta {
      font-size: 0.84rem;
    }

    .nav-link {
      padding: 0.4rem 0.4rem;
    }

    .nav-cta {
      margin-left: 0.2rem;
      padding: 0.4rem 0.65rem;
    }
  }

  .cta-short {
    display: none;
  }

  /* « Passer une commande » ne tient pas à côté des liens sur un téléphone. */
  @media (max-width: 480px) {
    .cta-long {
      display: none;
    }

    .cta-short {
      display: inline;
    }
  }
</style>
