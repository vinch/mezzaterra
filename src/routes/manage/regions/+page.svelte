<script lang="ts">
  import { onMount } from "svelte";
  import RefCrudPage from "$lib/components/manage/RefCrudPage.svelte";
  import { countryLabel, countryOptions, fetchCountries } from "$lib/manageData";
  import type { Country } from "$lib/types";

  let countries: Country[] = [];
  onMount(async () => (countries = await fetchCountries()));
</script>

<svelte:head>
  <title>Régions - Gestion</title>
</svelte:head>

<RefCrudPage
  title="Régions"
  table="region"
  select="*, country (*)"
  newLabel="Nouvelle région"
  editLabel="Modifier la région"
  thisLabel="cette région"
  emptyText="Les régions viticoles des domaines et des appellations."
  fields={[
    { key: "name", label: "Nom de la région", required: true },
    { key: "country_id", label: "Pays", type: "select", options: countryOptions(countries) },
  ]}
  columns={[
    { label: "Nom", value: (r) => r.name, strong: true },
    { label: "Pays", value: (r) => countryLabel(r.country) },
  ]}
/>
