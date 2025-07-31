<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { Database } from "$lib/database.types";

  type Wine = Database["public"]["Tables"]["wines"]["Row"];
  type Winery = Database["public"]["Tables"]["wineries"]["Row"];
  type Region = Database["public"]["Tables"]["regions"]["Row"];
  type Country = Database["public"]["Tables"]["countries"]["Row"];
  type WineTastingNote =
    Database["public"]["Tables"]["wine_tasting_notes"]["Row"];
  type WinePairing = Database["public"]["Tables"]["wines_pairings"]["Row"];

  export let wine:
    | (Wine & {
        winery: Winery | null;
        appelations?: { name: string; labels?: { name: string } | null } | null;
        wines_grapes?: {
          percentage: number | null;
          grapes: { name: string };
        }[];
        regions?: (Region & { countries?: Country | null }) | null;
        wine_tasting_notes?: WineTastingNote[];
        wines_pairings?: {
          pairing_id: string;
          wine_id: string;
          pairings?: { description: string };
        }[];
      })
    | null = null;

  const dispatch = createEventDispatcher();

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

  // Country flag emoji mapping
  const countryFlags: Record<string, string> = {
    it: "🇮🇹",
  };

  function getCountryFlag(countryCode: string | null): string {
    if (!countryCode) return "";
    return countryFlags[countryCode] || "";
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if wine}
  <div
    class="modal-backdrop"
    onclick={handleBackdropClick}
    onkeydown={(e) => {
      if (e.key === "Escape") {
        closeModal();
      }
    }}
    role="button"
    tabindex="0"
  >
    <div class="modal-content">
      <button
        class="close-button"
        onclick={closeModal}
        onkeydown={(e) => {
          if (e.key === "Escape") {
            closeModal();
          }
        }}>×</button
      >

      <div class="wine-header">
        <div class="wine-layout">
          {#if wine.image_url}
            <div class="wine-image">
              <img src={wine.image_url} alt={wine.name || "Wine"} />
            </div>
          {/if}

          <div class="wine-info">
            <h1>
              {#if wine.name}
                {wine.name}
              {:else}
                {wine.appelations?.name || "Unknown Appellation"}
                {#if wine.appelations?.labels?.name}
                  {wine.appelations.labels.name}
                {/if}
              {/if}
              {#if wine.organic}
                <img src="/organic.png" alt="Organic" class="organic-logo" />
              {/if}
            </h1>

            {#if wine.name && wine.appelations?.name}
              <p class="appellation">
                {wine.appelations.name}
                {#if wine.appelations.labels?.name}
                  {wine.appelations.labels.name}
                {/if}
              </p>
            {/if}

            {#if wine.winery}
              <p class="winery">{wine.winery.name}</p>
            {/if}

            {#if wine.regions?.countries}
              <p class="region">
                {getCountryFlag(wine.regions.countries.iso_code)}
                {wine.regions.name}
              </p>
            {/if}

            {#if wine.wines_grapes && wine.wines_grapes.length > 0}
              <p class="grapes">
                🍇 {wine.wines_grapes.map((g) => g.grapes.name).join(", ")}
              </p>
            {/if}

            {#if wine.description}
              <p class="description">{wine.description}</p>
            {/if}

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
        </div>
      </div>

      {#if wine.wine_tasting_notes && wine.wine_tasting_notes.length > 0}
        <div class="section">
          <h2>Notes de dégustation</h2>
          <div class="tasting-notes">
            {#each ["color", "nose", "mouth", "vinification"] as noteType}
              {@const note = wine.wine_tasting_notes.find(
                (note) => note.type === noteType
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

      {#if wine.wines_pairings && wine.wines_pairings.length > 0}
        <div class="section">
          <h2>Accompagnements</h2>
          <div class="pairings">
            {#each wine.wines_pairings as pairing}
              <div class="pairing">
                <p>
                  {pairing.pairings?.description || "No description available"}
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

  .label {
    font-weight: 500;
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

  .note h3,
  .pairing h3 {
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
