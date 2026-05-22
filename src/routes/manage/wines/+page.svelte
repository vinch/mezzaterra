<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import type { Wine, Winery, Appelation, WineType } from "$lib/types";
  import Modal from "$lib/components/Modal.svelte";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";

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

  // Filter state
  let filterWineryId = "";
  let filterAppelationId = "";
  let filterWineTypeId = "";
  let searchText = "";

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

    const wineData: any = {
      name: formData.name || null,
      description: formData.description || null,
      winery_id: formData.winery_id,
      wine_type_id: formData.wine_type_id,
    };

    // Include appelation_id only if it has a value, or set to null to clear it
    if (editingWine) {
      // For updates, set to null if empty to allow clearing the appellation
      wineData.appelation_id = formData.appelation_id || null;
    } else {
      // For inserts, only include if it has a value
      if (formData.appelation_id) {
        wineData.appelation_id = formData.appelation_id;
      }
    }

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

  // Filter wines based on selected filters
  $: filteredWines = wines.filter((wine) => {
    // Filter by winery
    if (filterWineryId && wine.winery_id !== filterWineryId) {
      return false;
    }

    // Filter by appellation
    if (filterAppelationId && wine.appelation_id !== filterAppelationId) {
      return false;
    }

    // Filter by wine type
    if (filterWineTypeId && wine.wine_type_id !== filterWineTypeId) {
      return false;
    }

    // Filter by search text (vignoble, nom, appellation)
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      const wineryName = wine.winery?.name?.toLowerCase() || "";
      const wineName = wine.name?.toLowerCase() || "";
      const appelationName = wine.appelation?.name?.toLowerCase() || "";
      const appelationLabel = wine.appelation?.label?.name?.toLowerCase() || "";

      const matchesSearch =
        wineryName.includes(searchLower) ||
        wineName.includes(searchLower) ||
        appelationName.includes(searchLower) ||
        appelationLabel.includes(searchLower);

      if (!matchesSearch) {
        return false;
      }
    }

    return true;
  });

  function clearFilters() {
    filterWineryId = "";
    filterAppelationId = "";
    filterWineTypeId = "";
    searchText = "";
  }
</script>

<svelte:head>
  <title>Vins - Gestion</title>
</svelte:head>

<ManagePageShell title="Vins">
  <svelte:fragment slot="actions">
    <button type="button" class="btn-primary" on:click={openCreateModal}>
      + Nouveau vin
    </button>
  </svelte:fragment>

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
      <div class="filters-container">
        <div class="filters">
          <div class="filter-group">
            <label for="search-text">Recherche</label>
            <input
              type="text"
              id="search-text"
              placeholder="Rechercher dans vignoble, nom, appellation..."
              bind:value={searchText}
            />
          </div>
          <div class="filter-group">
            <label for="filter-winery">Vignoble</label>
            <select id="filter-winery" bind:value={filterWineryId}>
              <option value="">Tous les vignobles</option>
              {#each wineries as winery}
                <option value={winery.id}>{winery.name}</option>
              {/each}
            </select>
          </div>
          <div class="filter-group">
            <label for="filter-appelation">Appellation</label>
            <select id="filter-appelation" bind:value={filterAppelationId}>
              <option value="">Toutes les appellations</option>
              {#each appellations as appelation}
                <option value={appelation.id}>
                  {appelation.name}
                  {#if appelation.label?.name}
                    {" " + appelation.label.name}
                  {/if}
                </option>
              {/each}
            </select>
          </div>
          <div class="filter-group">
            <label for="filter-wine-type">Type de vin</label>
            <select id="filter-wine-type" bind:value={filterWineTypeId}>
              <option value="">Tous les types</option>
              {#each wineTypes as wineType}
                <option value={wineType.id}>{wineType.name}</option>
              {/each}
            </select>
          </div>
          <div class="filter-group">
            <button class="btn-secondary" on:click={clearFilters}>
              Réinitialiser
            </button>
          </div>
        </div>
      </div>

      {#if filteredWines.length === 0}
        <div class="empty-state">
          <p>Aucun vin ne correspond aux filtres sélectionnés</p>
          <button class="btn-secondary" on:click={clearFilters}>
            Réinitialiser les filtres
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
                <th>Millésimes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredWines as wine}
                <tr>
                  <td>{wine.winery?.name || "-"}</td>
                  <td><strong>{wine.name || "-"}</strong></td>
                  <td>
                    {#if wine.appelation}
                      {wine.appelation.name || "-"}
                      {#if wine.appelation.label?.name}
                        {" " + wine.appelation.label.name}
                      {/if}
                    {:else}
                      -
                    {/if}
                  </td>
                  <td>{wine.wine_type?.name || "-"}</td>
                  <td>
                    {(wine as any).wine_vintage?.length || 0}
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
    {/if}
</ManagePageShell>

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
            <option value={appelation.id}>
              {appelation.name}
              {#if appelation.label?.name}
                {" " + appelation.label.name}
              {/if}
            </option>
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
