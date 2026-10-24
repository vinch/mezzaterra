<script lang="ts">
  import { onMount } from "svelte";
  import RefCrudPage from "$lib/components/manage/RefCrudPage.svelte";
  import { CONTACT_COLUMNS, contactFields, countryOptions } from "$lib/components/manage/refCrud";
  import { fetchCountries } from "$lib/manageData";
  import type { Country } from "$lib/types";

  let countries: Country[] = [];
  onMount(async () => (countries = await fetchCountries()));
</script>

<svelte:head>
  <title>Transporteurs - Gestion</title>
</svelte:head>

<RefCrudPage
  title="Transporteurs"
  table="transporter"
  select="*, country (*)"
  newLabel="Nouveau transporteur"
  editLabel="Modifier le transporteur"
  thisLabel="ce transporteur"
  emptyText="Les transporteurs qui acheminent les commandes."
  fields={contactFields(countryOptions(countries))}
  columns={CONTACT_COLUMNS}
/>
