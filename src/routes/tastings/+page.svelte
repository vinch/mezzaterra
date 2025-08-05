<script lang="ts">
  import type { Tasting } from "$lib/types";

  // Get data from the load function
  export let data;

  const { tastings, error } = data;
</script>

<svelte:head>
  <title>Dégustations - Mezzaterra</title>
</svelte:head>

<div class="container">
  <h1>Dégustations</h1>

  {#if error}
    <p class="error">Error: {error}</p>
  {:else if tastings.length === 0}
    <p>Pas de dégustations trouvées.</p>
  {:else}
    <div class="tastings-grid">
      {#each tastings as tasting}
        <a href="/tastings/{tasting.id}" class="tasting-card">
          <h3>{tasting.name || "Untitled Tasting"}</h3>
          <div class="tasting-meta">
            <span
              >Date : {new Date(tasting.date).toLocaleDateString("fr-FR")}</span
            >
            {#if tasting.location}
              <span>Lieu : {tasting.location}</span>
            {/if}
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  h1 {
    margin: 0 0 2rem 0;
    color: #333;
    font-size: 2.5rem;
    font-family: "Zilla Slab", serif;
    font-weight: 600;
  }

  .tastings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .tasting-card {
    display: block;
    padding: 1.5rem;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    text-decoration: none;
    color: inherit;
    background: white;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .tasting-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }

  .tasting-card h3 {
    margin: 0 0 0.5rem 0;
    color: #333;
  }

  .tasting-card p {
    margin: 0 0 1rem 0;
    color: #666;
    line-height: 1.4;
  }

  .tasting-meta {
    font-size: 0.875rem;
    color: #888;
  }

  .error {
    color: #d32f2f;
    background: #ffebee;
    padding: 1rem;
    border-radius: 4px;
  }
</style>
