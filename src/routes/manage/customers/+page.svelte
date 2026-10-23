<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import RefCrudPage from "$lib/components/manage/RefCrudPage.svelte";
  import { customerDisplayLabel, sortCustomersByLabel } from "$lib/customerDisplay";
  import { addressFields, countryLabel, countryOptions } from "$lib/components/manage/refCrud";
  import { fetchCountries } from "$lib/manageData";
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
  rowLabel={customerDisplayLabel}
  rowHref={(c) => `/manage/customers/${c.id}`}
  sortRows={sortCustomersByLabel}
  editId={$page.url.searchParams.get("modifier")}
  fields={[
    { key: "first_name", label: "Prénom", required: true },
    { key: "last_name", label: "Nom", required: true },
    ...addressFields(countryOptions(countries)),
    { key: "company_name", label: "Entreprise", help: "Client professionnel : nom et TVA figurent sur ses factures." },
    { key: "vat", label: "Numéro de TVA" },
  ]}
  columns={[
    { label: "Nom", value: (c) => `${c.first_name} ${c.last_name}`.trim() },
    { label: "Email", value: (c) => c.email },
    { label: "Entreprise", value: (c) => c.company_name },
    { label: "Téléphone", value: (c) => c.phone_number },
    { label: "Ville", value: (c) => c.city },
    { label: "Pays", value: (c) => countryLabel(c.country) },
  ]}
/>
