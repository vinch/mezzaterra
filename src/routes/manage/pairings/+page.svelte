<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import Modal from "$lib/components/Modal.svelte";

  let pairings: any[] = [];
  let loading = true;
  let error = "";
  let showModal = false;
  let editingPairing: any = null;

  // Form fields
  let formData = {
    description: "",
  };

  onMount(async () => {
    await loadPairings();
  });

  async function loadPairings() {
    loading = true;
    const { data, error: fetchError } = await supabase
      .from("pairing")
      .select("*")
      .order("description");

    if (fetchError) {
      error = fetchError.message;
    } else {
      pairings = data || [];
    }
    loading = false;
  }

  function openCreateModal() {
    editingPairing = null;
    resetForm();
    showModal = true;
  }

  function openEditModal(pairing: any) {
    editingPairing = pairing;
    formData = {
      description: pairing.description,
    };
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingPairing = null;
    resetForm();
  }

  function resetForm() {
    formData = {
      description: "",
    };
  }

  async function handleSubmit() {
    if (!formData.description) {
      error = "La description du pairing est obligatoire";
      return;
    }

    const pairingData = {
      description: formData.description,
    };

    if (editingPairing) {
      const { error: updateError } = await supabase
        .from("pairing")
        .update(pairingData)
        .eq("id", editingPairing.id);

      if (updateError) {
        error = updateError.message;
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("pairing")
        .insert(pairingData);

      if (insertError) {
        error = insertError.message;
        return;
      }
    }

    closeModal();
    await loadPairings();
  }

  async function deletePairing(id: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce pairing ?")) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("pairing")
      .delete()
      .eq("id", id);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    await loadPairings();
  }
</script>

<svelte:head>
  <title>Pairings - Gestion</title>
</svelte:head>

<div class="page-container">
  <header class="page-header">
    <h1>Pairings</h1>
    <button class="btn-primary" on:click={openCreateModal}
      >+ Nouveau pairing</button
    >
  </header>

  <div class="page-content">
    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    {#if loading}
      <div class="loading">Chargement...</div>
    {:else if pairings.length === 0}
      <div class="empty-state">
        <p>Aucun pairing trouvé</p>
        <button class="btn-primary" on:click={openCreateModal}>
          Créer le premier pairing
        </button>
      </div>
    {:else}
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each pairings as pairing}
              <tr>
                <td><strong>{pairing.description}</strong></td>
                <td class="actions">
                  <button
                    class="btn-edit"
                    on:click={() => openEditModal(pairing)}
                  >
                    Modifier
                  </button>
                  <button
                    class="btn-delete"
                    on:click={() => deletePairing(pairing.id)}
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
  title={editingPairing ? "Modifier le pairing" : "Nouveau pairing"}
  on:close={closeModal}
>
  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-grid">
      <div class="form-group full-width">
        <label for="description">Description *</label>
        <input
          type="text"
          id="description"
          bind:value={formData.description}
          required
        />
      </div>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn-secondary" on:click={closeModal}>
        Annuler
      </button>
      <button type="submit" class="btn-primary">
        {editingPairing ? "Mettre à jour" : "Créer"}
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
</style>
