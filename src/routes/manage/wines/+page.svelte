<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import type { Wine, Winery, Appelation, WineType } from "$lib/types";
  import Modal from "$lib/components/Modal.svelte";

  let wines: Wine[] = [];
  let wineries: Winery[] = [];
  let appellations: Appelation[] = [];
  let wineTypes: WineType[] = [];
  let loading = true;
  let error = "";
  let showModal = false;
  let editingWine: Wine | null = null;

  // Pairings modal state
  let showPairingsModal = false;
  let selectedWine: Wine | null = null;
  let winePairings: any[] = [];
  let allPairings: any[] = [];
  let selectedPairingId = "";

  // Form fields
  let formData = {
    name: "",
    description: "",
    winery_id: "",
    appelation_id: "",
    wine_type_id: "",
  };

  onMount(async () => {
    await loadWines();
    await loadWineries();
    await loadAppellations();
    await loadWineTypes();
    await loadAllPairings();
  });

  async function loadAllPairings() {
    const { data } = await supabase
      .from("pairing")
      .select("*")
      .order("description");
    if (data) allPairings = data;
  }

  async function loadWines() {
    loading = true;
    const { data, error: fetchError } = await supabase
      .from("wine")
      .select(
        `
        *,
        winery (
          *,
          region (
            *,
            country (*)
          ),
          country (*)
        ),
        appelation (
          *,
          region (
            *,
            country (*)
          ),
          label (*)
        ),
        wine_type (*),
        wine_vintage (*)
      `
      )
      .order("created_at", { ascending: false });

    if (fetchError) {
      error = fetchError.message;
    } else {
      wines = (data || []).sort((a, b) => {
        // First: sort by winery name
        const wineryA = a.winery?.name?.toLowerCase() || "";
        const wineryB = b.winery?.name?.toLowerCase() || "";
        if (wineryA !== wineryB) {
          return wineryA.localeCompare(wineryB);
        }

        // Second: sort by wine name or appellation
        const wineNameA =
          a.name?.toLowerCase() || a.appelation?.name?.toLowerCase() || "";
        const wineNameB =
          b.name?.toLowerCase() || b.appelation?.name?.toLowerCase() || "";
        return wineNameA.localeCompare(wineNameB);
      });
    }
    loading = false;
  }

  async function loadWineries() {
    const { data } = await supabase
      .from("winery")
      .select(
        `
        *,
        region (
          *,
          country (*)
        ),
        country (*)
      `
      )
      .order("name");
    if (data) wineries = data;
  }

  async function loadAppellations() {
    const { data } = await supabase
      .from("appelation")
      .select(
        `
        *,
        label (*),
        region (
          *,
          country (*)
        )
      `
      )
      .order("name");
    if (data) appellations = data;
  }

  async function loadWineTypes() {
    const { data } = await supabase.from("wine_type").select("*").order("name");
    if (data) wineTypes = data;
  }

  function openCreateModal() {
    editingWine = null;
    resetForm();
    showModal = true;
  }

  function openEditModal(wine: Wine) {
    editingWine = wine;
    formData = {
      name: wine.name || "",
      description: wine.description || "",
      winery_id: wine.winery_id || "",
      appelation_id: wine.appelation_id || "",
      wine_type_id: wine.wine_type_id || "",
    };
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingWine = null;
    resetForm();
  }

  function resetForm() {
    formData = {
      name: "",
      description: "",
      winery_id: "",
      appelation_id: "",
      wine_type_id: "",
    };
  }

  async function handleSubmit() {
    if (!formData.winery_id || !formData.wine_type_id) {
      error = "Nom, vignoble et type de vin sont obligatoires";
      return;
    }

    const wineData = {
      name: formData.name || null,
      description: formData.description || null,
      winery_id: formData.winery_id,
      appelation_id: formData.appelation_id,
      wine_type_id: formData.wine_type_id,
    };

    if (editingWine) {
      const { error: updateError } = await supabase
        .from("wine")
        .update(wineData)
        .eq("id", editingWine.id);

      if (updateError) {
        error = updateError.message;
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("wine")
        .insert(wineData);

      if (insertError) {
        error = insertError.message;
        return;
      }
    }

    closeModal();
    await loadWines();
  }

  async function deleteWine(id: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce vin ?")) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("wine")
      .delete()
      .eq("id", id);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    await loadWines();
  }

  // Pairings modal functions
  async function openPairingsModal(wine: Wine) {
    selectedWine = wine;
    await loadWinePairings();
    showPairingsModal = true;
  }

  async function loadWinePairings() {
    if (!selectedWine) return;

    const { data } = await supabase
      .from("wine_pairing")
      .select(
        `
        pairing_id,
        pairing (*)
      `
      )
      .eq("wine_id", selectedWine.id);

    winePairings = data || [];
  }

  async function addPairing() {
    if (!selectedPairingId || !selectedWine) return;

    const { error: insertError } = await supabase.from("wine_pairing").insert({
      wine_id: selectedWine.id,
      pairing_id: selectedPairingId,
    });

    if (insertError) {
      error = insertError.message;
      return;
    }

    selectedPairingId = "";
    await loadWinePairings();
  }

  async function removePairing(pairingId: string) {
    if (!selectedWine) return;

    if (!confirm("Êtes-vous sûr de vouloir supprimer ce pairing ?")) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("wine_pairing")
      .delete()
      .eq("wine_id", selectedWine.id)
      .eq("pairing_id", pairingId);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    await loadWinePairings();
  }

  function closePairingsModal() {
    showPairingsModal = false;
    selectedWine = null;
    winePairings = [];
    selectedPairingId = "";
  }

  function isPairingLinked(pairingId: string): boolean {
    return winePairings.some((wp) => wp.pairing_id === pairingId);
  }
</script>

<svelte:head>
  <title>Vins - Gestion</title>
</svelte:head>

<div class="page-container">
  <header class="page-header">
    <h1>Vins</h1>
    <button class="btn-primary" on:click={openCreateModal}>
      + Nouveau vin
    </button>
  </header>

  <div class="page-content">
    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    {#if loading}
      <div class="loading">Chargement...</div>
    {:else if wines.length === 0}
      <div class="empty-state">
        <p>Aucun vin trouvé</p>
        <button class="btn-primary" on:click={openCreateModal}>
          Créer le premier vin
        </button>
      </div>
    {:else}
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Vignoble</th>
              <th>Nom</th>
              <th>Appellation</th>
              <th>Type</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each wines as wine}
              <tr>
                <td>{wine.winery?.name || "-"}</td>
                <td><strong>{wine.name || "-"}</strong></td>
                <td>{wine.appelation?.name || "-"}</td>
                <td>{wine.wine_type?.name || "-"}</td>
                <td>
                  {#if wine.description}
                    <span class="description-text" title={wine.description}>
                      {wine.description.length > 50
                        ? wine.description.substring(0, 50) + "..."
                        : wine.description}
                    </span>
                  {:else}
                    -
                  {/if}
                </td>
                <td>
                  <div class="actions">
                    <a href="/manage/wines/{wine.id}" class="btn-vintages">
                      Millésimes
                    </a>
                    <button
                      class="btn-pairings"
                      on:click={() => openPairingsModal(wine)}
                    >
                      Pairings
                    </button>
                    <button
                      class="btn-edit"
                      on:click={() => openEditModal(wine)}
                    >
                      Modifier
                    </button>
                    <button
                      class="btn-delete"
                      on:click={() => deleteWine(wine.id)}
                    >
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<Modal
  show={showModal}
  title={editingWine ? "Modifier le vin" : "Nouveau vin"}
  on:close={closeModal}
>
  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-grid">
      <div class="form-group full-width">
        <label for="name">Nom du vin</label>
        <input type="text" id="name" bind:value={formData.name} />
      </div>

      <div class="form-group full-width">
        <label for="description">Description</label>
        <textarea id="description" bind:value={formData.description} rows="3"
        ></textarea>
      </div>

      <div class="form-group">
        <label for="winery_id">Vignoble *</label>
        <select id="winery_id" bind:value={formData.winery_id} required>
          <option value="">Sélectionner un vignoble</option>
          {#each wineries as winery}
            <option value={winery.id}>{winery.name}</option>
          {/each}
        </select>
      </div>

      <div class="form-group">
        <label for="appelation_id">Appellation</label>
        <select id="appelation_id" bind:value={formData.appelation_id}>
          <option value="">Sélectionner une appellation</option>
          {#each appellations as appelation}
            <option value={appelation.id}>{appelation.name}</option>
          {/each}
        </select>
      </div>

      <div class="form-group">
        <label for="wine_type_id">Type de vin *</label>
        <select id="wine_type_id" bind:value={formData.wine_type_id} required>
          <option value="">Sélectionner un type</option>
          {#each wineTypes as wineType}
            <option value={wineType.id}>{wineType.name}</option>
          {/each}
        </select>
      </div>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn-secondary" on:click={closeModal}>
        Annuler
      </button>
      <button type="submit" class="btn-primary">
        {editingWine ? "Mettre à jour" : "Créer"}
      </button>
    </div>
  </form>
</Modal>

<!-- Pairings Modal -->
<Modal
  show={showPairingsModal}
  title="Gérer les pairings"
  on:close={closePairingsModal}
>
  <div class="pairings-content">
    <div class="pairings-section">
      <h3>Pairings actuels</h3>
      {#if winePairings.length === 0}
        <p class="empty-text">Aucun pairing ajouté</p>
      {:else}
        <div class="pairings-list">
          {#each winePairings as winePairing}
            <div class="pairing-item">
              <span>{winePairing.pairing.description}</span>
              <button
                class="btn-remove"
                on:click={() => removePairing(winePairing.pairing_id)}
              >
                ×
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div class="pairings-section">
      <h3>Ajouter un pairing</h3>
      <div class="add-pairing-form">
        <select
          bind:value={selectedPairingId}
          disabled={!selectedPairingId && allPairings.length === 0}
        >
          <option value="">Sélectionner un pairing</option>
          {#each allPairings as pairing}
            <option value={pairing.id} disabled={isPairingLinked(pairing.id)}>
              {pairing.description}
              {#if isPairingLinked(pairing.id)}
                (déjà ajouté){/if}
            </option>
          {/each}
        </select>
        <button
          class="btn-add"
          on:click={addPairing}
          disabled={!selectedPairingId}
        >
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
    align-items: center;
  }

  .page-header h1 {
    margin: 0;
    color: #333;
    font-size: 1.75rem;
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

  .table-container {
    background: white;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  thead {
    background: #f8f9fa;
  }

  th {
    padding: 1rem;
    text-align: left;
    font-weight: 600;
    color: #333;
    border-bottom: 2px solid #dee2e6;
  }

  td {
    padding: 1rem;
    border-bottom: 1px solid #e9ecef;
  }

  tbody tr:hover {
    background: #f8f9fa;
  }

  .description-text {
    font-size: 0.9rem;
    color: #666;
    cursor: help;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
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

  .btn-edit {
    padding: 0.4rem 0.8rem;
    background: #ffc107;
    color: #333;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .btn-edit:hover {
    background: #e0a800;
  }

  .btn-delete {
    padding: 0.4rem 0.8rem;
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

  .btn-vintages {
    padding: 0.4rem 0.8rem;
    background: #28a745;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    text-decoration: none;
    display: inline-block;
  }

  .btn-vintages:hover {
    background: #218838;
    color: white;
    text-decoration: none;
  }

  .btn-pairings {
    padding: 0.4rem 0.8rem;
    background: #17a2b8;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    text-decoration: none;
    display: inline-block;
  }

  .btn-pairings:hover {
    background: #138496;
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

  input,
  select,
  textarea {
    padding: 0.5rem;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 1rem;
  }

  input:focus,
  select:focus,
  textarea:focus {
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

  /* Pairings modal styles */
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
