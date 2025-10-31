<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import type { Region, Country } from "$lib/types";
  import Modal from "$lib/components/Modal.svelte";

  let regions: Region[] = [];
  let countries: Country[] = [];
  let loading = true;
  let error = "";
  let showModal = false;
  let editingRegion: Region | null = null;

  // Form fields
  let formData = {
    name: "",
    country_id: "",
  };

  onMount(async () => {
    await loadRegions();
    await loadCountries();
  });

  async function loadRegions() {
    loading = true;
    const { data, error: fetchError } = await supabase
      .from("region")
      .select(
        `
        *,
        country (*)
      `
      )
      .order("name");

    if (fetchError) {
      error = fetchError.message;
    } else {
      regions = data || [];
    }
    loading = false;
  }

  async function loadCountries() {
    const { data } = await supabase.from("country").select("*").order("name");
    if (data) countries = data;
  }

  function openCreateModal() {
    editingRegion = null;
    resetForm();
    showModal = true;
  }

  function openEditModal(region: Region) {
    editingRegion = region;
    formData = {
      name: region.name,
      country_id: region.country_id || "",
    };
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingRegion = null;
    resetForm();
  }

  function resetForm() {
    formData = {
      name: "",
      country_id: "",
    };
  }

  async function handleSubmit() {
    if (!formData.name) {
      error = "Le nom de la région est obligatoire";
      return;
    }

    const regionData = {
      name: formData.name,
      country_id: formData.country_id || null,
    };

    if (editingRegion) {
      const { error: updateError } = await supabase
        .from("region")
        .update(regionData)
        .eq("id", editingRegion.id);

      if (updateError) {
        error = updateError.message;
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("region")
        .insert(regionData);

      if (insertError) {
        error = insertError.message;
        return;
      }
    }

    closeModal();
    await loadRegions();
  }

  async function deleteRegion(id: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette région ?")) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("region")
      .delete()
      .eq("id", id);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    await loadRegions();
  }
</script>

<svelte:head>
  <title>Régions - Gestion</title>
</svelte:head>

<div class="page-container">
  <header class="page-header">
    <h1>Régions</h1>
    <button class="btn-primary" on:click={openCreateModal}>
      + Nouvelle région
    </button>
  </header>

  <div class="page-content">
    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    {#if loading}
      <div class="loading">Chargement...</div>
    {:else if regions.length === 0}
      <div class="empty-state">
        <p>Aucune région trouvée</p>
        <button class="btn-primary" on:click={openCreateModal}>
          Créer la première région
        </button>
      </div>
    {:else}
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Pays</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each regions as region}
              <tr>
                <td><strong>{region.name}</strong></td>
                <td>
                  {#if region.country}
                    <span>{region.country.flag} {region.country.name}</span>
                  {:else}
                    -
                  {/if}
                </td>
                <td class="actions">
                  <button
                    class="btn-edit"
                    on:click={() => openEditModal(region)}
                  >
                    Modifier
                  </button>
                  <button
                    class="btn-delete"
                    on:click={() => deleteRegion(region.id)}
                  >
                    Supprimer
                  </button>
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
  title={editingRegion ? "Modifier la région" : "Nouvelle région"}
  on:close={closeModal}
>
  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-grid">
      <div class="form-group full-width">
        <label for="name">Nom de la région *</label>
        <input type="text" id="name" bind:value={formData.name} required />
      </div>

      <div class="form-group full-width">
        <label for="country_id">Pays</label>
        <select id="country_id" bind:value={formData.country_id}>
          <option value="">Sélectionner un pays</option>
          {#each countries as country}
            <option value={country.id}>
              {country.flag}
              {country.name}
            </option>
          {/each}
        </select>
      </div>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn-secondary" on:click={closeModal}>
        Annuler
      </button>
      <button type="submit" class="btn-primary">
        {editingRegion ? "Mettre à jour" : "Créer"}
      </button>
    </div>
  </form>
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

  form {
    padding: 1.5rem;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr;
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
  select {
    padding: 0.5rem;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 1rem;
  }

  input:focus,
  select:focus {
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
</style>
