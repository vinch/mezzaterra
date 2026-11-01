<script lang="ts">
  import RefCrudPage from "$lib/components/manage/RefCrudPage.svelte";
</script>

<svelte:head>
  <title>Accords - Gestion</title>
</svelte:head>

<RefCrudPage
  title="Accords"
  table="pairing"
  newLabel="Nouvel accord"
  editLabel="Modifier l’accord"
  thisLabel="cet accord"
  emptyText="Les plats proposés en accord mets & vins sur les fiches des vins."
  rowLabel={(p) => p.description}
  fields={[{ key: "description", label: "Plat", required: true, full: true }]}
  columns={[{ label: "Plat", value: (p) => p.description }]}
/>
