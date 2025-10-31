<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import { supabase } from "$lib/supabase";
  import type { WineVintage, WinePairing } from "$lib/types";

  export let wineVintage: WineVintage | null = null;

  let winePairings: WinePairing[] = [];
  let loadingPairings = false;

  const dispatch = createEventDispatcher();

  onMount(async () => {
    if (wineVintage?.wine?.id) {
      await loadWinePairings();
    }
  });

  async function loadWinePairings() {
    if (!wineVintage?.wine?.id) return;

    loadingPairings = true;
    const { data } = await supabase
      .from("wine_pairing")
      .select(
        `
        *,
        wine (
          *,
          winery (*),
          appelation (*),
          wine_type (*)
        ),
        pairing (*)
      `
      )
      .eq("wine_id", wineVintage.wine.id);

    winePairings = data || [];
    loadingPairings = false;
  }

  function closeModal() {
    dispatch("close");
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      closeModal();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      closeModal();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if wineVintage && wineVintage.wine}
  <div
    class="modal-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="button"
    tabindex="0"
  >
    <div
      class="modal-content"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="0"
    >
      <button class="close-button" onclick={closeModal} aria-label="Fermer">
        ×
      </button>

      <div class="wine-header">
        <div class="wine-layout">
          {#if wineVintage.image_url}
            <div class="wine-image">
              <img
                src={wineVintage.image_url}
                alt={wineVintage.wine.name || "Wine"}
              />
            </div>
          {/if}

          <div class="wine-info">
            <h1>
              {#if wineVintage.wine.name}
                {wineVintage.wine.name}
              {:else}
                {wineVintage.wine.appelation?.name || "Unknown Appellation"}
                {#if wineVintage.wine.appelation?.label?.name}
                  {wineVintage.wine.appelation.label.name}
                {/if}
              {/if}
              {#if wineVintage.organic}
                <img src="/organic.png" alt="Organic" class="organic-logo" />
              {/if}
            </h1>

            {#if wineVintage.wine.name && wineVintage.wine.appelation?.name}
              <p class="appellation">
                {wineVintage.wine.appelation.name}
                {#if wineVintage.wine.appelation.label?.name}
                  {wineVintage.wine.appelation.label.name}
                {/if}
              </p>
            {/if}

            {#if wineVintage.wine.winery}
              <p class="winery">{wineVintage.wine.winery.name}</p>
            {/if}

            {#if wineVintage.wine.winery?.region || wineVintage.wine.winery?.country}
              <p class="region">
                {wineVintage.wine.winery.region?.country?.flag ||
                  wineVintage.wine.winery.country?.flag ||
                  ""}
                {wineVintage.wine.winery.region?.name ||
                  wineVintage.wine.winery.country?.name}
              </p>
            {/if}

            {#if wineVintage.wine_vintage_grape && wineVintage.wine_vintage_grape.length > 0}
              <p class="grapes">
                🍇 {wineVintage.wine_vintage_grape
                  .map(
                    (g) =>
                      g.grape.name + (g.percentage ? ` (${g.percentage}%)` : "")
                  )
                  .join(", ")}
              </p>
            {/if}

            {#if wineVintage.wine.description}
              <p class="description">{wineVintage.wine.description}</p>
            {/if}

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
        </div>
      </div>

      {#if wineVintage.note && wineVintage.note.length > 0}
        <div class="section">
          <h2>Notes de dégustation</h2>
          <div class="tasting-notes">
            {#each ["color", "nose", "mouth", "vinification"] as noteType}
              {@const note = wineVintage.note.find(
                (note: any) => note.type === noteType
              )}
              {#if note}
                <div class="note">
                  <h3>
                    {#if noteType === "color"}
                      Couleur
                    {:else if noteType === "nose"}
                      Nez
                    {:else if noteType === "mouth"}
                      Bouche
                    {:else if noteType === "vinification"}
                      Vinification
                    {/if}
                  </h3>
                  <p>{note.content}</p>
                </div>
              {/if}
            {/each}
          </div>
        </div>
      {/if}

      {#if winePairings.length > 0}
        <div class="section">
          <h2>Accompagnements</h2>
          <div class="pairings">
            {#each winePairings as winePairing}
              <div class="pairing">
                <p>
                  {winePairing.pairing?.description ||
                    "No description available"}
                </p>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 2rem;
  }

  .modal-content {
    background: white;
    border-radius: 12px;
    max-width: 800px;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
    width: 100%;
  }

  .close-button {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: none;
    border: none;
    font-size: 2rem;
    cursor: pointer;
    color: #666;
    z-index: 1;
  }

  .close-button:hover {
    color: #333;
  }

  .wine-header {
    padding: 2rem;
    border-bottom: 1px solid #e0e0e0;
  }

  .wine-layout {
    display: flex;
    gap: 2rem;
    align-items: flex-start;
  }

  .wine-image {
    flex-shrink: 0;
    width: 150px;
  }

  .wine-image img {
    width: 100%;
    height: auto;
    aspect-ratio: 1/2;
    object-fit: contain;
  }

  .wine-info {
    flex: 1;
  }

  .wine-info h1 {
    margin: 0 0 0.5rem 0;
    color: #333;
    font-size: 2rem;
    font-family: "Zilla Slab", serif;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .appellation {
    margin: 0 0 0.5rem 0;
    color: #888;
    font-size: 1rem;
  }

  .winery {
    margin: 0 0 0.5rem 0;
    color: #666;
    font-style: italic;
    font-size: 1.1rem;
  }

  .region {
    margin: 0 0 0.5rem 0;
    color: #666;
    font-size: 1rem;
  }

  .grapes {
    margin: 0.5rem 0 0.5rem 0;
    color: #666;
    font-size: 1rem;
  }

  .description {
    margin: 1rem 0;
    color: #666;
    line-height: 1.6;
  }

  .wine-details {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
    flex-wrap: wrap;
  }

  .vintage-tag,
  .abv,
  .price {
    background: #f5f5f5;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #666;
  }

  .organic-logo {
    width: 36px;
    height: 24px;
  }

  .section {
    padding: 2rem;
    border-bottom: 1px solid #e0e0e0;
  }

  .section:last-child {
    border-bottom: none;
  }

  .section h2 {
    margin: 0 0 1rem 0;
    color: #333;
    font-family: "Zilla Slab", serif;
    font-weight: 600;
    font-size: 1.5rem;
  }

  .tasting-notes,
  .pairings {
    display: grid;
    gap: 1rem;
  }

  .note,
  .pairing {
    padding: 1rem;
    background: #f9f9f9;
    border-radius: 8px;
  }

  .note h3 {
    margin: 0 0 0.5rem 0;
    color: #333;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .note p,
  .pairing p {
    margin: 0;
    color: #666;
    line-height: 1.5;
  }
</style>
