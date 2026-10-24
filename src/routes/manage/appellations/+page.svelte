<script lang="ts">
  import { onMount } from "svelte";
  import { supabase } from "$lib/supabase";
  import RefCrudPage from "$lib/components/manage/RefCrudPage.svelte";
  import { regionOptions } from "$lib/components/manage/refCrud";
  import { fetchRegions } from "$lib/manageData";
  import type { Label, Region } from "$lib/types";

  let regions: Region[] = [];
  let labels: Label[] = [];
  onMount(async () => {
    const [r, { data }] = await Promise.all([fetchRegions(), supabase.from("label").select("*").order("name")]);
    regions = r;
    labels = data || [];
  });

  $: labelOptions = labels.map((l) => ({ value: l.id, label: l.name }));
</script>

<svelte:head>
  <title>Appellations - Gestion</title>
</svelte:head>

<RefCrudPage
  title="Appellations"
  table="appelation"
  select="*, region ( *, country (*) ), label (*)"
  newLabel="Nouvelle appellation"
  editLabel="Modifier l’appellation"
  thisLabel="cette appellation"
  emptyText="Les appellations rattachent les vins à une région et un label."
  fields={[
    { key: "name", label: "Nom de l’appellation", required: true, full: true },
    { key: "region_id", label: "Région", type: "select", options: regionOptions(regions) },
    { key: "label_id", label: "Label", type: "select", options: labelOptions },
    { key: "description", label: "Description", type: "textarea" },
  ]}
  columns={[
    { label: "Nom", value: (a) => a.name },
    { label: "Description", value: (a) => a.description, truncate: 60 },
    { label: "Région", value: (a) => a.region && [a.region.country?.flag, a.region.name].filter(Boolean).join(" ") },
    { label: "Label", value: (a) => a.label?.name },
  ]}
/>
