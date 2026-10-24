<script lang="ts">
  import RefCrudPage from "$lib/components/manage/RefCrudPage.svelte";
</script>

<svelte:head>
  <title>Cépages - Gestion</title>
</svelte:head>

<RefCrudPage
  title="Cépages"
  table="grape"
  newLabel="Nouveau cépage"
  editLabel="Modifier le cépage"
  thisLabel="ce cépage"
  emptyText="Les cépages s’associent ensuite aux millésimes."
  fields={[
    { key: "name", label: "Nom du cépage", required: true, full: true },
    { key: "description", label: "Description", type: "textarea" },
  ]}
  columns={[
    { label: "Nom", value: (g) => g.name },
    { label: "Description", value: (g) => g.description, truncate: 50 },
  ]}
/>
