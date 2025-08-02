<script lang="ts">
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import { supabase } from "$lib/supabase";
  import type { WineVintage, Tasting } from "$lib/types";
  import WineModal from "$lib/components/WineModal.svelte";

  const tastingId = $page.params.id;

  let tasting: Tasting | null = null;
  let wineVintages: WineVintage[] = [];
  let loading = true;
  let error: string | null = null;
  let selectedWineVintage: WineVintage | null = null;
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
        .from("tasting")
        .select("*")
        .eq("id", tastingId)
        .single();

      if (tastingError) {
        error = tastingError.message;
        return;
      }

      tasting = tastingData;

      // Fetch wine vintages for this tasting
      const { data: wineVintagesData, error: wineVintagesError } =
        await supabase
          .from("tasting_wine_vintage")
          .select(
            `
          order,
          wine_vintage (
            *,
            wine (
              *,
              winery (*),
              appelation (
                name,
                label (name)
              ),
              wine_pairing (
                pairing_id,
                pairing (description)
              )
            ),
            wine_vintage_grape (
              percentage,
              grape (name)
            ),
            note (*)
          )
        `
          )
          .eq("tasting_id", tastingId)
          .order("order");

      if (wineVintagesError) {
        console.error("Error fetching wine vintages:", wineVintagesError);
      } else {
        wineVintages = (wineVintagesData?.map((item) => item.wine_vintage) ||
          []) as unknown as WineVintage[];

        console.log("Wine vintages data:", wineVintages);
      }
    } catch (err) {
      error = "Failed to load tasting";
    } finally {
      loading = false;
    }
  });

  function openWineModal(wineVintage: WineVintage) {
    selectedWineVintage = wineVintage;
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    selectedWineVintage = null;
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

    {#if wineVintages.length > 0}
      <div class="wines-section">
        <div class="wines-grid">
          {#each wineVintages as wineVintage, index}
            <div
              class="wine-card"
              onclick={() => openWineModal(wineVintage)}
              onkeypress={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  openWineModal(wineVintage);
                }
              }}
              role="button"
              tabindex="0"
            >
              <div class="wine-order">#{index + 1}</div>
              {#if wineVintage.organic}
                <img src="/organic.png" alt="Organic" class="organic-logo" />
              {/if}
              <div class="wine-info">
                <h2>
                  {#if wineVintage.wine.name}
                    {wineVintage.wine.name}
                  {:else}
                    {wineVintage.wine.appelation?.name || "Unknown Appellation"}
                    {#if wineVintage.wine.appelation?.label?.name}
                      <span class="label">
                        {wineVintage.wine.appelation.label.name}</span
                      >
                    {/if}
                  {/if}
                </h2>
                {#if wineVintage.wine.name && wineVintage.wine.appelation?.name}
                  <p class="appellation">
                    {wineVintage.wine.appelation.name}
                    {#if wineVintage.wine.appelation?.label?.name}
                      <span class="label">
                        {wineVintage.wine.appelation.label.name}</span
                      >
                    {/if}
                  </p>
                {/if}
                {#if wineVintage.wine.winery}
                  <p class="winery">{wineVintage.wine.winery.name}</p>
                {/if}
                {#if wineVintage.wine_vintage_grape && wineVintage.wine_vintage_grape.length > 0}
                  <p class="grapes">
                    🍇 {wineVintage.wine_vintage_grape
                      .map((g) => g.grape.name)
                      .join(", ")}
                  </p>
                {/if}
                {#if wineVintage.wine.description}
                  <p class="description">{wineVintage.wine.description}</p>
                {/if}
              </div>
              <div class="wine-details">
                {#if wineVintage.year}
                  <span class="vintage-tag">{wineVintage.year}</span>
                {/if}
                {#if wineVintage.abv}
                  <span class="abv">{wineVintage.abv}% ABV</span>
                {/if}
                {#if wineVintage.price}
                  <span class="price">€{wineVintage.price}</span>
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

{#if showModal && selectedWineVintage}
  <WineModal wineVintage={selectedWineVintage} on:close={closeModal} />
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
