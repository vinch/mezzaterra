<script lang="ts">
  import RefCrudPage from "$lib/components/manage/RefCrudPage.svelte";
</script>

<svelte:head>
  <title>Cépages et variétés - Gestion</title>
</svelte:head>

<!-- Même table pour les cépages des vins et les variétés d'olives des huiles (colonne kind), un onglet chacun. -->
<RefCrudPage
  title="Cépages et variétés"
  table="grape"
  newLabel={(k) => k.newIngredient}
  editLabel="Modifier"
  thisLabel="ce cépage ou cette variété"
  emptyText="Les cépages s’associent ensuite aux millésimes, les variétés d’olives aux lots d’huile."
  kindTabs={(k) => k.ingredients}
  fields={[
    { key: "name", label: "Nom", required: true },
    { key: "description", label: "Description", type: "textarea" },
  ]}
  columns={[
    { label: "Nom", value: (g) => g.name },
    { label: "Description", value: (g) => g.description, truncate: 50 },
  ]}
/>
