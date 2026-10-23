<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import RefCrudPage from "$lib/components/manage/RefCrudPage.svelte";
  import { sortCustomersByLabel } from "$lib/customerDisplay";
  import { countryLabel, countryOptions, fetchCountries } from "$lib/manageData";
  import type { Country } from "$lib/types";

  let countries: Country[] = [];
  onMount(async () => (countries = await fetchCountries()));
</script>

<svelte:head>
  <title>Clients - Gestion</title>
</svelte:head>

<RefCrudPage
  title="Clients"
  table="customer"
  select="*, country (*)"
  newLabel="Nouveau client"
  editLabel="Modifier le client"
  thisLabel="ce client"
  emptyText="Les clients se créent aussi depuis une vente, une inscription ou une demande « J’en veux »."
  rowLabel={(c) => `${c.first_name} ${c.last_name}`}
  rowHref={(c) => `/manage/customers/${c.id}`}
  sortRows={sortCustomersByLabel}
  editId={$page.url.searchParams.get("modifier")}
  fields={[
    { key: "first_name", label: "Prénom", required: true },
    { key: "last_name", label: "Nom", required: true },
    { key: "email", label: "Email", type: "email" },
    { key: "phone_number", label: "Téléphone", type: "tel" },
    { key: "address_line_1", label: "Adresse ligne 1", full: true },
    { key: "address_line_2", label: "Adresse ligne 2", full: true },
    { key: "zip_code", label: "Code postal" },
    { key: "city", label: "Ville" },
    { key: "country_id", label: "Pays", type: "select", options: countryOptions(countries) },
    { key: "company_name", label: "Entreprise", help: "Client professionnel : nom et TVA figurent sur ses factures." },
    { key: "vat", label: "Numéro de TVA" },
  ]}
  columns={[
    { label: "Nom", value: (c) => `${c.first_name} ${c.last_name}` },
    { label: "Email", value: (c) => c.email },
    { label: "Entreprise", value: (c) => c.company_name },
    { label: "Téléphone", value: (c) => c.phone_number },
    { label: "Ville", value: (c) => c.city },
    { label: "Pays", value: (c) => countryLabel(c.country) },
  ]}
/>
