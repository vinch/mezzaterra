<script lang="ts">
  import { onMount } from "svelte";
  import RefCrudPage from "$lib/components/manage/RefCrudPage.svelte";
  import { COUNTRY_COLUMN, countryOptions } from "$lib/components/manage/refCrud";
  import { fetchCountries } from "$lib/manageData";
  import type { Country } from "$lib/types";

  let countries = $state<Country[]>([]);
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
    { label: "Nom", value: (r) => r.name },
    COUNTRY_COLUMN,
  ]}
/>
