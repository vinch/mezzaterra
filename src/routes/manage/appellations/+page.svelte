<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import type { Appelation, Region, Label } from "$lib/types";
  import Modal from "$lib/components/Modal.svelte";

  let appellations: Appelation[] = [];
  let regions: Region[] = [];
  let labels: Label[] = [];
  let loading = true;
  let error = "";
  let showModal = false;
  let editingAppellation: Appelation | null = null;

  // Form fields
  let formData = {
    name: "",
    description: "",
    region_id: "",
    label_id: "",
  };

  onMount(async () => {
    await loadAppellations();
    await loadRegions();
    await loadLabels();
  });

  async function loadAppellations() {
    loading = true;
    const { data, error: fetchError } = await supabase
      .from("appelation")
      .select(
        `
        *,
        region (
          *,
          country (*)
        ),
        label (*)
      `
      )
      .order("name");

    if (fetchError) {
      error = fetchError.message;
    } else {
      appellations = data || [];
    }
    loading = false;
  }

  async function loadRegions() {
    const { data } = await supabase
      .from("region")
      .select(
        `
        *,
        country (*)
      `
      )
      .order("name");
    if (data) regions = data;
  }

  async function loadLabels() {
    const { data } = await supabase.from("label").select("*").order("name");
    if (data) labels = data;
  }

  function openCreateModal() {
    editingAppellation = null;
    resetForm();
    showModal = true;
  }

  function openEditModal(appellation: Appelation) {
    editingAppellation = appellation;
    formData = {
      name: appellation.name,
      description: appellation.description || "",
      region_id: appellation.region_id || "",
      label_id: appellation.label_id || "",
    };
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingAppellation = null;
    resetForm();
  }

  function resetForm() {
    formData = {
      name: "",
      description: "",
      region_id: "",
      label_id: "",
    };
  }

  async function handleSubmit() {
    if (!formData.name) {
      error = "Le nom de l'appellation est obligatoire";
      return;
    }

    const appellationData = {
      name: formData.name,
      description: formData.description || null,
      region_id: formData.region_id || null,
      label_id: formData.label_id || null,
    };

    if (editingAppellation) {
      const { error: updateError } = await supabase
        .from("appelation")
        .update(appellationData)
        .eq("id", editingAppellation.id);

      if (updateError) {
        error = updateError.message;
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("appelation")
        .insert(appellationData);

      if (insertError) {
        error = insertError.message;
        return;
      }
    }

    closeModal();
    await loadAppellations();
  }

  async function deleteAppellation(id: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette appellation ?")) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("appelation")
      .delete()
      .eq("id", id);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    await loadAppellations();
  }
</script>

<svelte:head>
  <title>Appellations - Gestion</title>
</svelte:head>

<div class="page-container">
  <header class="page-header">
    <h1>Appellations</h1>
    <button class="btn-primary" on:click={openCreateModal}>
      + Nouvelle appellation
    </button>
  </header>

  <div class="page-content">
    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    {#if loading}
      <div class="loading">Chargement...</div>
    {:else if appellations.length === 0}
      <div class="empty-state">
        <p>Aucune appellation trouvée</p>
        <button class="btn-primary" on:click={openCreateModal}>
          Créer la première appellation
        </button>
      </div>
    {:else}
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Description</th>
              <th>Région</th>
              <th>Label</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each appellations as appellation}
              <tr>
                <td><strong>{appellation.name}</strong></td>
                <td>
                  {#if appellation.description}
                    <div class="description">{appellation.description}</div>
                  {:else}
                    -
                  {/if}
                </td>
                <td>
                  {#if appellation.region}
                    <div class="region-name">
                      {#if appellation.region.country?.flag}
                        <span class="country-flag"
                          >{appellation.region.country.flag}</span
                        >
                      {/if}
                      {appellation.region.name}
                    </div>
                  {:else}
                    -
                  {/if}
                </td>
                <td>{appellation.label?.name || "-"}</td>
                <td>
                  <div class="actions">
                    <button
                      class="btn-edit"
                      on:click={() => openEditModal(appellation)}
                    >
                      Modifier
                    </button>
                    <button
                      class="btn-delete"
                      on:click={() => deleteAppellation(appellation.id)}
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
  title={editingAppellation ? "Modifier l'appellation" : "Nouvelle appellation"}
  on:close={closeModal}
>
  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-grid">
      <div class="form-group full-width">
        <label for="name">Nom de l'appellation *</label>
        <input type="text" id="name" bind:value={formData.name} required />
      </div>

      <div class="form-group full-width">
        <label for="description">Description</label>
        <textarea id="description" bind:value={formData.description} rows="3"
        ></textarea>
      </div>

      <div class="form-group">
        <label for="region_id">Région</label>
        <select id="region_id" bind:value={formData.region_id}>
          <option value="">Sélectionner une région</option>
          {#each regions as region}
            <option value={region.id}>{region.name}</option>
          {/each}
        </select>
      </div>

      <div class="form-group">
        <label for="label_id">Label</label>
        <select id="label_id" bind:value={formData.label_id}>
          <option value="">Sélectionner un label</option>
          {#each labels as label}
            <option value={label.id}>{label.name}</option>
          {/each}
        </select>
      </div>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn-secondary" on:click={closeModal}>
        Annuler
      </button>
      <button type="submit" class="btn-primary">
        {editingAppellation ? "Mettre à jour" : "Créer"}
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

  .description {
    font-size: 0.9rem;
    color: #666;
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .region-name {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .country-flag {
    font-size: 1.1rem;
    line-height: 1;
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
</style>
