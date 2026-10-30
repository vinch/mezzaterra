<script lang="ts">
  import { page } from "$app/stores";
  import ErrorView from "$lib/components/site/ErrorView.svelte";
  import { kindBySlug, PRODUCT_KINDS } from "$lib/productKinds";

  /* Liens adaptés à l'endroit où l'on s'est perdu. */
  let path = $derived($page.url.pathname);
  let catalogKind = $derived(kindBySlug(path.split("/")[1] ?? ""));
  let catalog = $derived(catalogKind ? PRODUCT_KINDS[catalogKind] : null);
  let links = $derived(catalog
    ? [
        { href: `/${catalog.slug}`, label: catalog.catalogTitle },
        { href: "/", label: "Accueil" },
      ]
    : path.startsWith("/tastings")
      ? [
          { href: "/tastings", label: "Toutes les dégustations" },
          { href: "/", label: "Accueil" },
        ]
      : [
          { href: "/", label: "Retour à l’accueil" },
          { href: "/vins", label: "Nos vins" },
        ]);
</script>

<svelte:head>
  <title>{$page.status === 404 ? "Page introuvable" : "Erreur"} — Mezzaterra</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<ErrorView status={$page.status} message={$page.error?.message ?? ""} {links} />
