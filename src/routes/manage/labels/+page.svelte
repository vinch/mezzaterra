<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import type { Label, Country } from "$lib/types";
  import Modal from "$lib/components/Modal.svelte";

  let labels: Label[] = [];
  let countries: Country[] = [];
  let loading = true;
  let error = "";
  let showModal = false;
  let editingLabel: any = null;

  // Form fields
  let formData = {
    name: "",
    country_id: "",
  };

  onMount(async () => {
    await loadLabels();
    await loadCountries();
  });

  async function loadLabels() {
    loading = true;
    const { data, error: fetchError } = await supabase
      .from("label")
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
      labels = data || [];
    }
    loading = false;
  }

  async function loadCountries() {
    const { data } = await supabase.from("country").select("*").order("name");
    if (data) countries = data;
  }

  function openCreateModal() {
    editingLabel = null;
    resetForm();
    showModal = true;
  }

  function openEditModal(label: Label) {
    editingLabel = label;
    formData = {
      name: label.name,
      country_id: label.country_id || "",
    };
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingLabel = null;
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
      error = "Le nom du label est obligatoire";
      return;
    }

    const labelData = {
      name: formData.name,
      country_id: formData.country_id || null,
    };

    if (editingLabel) {
      const { error: updateError } = await supabase
        .from("label")
        .update(labelData)
        .eq("id", editingLabel.id);

      if (updateError) {
        error = updateError.message;
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("label")
        .insert(labelData);

      if (insertError) {
        error = insertError.message;
        return;
      }
    }

    closeModal();
    await loadLabels();
  }

  async function deleteLabel(id: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce label ?")) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("label")
      .delete()
      .eq("id", id);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    await loadLabels();
  }
</script>

<svelte:head>
  <title>Labels - Gestion</title>
</svelte:head>

<div class="page-container">
  <header class="page-header">
    <h1>Labels</h1>
    <button class="btn-primary" on:click={openCreateModal}>
      + Nouveau label
    </button>
  </header>

  <div class="page-content">
    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    {#if loading}
      <div class="loading">Chargement...</div>
    {:else if labels.length === 0}
      <div class="empty-state">
        <p>Aucun label trouvé</p>
        <button class="btn-primary" on:click={openCreateModal}>
          Créer le premier label
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
            {#each labels as label}
              <tr>
                <td><strong>{label.name}</strong></td>
                <td>
                  {#if label.country}
                    <span>{label.country.flag} {label.country.name}</span>
                  {:else}
                    -
                  {/if}
                </td>
                <td class="actions">
                  <button
                    class="btn-edit"
                    on:click={() => openEditModal(label)}
                  >
                    Modifier
                  </button>
                  <button
                    class="btn-delete"
                    on:click={() => deleteLabel(label.id)}
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
  title={editingLabel ? "Modifier le label" : "Nouveau label"}
  on:close={closeModal}
>
  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-grid">
      <div class="form-group full-width">
        <label for="name">Nom du label *</label>
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
        {editingLabel ? "Mettre à jour" : "Créer"}
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
