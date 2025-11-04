<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import type { PageData } from "./$types";
  import type { WineVintage } from "$lib/types";
  import Modal from "$lib/components/Modal.svelte";

  export let data: PageData;

  let wine = data.wine;
  let vintages: WineVintage[] = [];
  let loading = true;
  let error = "";
  let showModal = false;
  let showEditModal = false;
  let editingVintage: any = null;

  // Vintage form fields
  let vintageFormData = {
    production_year: "",
    year: "",
    abv: "",
    purchase_price: "",
    price: "",
    image_url: "",
    organic: false,
  };

  // Grapes modal state
  let showGrapesModal = false;
  let selectedVintage: any = null;
  let vintageGrapes: any[] = [];
  let allGrapes: any[] = [];
  let selectedGrapeId = "";
  let grapePercentage = "";

  onMount(async () => {
    await loadVintages();
    await loadAllGrapes();
  });

  async function loadAllGrapes() {
    const { data } = await supabase.from("grape").select("*").order("name");
    if (data) allGrapes = data;
  }

  async function loadVintages() {
    loading = true;
    const { data: vintagesData, error: fetchError } = await supabase
      .from("wine_vintage")
      .select("*")
      .eq("wine_id", wine.id)
      .order("production_year", { ascending: false });

    if (fetchError) {
      error = fetchError.message;
    } else {
      vintages = vintagesData || [];
    }
    loading = false;
  }

  function openCreateModal() {
    editingVintage = null;
    resetForm();
    showModal = true;
  }

  function openEditModal(vintage: WineVintage) {
    editingVintage = vintage;
    vintageFormData = {
      production_year: vintage.production_year
        ? vintage.production_year.toString()
        : "",
      year: vintage.year ? vintage.year.toString() : "",
      abv: vintage.abv ? vintage.abv.toString() : "",
      purchase_price: vintage.purchase_price
        ? vintage.purchase_price.toString()
        : "",
      price: vintage.price ? vintage.price.toString() : "",
      image_url: vintage.image_url || "",
      organic: vintage.organic || false,
    };
    showEditModal = true;
  }

  function closeModal() {
    showModal = false;
    editingVintage = null;
    resetForm();
  }

  function closeEditModal() {
    showEditModal = false;
    editingVintage = null;
    resetForm();
  }

  function resetForm() {
    vintageFormData = {
      production_year: "",
      year: "",
      abv: "",
      purchase_price: "",
      price: "",
      image_url: "",
      organic: false,
    };
  }

  async function handleSubmit() {
    if (!vintageFormData.production_year) {
      error = "L'année de production est obligatoire";
      return;
    }

    const vintageData = {
      wine_id: wine.id,
      production_year: parseInt(vintageFormData.production_year),
      year: vintageFormData.year ? parseInt(vintageFormData.year) : null,
      abv: vintageFormData.abv ? parseFloat(vintageFormData.abv) : null,
      purchase_price: vintageFormData.purchase_price
        ? parseFloat(vintageFormData.purchase_price)
        : undefined,
      price: vintageFormData.price ? parseFloat(vintageFormData.price) : null,
      image_url: vintageFormData.image_url || null,
      organic: vintageFormData.organic,
    };

    const { error: insertError } = await supabase
      .from("wine_vintage")
      .insert(vintageData);

    if (insertError) {
      error = insertError.message;
      return;
    }

    closeModal();
    await loadVintages();
  }

  async function handleUpdate() {
    if (!vintageFormData.production_year || !editingVintage) {
      error = "L'année de production est obligatoire";
      return;
    }

    const vintageData = {
      production_year: parseInt(vintageFormData.production_year),
      year: vintageFormData.year ? parseInt(vintageFormData.year) : null,
      abv: vintageFormData.abv ? parseFloat(vintageFormData.abv) : null,
      purchase_price: vintageFormData.purchase_price
        ? parseFloat(vintageFormData.purchase_price)
        : undefined,
      price: vintageFormData.price ? parseFloat(vintageFormData.price) : null,
      image_url: vintageFormData.image_url || null,
      organic: vintageFormData.organic,
    };

    const { error: updateError } = await supabase
      .from("wine_vintage")
      .update(vintageData)
      .eq("id", editingVintage.id);

    if (updateError) {
      error = updateError.message;
      return;
    }

    closeEditModal();
    await loadVintages();
  }

  async function deleteVintage(id: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce millésime ?")) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("wine_vintage")
      .delete()
      .eq("id", id);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    await loadVintages();
  }

  // Grapes modal functions
  async function openGrapesModal(vintage: any) {
    selectedVintage = vintage;
    await loadVintageGrapes();
    showGrapesModal = true;
  }

  async function loadVintageGrapes() {
    if (!selectedVintage) return;

    const { data } = await supabase
      .from("wine_vintage_grape")
      .select(
        `
        grape_id,
        percentage,
        grape (*)
      `
      )
      .eq("wine_vintage_id", selectedVintage.id);

    vintageGrapes = data || [];
  }

  async function addGrape() {
    if (!selectedGrapeId || !selectedVintage) return;

    const { error: insertError } = await supabase
      .from("wine_vintage_grape")
      .insert({
        wine_vintage_id: selectedVintage.id,
        grape_id: selectedGrapeId,
        percentage: grapePercentage ? parseFloat(grapePercentage) : null,
      });

    if (insertError) {
      error = insertError.message;
      return;
    }

    selectedGrapeId = "";
    grapePercentage = "";
    await loadVintageGrapes();
  }

  async function removeGrape(grapeId: string) {
    if (!selectedVintage) return;

    if (!confirm("Êtes-vous sûr de vouloir supprimer ce cépage ?")) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("wine_vintage_grape")
      .delete()
      .eq("wine_vintage_id", selectedVintage.id)
      .eq("grape_id", grapeId);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    await loadVintageGrapes();
  }

  function closeGrapesModal() {
    showGrapesModal = false;
    selectedVintage = null;
    vintageGrapes = [];
    selectedGrapeId = "";
    grapePercentage = "";
  }

  function isGrapeLinked(grapeId: string): boolean {
    return vintageGrapes.some((vg) => vg.grape_id === grapeId);
  }
