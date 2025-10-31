<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import Modal from "$lib/components/Modal.svelte";

  let countries: any[] = [];
  let loading = true;
  let error = "";
  let showModal = false;
  let editingCountry: any = null;

  // Form fields
  let formData = {
    name: "",
    iso_code: "",
    flag: "",
  };

  onMount(async () => {
    await loadCountries();
  });

  async function loadCountries() {
    loading = true;
    const { data, error: fetchError } = await supabase
      .from("country")
      .select("*")
      .order("name");

    if (fetchError) {
      error = fetchError.message;
    } else {
      countries = data || [];
    }
    loading = false;
  }

  function openCreateModal() {
    editingCountry = null;
    resetForm();
    showModal = true;
  }

  function openEditModal(country: any) {
    editingCountry = country;
    formData = {
      name: country.name,
      iso_code: country.iso_code,
      flag: country.flag,
    };
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingCountry = null;
    resetForm();
  }

  function resetForm() {
    formData = {
      name: "",
      iso_code: "",
      flag: "",
    };
  }

  async function handleSubmit() {
    if (!formData.name || !formData.iso_code || !formData.flag) {
      error = "Tous les champs sont obligatoires";
      return;
    }

    const countryData = {
      name: formData.name,
      iso_code: formData.iso_code,
      flag: formData.flag,
    };

    if (editingCountry) {
      const { error: updateError } = await supabase
        .from("country")
        .update(countryData)
        .eq("id", editingCountry.id);

      if (updateError) {
        error = updateError.message;
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("country")
        .insert(countryData);

      if (insertError) {
        error = insertError.message;
        return;
      }
    }

    closeModal();
    await loadCountries();
  }

  async function deleteCountry(id: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce pays ?")) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("country")
      .delete()
      .eq("id", id);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    await loadCountries();
  }
</script>

<svelte:head>
  <title>Pays - Gestion</title>
</svelte:head>

<div class="page-container">
  <header class="page-header">
    <h1>Pays</h1>
    <button class="btn-primary" on:click={openCreateModal}
      >+ Nouveau pays</button
    >
  </header>

  <div class="page-content">
    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    {#if loading}
      <div class="loading">Chargement...</div>
    {:else if countries.length === 0}
      <div class="empty-state">
        <p>Aucun pays trouvé</p>
        <button class="btn-primary" on:click={openCreateModal}>
          Créer le premier pays
        </button>
      </div>
    {:else}
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Code ISO</th>
              <th>Drapeau</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each countries as country}
              <tr>
                <td><strong>{country.name}</strong></td>
                <td>{country.iso_code}</td>
                <td>{country.flag}</td>
                <td class="actions">
                  <button
                    class="btn-edit"
                    on:click={() => openEditModal(country)}
                  >
                    Modifier
                  </button>
                  <button
                    class="btn-delete"
                    on:click={() => deleteCountry(country.id)}
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
  title={editingCountry ? "Modifier le pays" : "Nouveau pays"}
  on:close={closeModal}
>
  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-grid">
      <div class="form-group full-width">
        <label for="name">Nom du pays *</label>
        <input type="text" id="name" bind:value={formData.name} required />
      </div>

      <div class="form-group">
        <label for="iso_code">Code ISO *</label>
        <input
          type="text"
          id="iso_code"
          bind:value={formData.iso_code}
          maxlength="3"
          required
        />
      </div>

      <div class="form-group">
        <label for="flag">Drapeau (emoji) *</label>
        <input type="text" id="flag" bind:value={formData.flag} required />
      </div>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn-secondary" on:click={closeModal}>
        Annuler
      </button>
      <button type="submit" class="btn-primary">
        {editingCountry ? "Mettre à jour" : "Créer"}
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
