<script lang="ts">
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { supabase } from "$lib/supabase";
  import type { Database } from "$lib/database.types";
  import WineModal from "$lib/components/WineModal.svelte";

  type Tasting = Database["public"]["Tables"]["tastings"]["Row"];
  type Wine = Database["public"]["Tables"]["wines"]["Row"];
  type Winery = Database["public"]["Tables"]["wineries"]["Row"];
  type Grape = Database["public"]["Tables"]["grapes"]["Row"];

  const tastingId = $page.params.id;

  let tasting: Tasting | null = null;
  let wines: (Wine & {
    winery: Winery | null;
    appelations?: { name: string; labels?: { name: string } | null } | null;
    wines_grapes?: { percentage: number | null; grapes: { name: string } }[];
  })[] = [];
  let loading = true;
  let error: string | null = null;
  let selectedWine: any = null;
  let showModal = false;

  if (!tastingId) {
    error = "No tasting ID provided";
    loading = false;
  }

  onMount(async () => {
    if (!tastingId) return;

    try {
      // Fetch tasting details
      const { data: tastingData, error: tastingError } = await supabase
        .from("tastings")
        .select("*")
        .eq("id", tastingId)
        .single();

      if (tastingError) {
        error = tastingError.message;
        return;
      }

      tasting = tastingData;

      // Fetch wines for this tasting
      const { data: winesData, error: winesError } = await supabase
        .from("tastings_wines")
        .select(
          `
          order,
          wines (
            *,
            wineries (*),
            appelations (
              name,
              labels (name)
            ),
            wines_grapes (
              percentage,
              grapes (name)
            ),
            regions (
              name,
              countries (iso_code, name)
            ),
            wine_tasting_notes (*),
            wines_pairings (
              pairing_id,
              pairings (description)
            )
          )
        `
        )
        .eq("tasting_id", tastingId)
        .order("order");

      if (winesError) {
        console.error("Error fetching wines:", winesError);
      } else {
        wines =
          winesData?.map((item) => ({
            ...item.wines,
            winery: item.wines.wineries,
            wine_tasting_notes: item.wines.wine_tasting_notes,
            wines_pairings: item.wines.wines_pairings,
            regions: item.wines.regions,
          })) || [];

        console.log("Wines data:", wines);
      }
    } catch (err) {
      error = "Failed to load tasting";
    } finally {
      loading = false;
    }
  });

  function openWineModal(wine: any) {
    selectedWine = wine;
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    selectedWine = null;
  }
</script>

<svelte:head>
  <title>{tasting?.name || "Tasting"} - Mezzaterra</title>
</svelte:head>

<div class="container">
  {#if loading}
    <p>Chargement...</p>
  {:else if error}
    <p class="error">Error: {error}</p>
  {:else if !tasting}
    <p>Tasting not found.</p>
  {:else}
    <div class="tasting-header">
      <h1>{tasting.name || "Untitled Tasting"}</h1>
      <div class="tasting-meta">
        <p>
          <strong>Date :</strong>
          {new Date(tasting.date).toLocaleDateString("fr-FR")}
        </p>
        {#if tasting.location}
          <p><strong>Lieu :</strong> {tasting.location}</p>
        {/if}
        {#if tasting.notes}
          <p><strong>Notes :</strong> {tasting.notes}</p>
        {/if}
      </div>
    </div>

    {#if wines.length > 0}
      <div class="wines-section">
        <div class="wines-grid">
          {#each wines as wine, index}
            <div
              class="wine-card"
              onclick={() => openWineModal(wine)}
              onkeypress={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  openWineModal(wine);
                }
              }}
              role="button"
              tabindex="0"
            >
              <div class="wine-order">#{index + 1}</div>
              {#if wine.organic}
                <img src="/organic.png" alt="Organic" class="organic-logo" />
              {/if}
              <div class="wine-info">
                <h2>
                  {#if wine.name}
                    {wine.name}
                  {:else}
                    {wine.appelations?.name || "Unknown Appellation"}
                    {#if wine.appelations?.labels?.name}
                      <span class="label"> {wine.appelations.labels.name}</span>
                    {/if}
                  {/if}
                </h2>
                {#if wine.name && wine.appelations?.name}
                  <p class="appellation">
                    {wine.appelations.name}
                    {#if wine.appelations.labels?.name}
                      <span class="label"> {wine.appelations.labels.name}</span>
                    {/if}
                  </p>
                {/if}
                {#if wine.winery}
                  <p class="winery">{wine.winery.name}</p>
                {/if}
                {#if wine.wines_grapes && wine.wines_grapes.length > 0}
                  <p class="grapes">
                    🍇 {wine.wines_grapes.map((g) => g.grapes.name).join(", ")}
                  </p>
                {/if}
                {#if wine.description}
                  <p class="description">{wine.description}</p>
                {/if}
              </div>
              <div class="wine-details">
                {#if wine.vintage}
                  <span class="vintage-tag">{wine.vintage}</span>
                {/if}
                {#if wine.abv}
                  <span class="abv">{wine.abv}% ABV</span>
                {/if}
                {#if wine.price}
                  <span class="price">€{wine.price}</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {:else}
      <p>No wines found for this tasting.</p>
    {/if}
  {/if}
</div>

{#if showModal && selectedWine}
  <WineModal wine={selectedWine} on:close={closeModal} />
{/if}

<style>
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  .tasting-header {
    margin-bottom: 3rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid #e0e0e0;
  }

  h1 {
    margin: 0 0 1rem 0;
    color: #333;
    font-size: 2.5rem;
    font-family: "Zilla Slab", serif;
    font-weight: 600;
  }

  .tasting-meta {
    color: #666;
  }

  .tasting-meta p {
    margin: 0.5rem 0;
  }

  .wines-section {
    margin-top: 2rem;
  }

  .wines-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1.5rem;
  }

  .wine-card {
    position: relative;
    padding: 1.5rem;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    background: white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 200px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .wine-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }

  .wine-order {
    position: absolute;
    top: -10px;
    left: -10px;
    background: #333;
    color: white;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 0.875rem;
  }

  .organic-logo {
    position: absolute;
    top: 1.5rem;
    right: 1.5rem;
    width: 36px;
    height: 24px;
  }

  .wine-card h2 {
    font-family: "Zilla Slab", serif;
    font-weight: 600;
    margin: 0 0 0.25rem 0;
    color: #333;
    font-size: 1.25rem;
  }

  .appellation {
    margin: 0 0 0.5rem 0;
    color: #888;
    font-size: 0.875rem;
  }

  .label {
    font-weight: 500;
  }

  .winery {
    margin: 0 0 0.5rem 0;
    color: #666;
    font-style: italic;
  }

  .grapes {
    margin: 0.5rem 0 0.5rem 0;
    color: #666;
    font-size: 0.875rem;
  }

  .description {
    margin: 0 0 1rem 0;
    color: #666;
    line-height: 1.4;
  }

  .wine-details {
    display: flex;
    gap: 1rem;
    font-size: 0.875rem;
    color: #888;
  }

  .abv,
  .price,
  .vintage-tag {
    background: #f5f5f5;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  .error {
    color: #d32f2f;
    background: #ffebee;
    padding: 1rem;
    border-radius: 4px;
  }
</style>
