<script lang="ts">
  import { onMount } from "svelte";
  import RefCrudPage from "$lib/components/manage/RefCrudPage.svelte";
  import { COUNTRY_COLUMN, countryOptions, regionOptions } from "$lib/components/manage/refCrud";
  import { fetchCountries, fetchRegions } from "$lib/manageData";
  import type { Country, Region } from "$lib/types";
  import { instagramAccount, producerInstagram } from "$lib/products";

  let countries = $state<Country[]>([]);
  let regions = $state<Region[]>([]);
  onMount(async () => {
    [countries, regions] = await Promise.all([fetchCountries(), fetchRegions()]);
  });
</script>

<svelte:head>
  <title>Domaines - Gestion</title>
</svelte:head>

<RefCrudPage
  title="Domaines"
  table="producer"
  select="*, country (*), region (*)"
  newLabel="Nouveau domaine"
  editLabel="Modifier le domaine"
  thisLabel="ce domaine"
  emptyText="Les domaines dont Mezzaterra importe les vins et les huiles."
  fields={[
    { key: "name", label: "Nom du domaine", required: true },
    { key: "city", label: "Ville" },
    { key: "country_id", label: "Pays", type: "select", options: countryOptions(countries) },
    { key: "region_id", label: "Région", type: "select", options: regionOptions(regions) },
    { key: "latitude", label: "Latitude", type: "number", placeholder: "42.35" },
    { key: "longitude", label: "Longitude", type: "number", placeholder: "13.99" },
    { key: "url", label: "Site web", type: "url", placeholder: "https://" },
    {
      key: "instagram",
      label: "Instagram",
      placeholder: "@compte",
      help: "Le compte ou le lien du profil.",
      normalize: instagramAccount,
      invalid: "Instagram : indiquer le compte (@compte) ou le lien du profil, pas d’une publication.",
    },
    {
      key: "description",
      label: "Présentation (page publique du domaine)",
      type: "textarea",
      help: "Affichée sur la page du domaine.",
    },
    {
      key: "hidden",
      label: "Masqué sur le site public",
      type: "checkbox",
      help: "Pas encore annoncé : absent de la carte, de l’accueil et du catalogue, avec ses produits. Ses pages restent accessibles par lien (dégustations).",
    },
  ]}
  columns={[
    { label: "Nom", value: (w) => w.name },
    { label: "Ville", value: (w) => w.city },
    { label: "Région", value: (w) => w.region?.name },
    COUNTRY_COLUMN,
    { label: "Site web", value: (w) => w.url && "Visiter", href: (w) => w.url },
    { label: "Instagram", value: (w) => producerInstagram(w)?.handle, href: (w) => producerInstagram(w)?.url },
    { label: "Site public", value: (w) => (w.hidden ? "Masqué" : "Visible") },
  ]}
/>
