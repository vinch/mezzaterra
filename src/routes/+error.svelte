<script lang="ts">
  import "$lib/styles/site.css";
  import { page } from "$app/stores";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import ErrorView from "$lib/components/site/ErrorView.svelte";
</script>

<svelte:head>
  <title>{$page.status === 404 ? "Page introuvable" : "Erreur"} — Mezzaterra</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<!-- Erreurs hors des pages du site (URL inconnue…) : page autonome avec logo et pied de page. -->
<div class="page">
  <main>
    <ErrorView
      status={$page.status}
      message={$page.error?.message ?? ""}
      withLogo
      links={[
        { href: "/", label: "Retour à l’accueil" },
        { href: "/vins", label: "Nos vins" },
        { href: "/degustations", label: "Dégustations" },
      ]}
    />
  </main>
  <SiteFooter />
</div>

<style>
  .page {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    background: var(--mz-paper);
  }

  main {
    flex: 1;
    display: grid;
    place-items: center;
  }
</style>