</script>

<svelte:head>
  <title>Millésimes - {wine.name}</title>
</svelte:head>

<div class="page-container">
  <header class="page-header">
    <div class="breadcrumb">
      <a href="/manage/wines">← Retour aux vins</a>
    </div>
    <div class="wine-info">
      <h1>{wine.name}</h1>
      <div class="wine-details">
        {#if wine.winery}
          <span class="detail-item">
            <strong>Vignoble:</strong>
            {wine.winery.name}
          </span>
        {/if}
        {#if wine.appelation}
          <span class="detail-item">
            <strong>Appellation:</strong>
            {wine.appelation.name}
          </span>
        {/if}
        {#if wine.wine_type}
          <span class="detail-item">
            <strong>Type:</strong>
            {wine.wine_type.name}
          </span>
        {/if}
      </div>
    </div>
    <button class="btn-primary" on:click={openCreateModal}>
      + Nouveau millésime
    </button>
  </header>

  <div class="page-content">
    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    {#if loading}
      <div class="loading">Chargement...</div>
    {:else if vintages.length === 0}
      <div class="empty-state">
        <p>Aucun millésime trouvé pour ce vin</p>
        <button class="btn-primary" on:click={openCreateModal}>
          Créer le premier millésime
        </button>
      </div>
    {:else}
      <div class="vintages-grid">
        {#each vintages as vintage}
          <div class="vintage-card">
            <div class="vintage-body">
              {#if vintage.image_url}
                <div class="vintage-image">
                  <img
                    src={vintage.image_url}
                    alt="Millésime {vintage.production_year}"
                  />
                </div>
              {/if}
              <div class="vintage-content">
                <div class="vintage-header">
                  <h3 class="vintage-year">
                    {vintage.year || `(${vintage.production_year})`}
                  </h3>
                </div>
                <div class="vintage-details">
                  {#if vintage.abv}
                    <span class="vintage-detail">{vintage.abv}% ABV</span>
                  {/if}
                  {#if vintage.price}
                    <span class="vintage-detail">€{vintage.price}</span>
                  {/if}
                  {#if vintage.organic}
                    <span class="vintage-detail organic">Bio</span>
                  {/if}
                </div>
                <div class="vintage-actions">
                  <a
                    href="/manage/wines/{wine.id}/stock/{vintage.id}"
                    class="btn-stock icon-btn"
                    aria-label="Gérer le stock"
                    title="Gérer le stock"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path d="M3 7l9-4 9 4-9 4-9-4z" fill="currentColor" />
                      <path
                        d="M3 7v10l9 4 9-4V7"
                        stroke="currentColor"
                        stroke-width="1.5"
                        fill="none"
                      />
                    </svg>
                  </a>
                  <button
                    class="btn-grapes icon-btn"
                    on:click={() => openGrapesModal(vintage)}
                    aria-label="Gérer les cépages"
                    title="Gérer les cépages"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <circle cx="8" cy="9" r="3" fill="currentColor" />
                      <circle cx="16" cy="9" r="3" fill="currentColor" />
                      <path d="M5 17l3-6h8l3 6v4H5v-4z" fill="currentColor" />
                    </svg>
                  </button>
                  <button
                    class="btn-edit icon-btn"
                    on:click={() => openEditModal(vintage)}
                    aria-label="Modifier"
                    title="Modifier"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"
                        fill="currentColor"
                      />
                      <path
                        d="M20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                  <button
                    class="btn-delete icon-btn"
                    on:click={() => deleteVintage(vintage.id)}
                    aria-label="Supprimer"
                    title="Supprimer"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path d="M9 3h6l1 2h4v2H4V5h4l1-2z" fill="currentColor" />
                      <path d="M6 9h12l-1 11H7L6 9z" fill="currentColor" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Modal de création -->
<Modal
  show={showModal}
  title="Nouveau millésime - {wine.name}"
  modalId="modal-title-create"
  on:close={closeModal}
>
  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-grid">
      <div class="form-group">
        <label for="production_year">Année de production *</label>
        <input
          type="number"
          id="production_year"
          bind:value={vintageFormData.production_year}
          min="1900"
          max="2030"
          required
        />
      </div>

      <div class="form-group">
        <label for="year">Année millésime</label>
        <input
          type="number"
          id="year"
          bind:value={vintageFormData.year}
          min="1900"
          max="2030"
          placeholder="Si le vin est non millésimé, laissez vide"
        />
      </div>

      <div class="form-group">
        <label for="purchase_price">Prix d'achat (€)</label>
        <input
          type="number"
          step="0.01"
          id="purchase_price"
          bind:value={vintageFormData.purchase_price}
          min="0"
          placeholder="Prix auquel vous achetez le vin"
        />
      </div>

      <div class="form-group">
        <label for="price">Prix de vente (€)</label>
        <input
          type="number"
          step="0.01"
          id="price"
          bind:value={vintageFormData.price}
          min="0"
          placeholder="Prix auquel vous vendez le vin"
        />
      </div>

      <div class="form-group">
        <label for="abv">Degré d'alcool (%)</label>
        <input
          type="number"
          step="0.1"
          id="abv"
          bind:value={vintageFormData.abv}
          min="0"
          max="20"
        />
      </div>

      <div class="form-group">
        <label for="image_url">URL de l'image</label>
        <input
          type="url"
          id="image_url"
          bind:value={vintageFormData.image_url}
        />
      </div>

      <div class="form-group full-width">
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={vintageFormData.organic} />
          Vin biologique
        </label>
      </div>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn-secondary" on:click={closeModal}>
        Annuler
      </button>
      <button type="submit" class="btn-primary"> Créer le millésime </button>
    </div>
  </form>
</Modal>

<!-- Modal d'édition -->
<Modal
  show={showEditModal && !!editingVintage}
  title="Modifier le millésime - {wine.name}"
  modalId="modal-title-edit"
  on:close={closeEditModal}
>
  <form on:submit|preventDefault={handleUpdate}>
    <div class="form-grid">
      <div class="form-group">
        <label for="edit-production_year">Année de production *</label>
        <input
          type="number"
          id="edit-production_year"
          bind:value={vintageFormData.production_year}
          min="1900"
          max="2030"
          required
        />
      </div>

      <div class="form-group">
        <label for="edit-year">Année millésime</label>
        <input
          type="number"
          id="edit-year"
          bind:value={vintageFormData.year}
          min="1900"
          max="2030"
          placeholder="Si le vin est non millésimé, laissez vide"
        />
      </div>

      <div class="form-group">
        <label for="edit-purchase_price">Prix d'achat (€)</label>
        <input
          type="number"
          step="0.01"
          id="edit-purchase_price"
          bind:value={vintageFormData.purchase_price}
          min="0"
          placeholder="Prix auquel vous achetez le vin"
        />
      </div>

      <div class="form-group">
        <label for="edit-price">Prix de vente (€)</label>
        <input
          type="number"
          step="0.01"
          id="edit-price"
          bind:value={vintageFormData.price}
          min="0"
          placeholder="Prix auquel vous vendez le vin"
        />
      </div>

      <div class="form-group">
        <label for="edit-abv">Degré d'alcool (%)</label>
        <input
          type="number"
          step="0.1"
          id="edit-abv"
          bind:value={vintageFormData.abv}
          min="0"
          max="20"
        />
      </div>

      <div class="form-group">
        <label for="edit-image_url">URL de l'image</label>
        <input
          type="url"
          id="edit-image_url"
          bind:value={vintageFormData.image_url}
        />
      </div>

      <div class="form-group full-width">
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={vintageFormData.organic} />
          Vin biologique
        </label>
      </div>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn-secondary" on:click={closeEditModal}>
        Annuler
      </button>
      <button type="submit" class="btn-primary">Mettre à jour</button>
    </div>
  </form>
</Modal>

<!-- Grapes Modal -->
<Modal
  show={showGrapesModal}
  title="Gérer les cépages"
  on:close={closeGrapesModal}
>
  <div class="pairings-content">
    <div class="pairings-section">
      <h3>Cépages actuels</h3>
      {#if vintageGrapes.length === 0}
        <p class="empty-text">Aucun cépage ajouté</p>
      {:else}
        <div class="pairings-list">
          {#each vintageGrapes as vintageGrape}
            <div class="pairing-item">
              <span>
                {vintageGrape.grape.name}
                {#if vintageGrape.percentage}
                  <span class="percentage">({vintageGrape.percentage}%)</span>
                {/if}
              </span>
              <button
                class="btn-remove"
                on:click={() => removeGrape(vintageGrape.grape_id)}
              >
                ×
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div class="pairings-section">
      <h3>Ajouter un cépage</h3>
      <div class="add-pairing-form">
        <select
          bind:value={selectedGrapeId}
          disabled={!selectedGrapeId && allGrapes.length === 0}
        >
          <option value="">Sélectionner un cépage</option>
          {#each allGrapes as grape}
            <option value={grape.id} disabled={isGrapeLinked(grape.id)}>
              {grape.name}
              {#if isGrapeLinked(grape.id)}
                (déjà ajouté){/if}
            </option>
          {/each}
        </select>
        <input
          type="number"
          step="0.1"
          min="0"
          max="100"
          placeholder="%"
          bind:value={grapePercentage}
          disabled={!selectedGrapeId || isGrapeLinked(selectedGrapeId)}
        />
        <button class="btn-add" on:click={addGrape} disabled={!selectedGrapeId}>
          Ajouter
        </button>
      </div>
    </div>
  </div>
</Modal>

<style>
  .page-container {
    min-height: 100vh;
  }

  .page-header {
    background: white;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid #e9ecef;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2rem;
  }

  .breadcrumb {
    flex-shrink: 0;
  }

  .breadcrumb a {
    color: #007bff;
    text-decoration: none;
    font-size: 0.9rem;
  }

  .breadcrumb a:hover {
    text-decoration: underline;
  }

  .wine-info {
    flex: 1;
  }

  .wine-info h1 {
    margin: 0 0 0.5rem 0;
    color: #333;
    font-size: 1.75rem;
  }

  .wine-details {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .detail-item {
    font-size: 0.9rem;
    color: #666;
  }

  .page-content {
    padding: 2rem;
  }

  .error-message {
    background: #f8d7da;
    color: #721c24;
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
  }

  .loading {
    text-align: center;
    padding: 2rem;
    color: #666;
  }

  .empty-state {
    background: white;
    padding: 3rem;
    border-radius: 8px;
    text-align: center;
  }

  .empty-state p {
    color: #666;
    margin: 0 0 1rem 0;
  }

  .vintages-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .vintage-card {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .vintage-header {
    padding: 1rem 0;
    border-bottom: 1px solid #e9ecef;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .vintage-body {
    display: flex;
    gap: 1rem;
    align-items: stretch;
    padding: 1rem 1.5rem 1.25rem;
  }

  .vintage-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .vintage-year {
    margin: 0;
    color: #333;
    font-size: 1.2rem;
    font-weight: 600;
  }

  .vintage-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .vintage-details {
    flex: 1;
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    align-content: flex-start;
  }

  .vintage-detail {
    font-size: 0.85rem;
    color: #666;
    background: #f8f9fa;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  .vintage-detail.organic {
    color: #28a745;
    font-weight: 500;
  }

  .vintage-image {
    flex: 0 0 90px; /* largeur fixe pour ratio 1:2 */
    height: 180px;
    border-radius: 6px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .vintage-image img {
    width: 100%;
    height: 100%;
    object-fit: contain; /* afficher la bouteille en entier */
  }

  .btn-primary {
    padding: 0.5rem 1rem;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .btn-primary:hover {
    background: #0056b3;
  }

  .btn-secondary {
    padding: 0.5rem 1rem;
    background: #6c757d;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .btn-secondary:hover {
    background: #5a6268;
  }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border-radius: 10px;
  }

  .icon-btn svg {
    width: 22px;
    height: 22px;
    color: #fff; /* ensure icons are white */
    display: block;
  }

  .btn-edit {
    background: #ffc107;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .btn-edit:hover {
    background: #e0a800;
  }

  .btn-delete {
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .btn-delete:hover {
    background: #c82333;
  }

  .btn-stock {
    background: #17a2b8;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .btn-stock:hover {
    background: #138496;
    color: white;
    text-decoration: none;
  }

  .btn-grapes {
    background: #6f42c1;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .btn-grapes:hover {
    background: #5a32a3;
    color: white;
    text-decoration: none;
  }

  form {
    padding: 1.5rem;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
  }

  .form-group.full-width {
    grid-column: 1 / -1;
  }

  label {
    margin-bottom: 0.5rem;
    color: #333;
    font-weight: 500;
    font-size: 0.9rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-weight: normal;
    margin-bottom: 0;
  }

  .checkbox-label input[type="checkbox"] {
    width: auto;
    margin: 0;
    cursor: pointer;
  }

  input {
    padding: 0.5rem;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 1rem;
  }

  input:focus {
    outline: none;
    border-color: #007bff;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #e9ecef;
  }

  /* Grapes modal styles */
  .pairings-content {
    padding: 1.5rem;
  }

  .pairings-section {
    margin-bottom: 2rem;
  }

  .pairings-section:last-child {
    margin-bottom: 0;
  }

  .pairings-section h3 {
    margin: 0 0 1rem 0;
    color: #333;
    font-size: 1.1rem;
  }

  .empty-text {
    color: #666;
    font-style: italic;
  }

  .pairings-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .pairing-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    background: #f8f9fa;
    border-radius: 4px;
  }

  .percentage {
    color: #666;
    font-weight: normal;
  }

  .btn-remove {
    background: none;
    border: none;
    color: #dc3545;
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0 0.5rem;
    line-height: 1;
  }

  .btn-remove:hover {
    color: #c82333;
  }

  .add-pairing-form {
    display: flex;
    gap: 0.5rem;
  }

  .add-pairing-form select {
    flex: 1;
  }

  .add-pairing-form select option:disabled {
    color: #999;
    font-style: italic;
  }

  .add-pairing-form input {
    width: 80px;
  }

  .btn-add {
    padding: 0.5rem 1rem;
    background: #28a745;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .btn-add:hover:not(:disabled) {
    background: #218838;
  }

  .btn-add:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }
</style>
