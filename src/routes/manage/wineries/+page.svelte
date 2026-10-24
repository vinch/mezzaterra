<script lang="ts">
  import { onMount } from "svelte";
  import RefCrudPage from "$lib/components/manage/RefCrudPage.svelte";
  import { countryLabel, countryOptions, regionOptions } from "$lib/components/manage/refCrud";
  import { fetchCountries, fetchRegions } from "$lib/manageData";
  import type { Country, Region } from "$lib/types";

  let countries = $state<Country[]>([]);
  let regions = $state<Region[]>([]);
  onMount(async () => {
    [countries, regions] = await Promise.all([fetchCountries(), fetchRegions()]);
  });
</script>

<svelte:head>
  <title>Vignobles - Gestion</title>
</svelte:head>

<RefCrudPage
  title="Vignobles"
  table="winery"
  select="*, country (*), region (*)"
  newLabel="Nouveau vignoble"
  editLabel="Modifier le vignoble"
  thisLabel="ce vignoble"
  emptyText="Les domaines dont Mezzaterra importe les vins."
  fields={[
    { key: "name", label: "Nom du vignoble", required: true },
    { key: "city", label: "Ville" },
    { key: "country_id", label: "Pays", type: "select", options: countryOptions(countries) },
    { key: "region_id", label: "Région", type: "select", options: regionOptions(regions) },
    { key: "latitude", label: "Latitude", type: "number", placeholder: "42.35" },
    { key: "longitude", label: "Longitude", type: "number", placeholder: "13.99" },
    { key: "url", label: "Site web", type: "url", full: true, placeholder: "https://" },
    {
      key: "description",
      label: "Présentation (page publique du domaine)",
      type: "textarea",
      help: "Affichée sur la page du domaine.",
    },
  ]}
  columns={[
    { label: "Nom", value: (w) => w.name },
    { label: "Ville", value: (w) => w.city },
    { label: "Région", value: (w) => w.region?.name },
    { label: "Pays", value: (w) => countryLabel(w.country) },
    { label: "Site web", value: (w) => w.url && "Visiter", href: (w) => w.url },
  ]}
/>
