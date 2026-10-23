<script lang="ts">
  import { onMount } from "svelte";
  import RefCrudPage from "$lib/components/manage/RefCrudPage.svelte";
  import { contactFields, countryLabel, countryOptions, fetchCountries } from "$lib/manageData";
  import type { Country } from "$lib/types";

  let countries: Country[] = [];
  onMount(async () => (countries = await fetchCountries()));
</script>

<svelte:head>
  <title>Fournisseurs - Gestion</title>
</svelte:head>

<RefCrudPage
  title="Fournisseurs"
  table="supplier"
  select="*, country (*)"
  newLabel="Nouveau fournisseur"
  editLabel="Modifier le fournisseur"
  thisLabel="ce fournisseur"
  emptyText="Les domaines et négociants chez qui passer les commandes."
  fields={contactFields(countryOptions(countries))}
  columns={[
    { label: "Nom", value: (s) => s.name, strong: true },
    { label: "Email", value: (s) => s.email },
    { label: "Téléphone", value: (s) => s.phone_number },
    { label: "Ville", value: (s) => s.city },
    { label: "Pays", value: (s) => countryLabel(s.country) },
    { label: "TVA", value: (s) => s.vat },
  ]}
/>
