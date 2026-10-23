<script lang="ts">
  import RefCrudPage from "$lib/components/manage/RefCrudPage.svelte";
</script>

<svelte:head>
  <title>Pays - Gestion</title>
</svelte:head>

<RefCrudPage
  title="Pays"
  table="country"
  newLabel="Nouveau pays"
  editLabel="Modifier le pays"
  thisLabel="ce pays"
  emptyText="Ajoutez les pays des domaines, fournisseurs et clients."
  fields={[
    { key: "name", label: "Nom du pays", required: true },
    { key: "iso_code", label: "Code ISO", required: true, placeholder: "IT" },
    { key: "flag", label: "Drapeau (emoji)", required: true, placeholder: "🇮🇹" },
  ]}
  columns={[
    { label: "Nom", value: (c) => c.name },
    { label: "Code ISO", value: (c) => c.iso_code },
    { label: "Drapeau", value: (c) => c.flag },
  ]}
/>
