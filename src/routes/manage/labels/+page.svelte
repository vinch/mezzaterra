<script lang="ts">
  import { onMount } from "svelte";
  import RefCrudPage from "$lib/components/manage/RefCrudPage.svelte";
  import { countryLabel, countryOptions, fetchCountries } from "$lib/manageData";
  import type { Country } from "$lib/types";

  let countries: Country[] = [];
  onMount(async () => (countries = await fetchCountries()));
</script>

<svelte:head>
  <title>Labels - Gestion</title>
</svelte:head>

<RefCrudPage
  title="Labels"
  table="label"
  select="*, country (*)"
  newLabel="Nouveau label"
  editLabel="Modifier le label"
  thisLabel="ce label"
  emptyText="Les mentions d’appellation : DOC, DOCG, IGT…"
  fields={[
    { key: "name", label: "Nom du label", required: true },
    { key: "country_id", label: "Pays", type: "select", options: countryOptions(countries) },
  ]}
  columns={[
    { label: "Nom", value: (l) => l.name, strong: true },
    { label: "Pays", value: (l) => countryLabel(l.country) },
  ]}
/>
