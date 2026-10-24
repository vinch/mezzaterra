<script lang="ts">
  import { page } from "$app/stores";
  import ErrorView from "$lib/components/site/ErrorView.svelte";

  /* Liens adaptés à l'endroit où l'on s'est perdu. */
  let path = $derived($page.url.pathname);
  let links = $derived(path.startsWith("/vins")
    ? [
        { href: "/vins", label: "Toute la cave" },
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
