<script lang="ts">
  import RefCrudPage from "$lib/components/manage/RefCrudPage.svelte";
  import { KIND_COLUMN, KIND_FIELD } from "$lib/components/manage/refCrud";
</script>

<svelte:head>
  <title>Cépages et variétés - Gestion</title>
</svelte:head>

<!-- Même table pour les cépages des vins et les variétés d'olives des huiles (colonne kind). -->
<RefCrudPage
  title="Cépages et variétés"
  table="grape"
  newLabel="Nouveau cépage ou variété"
  editLabel="Modifier"
  thisLabel="ce cépage ou cette variété"
  emptyText="Les cépages s’associent ensuite aux millésimes, les variétés d’olives aux récoltes."
  fields={[
    { key: "name", label: "Nom", required: true },
    KIND_FIELD,
    { key: "description", label: "Description", type: "textarea" },
  ]}
  columns={[
    { label: "Nom", value: (g) => g.name },
    KIND_COLUMN,
    { label: "Description", value: (g) => g.description, truncate: 50 },
  ]}
/>
