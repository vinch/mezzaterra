<script lang="ts">
  import { page } from "$app/stores";
  import ErrorView from "$lib/components/site/ErrorView.svelte";
</script>

<svelte:head>
  <title>Erreur {$page.status} - Gestion</title>
</svelte:head>

<div class="manage-error">
  <ErrorView
    status={$page.status}
    message={$page.error?.message ?? ""}
    links={[
      { href: "/manage", label: "Tableau de bord" },
      { href: "/manage/sales", label: "Ventes" },
    ]}
  />
</div>

<style>
  .manage-error {
    min-height: 70vh;
    display: grid;
    place-items: center;
  }
</style>
