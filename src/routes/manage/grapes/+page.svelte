<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import Modal from "$lib/components/Modal.svelte";

  let grapes: any[] = [];
  let loading = true;
  let error = "";
  let showModal = false;
  let editingGrape: any = null;

  // Form fields
  let formData = {
    name: "",
    description: "",
  };

  onMount(async () => {
    await loadGrapes();
  });

  async function loadGrapes() {
    loading = true;
    const { data, error: fetchError } = await supabase
      .from("grape")
      .select("*")
      .order("name");

    if (fetchError) {
      error = fetchError.message;
    } else {
      grapes = data || [];
    }
    loading = false;
  }

  function openCreateModal() {
    editingGrape = null;
    resetForm();
    showModal = true;
  }

  function openEditModal(grape: any) {
    editingGrape = grape;
    formData = {
      name: grape.name,
      description: grape.description || "",
    };
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingGrape = null;
    resetForm();
  }

  function resetForm() {
    formData = {
      name: "",
      description: "",
    };
  }

  async function handleSubmit() {
    if (!formData.name) {
      error = "Le nom du cépage est obligatoire";
      return;
    }

    const grapeData = {
      name: formData.name,
      description: formData.description || null,
    };

    if (editingGrape) {
      const { error: updateError } = await supabase
        .from("grape")
        .update(grapeData)
        .eq("id", editingGrape.id);

      if (updateError) {
        error = updateError.message;
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("grape")
        .insert(grapeData);

      if (insertError) {
        error = insertError.message;
        return;
      }
    }

    closeModal();
    await loadGrapes();
  }

  async function deleteGrape(id: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce cépage ?")) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("grape")
      .delete()
      .eq("id", id);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    await loadGrapes();
  }
</script>

<svelte:head>
  <title>Cépages - Gestion</title>
</svelte:head>

<div class="page-container">
  <header class="page-header">
    <h1>Cépages</h1>
    <button class="btn-primary" on:click={openCreateModal}
      >+ Nouveau cépage</button
    >
  </header>

  <div class="page-content">
    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    {#if loading}
      <div class="loading">Chargement...</div>
    {:else if grapes.length === 0}
      <div class="empty-state">
        <p>Aucun cépage trouvé</p>
        <button class="btn-primary" on:click={openCreateModal}>
          Créer le premier cépage
        </button>
      </div>
    {:else}
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each grapes as grape}
              <tr>
                <td><strong>{grape.name}</strong></td>
                <td>
                  {#if grape.description}
                    <span class="description-text" title={grape.description}>
                      {grape.description.length > 50
                        ? grape.description.substring(0, 50) + "..."
                        : grape.description}
                    </span>
                  {:else}
                    -
                  {/if}
                </td>
                <td class="actions">
                  <button
                    class="btn-edit"
                    on:click={() => openEditModal(grape)}
                  >
                    Modifier
                  </button>
                  <button
                    class="btn-delete"
                    on:click={() => deleteGrape(grape.id)}
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
  title={editingGrape ? "Modifier le cépage" : "Nouveau cépage"}
  on:close={closeModal}
>
  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-grid">
      <div class="form-group full-width">
        <label for="name">Nom du cépage *</label>
        <input type="text" id="name" bind:value={formData.name} required />
      </div>

      <div class="form-group full-width">
        <label for="description">Description</label>
        <textarea id="description" bind:value={formData.description} rows="3"
        ></textarea>
      </div>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn-secondary" on:click={closeModal}>
        Annuler
      </button>
      <button type="submit" class="btn-primary">
        {editingGrape ? "Mettre à jour" : "Créer"}
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
  textarea {
    padding: 0.5rem;
    border: 1px solid #ced4da;
    border-radius: 4px;
    font-size: 1rem;
  }

  input:focus,
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
