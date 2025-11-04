<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import type { PageData } from "./$types";
  import Modal from "$lib/components/Modal.svelte";

  export let data: PageData;

  let transports: any[] = data.transports;
  let transporters: any[] = [];
  let loading = true;
  let error = "";
  let showModal = false;
  let showEditModal = false;
  let editingTransport: any = null;

  let formData = {
    transporter_id: "",
    departure_date: "",
    arrival_date: "",
    status: "pending",
    pallets_number: "",
    price: "",
    note: "",
  };

  onMount(async () => {
    await loadTransporters();
    loading = false;
  });

  async function loadTransporters() {
    const { data } = await supabase
      .from("transporter")
      .select("*")
      .order("name");
    if (data) transporters = data;
  }

  function openCreateModal() {
    editingTransport = null;
    resetForm();
    showModal = true;
  }

  function openEditModal(transport: any) {
    editingTransport = transport;
    formData = {
      transporter_id: transport.transporter_id || "",
      departure_date: transport.departure_date
        ? transport.departure_date.split("T")[0]
        : "",
      arrival_date: transport.arrival_date
        ? transport.arrival_date.split("T")[0]
        : "",
      status: transport.status || "pending",
      pallets_number: transport.pallets_number
        ? String(transport.pallets_number)
        : "",
      price: transport.price ? String(transport.price) : "",
      note: transport.note || "",
    };
    showEditModal = true;
  }

  function closeModal() {
    showModal = false;
    editingTransport = null;
    resetForm();
  }

  function closeEditModal() {
    showEditModal = false;
    editingTransport = null;
    resetForm();
  }

  function resetForm() {
    formData = {
      transporter_id: "",
      departure_date: "",
      arrival_date: "",
      status: "pending",
      pallets_number: "",
      price: "",
      note: "",
    };
  }

  async function handleSubmit() {
    if (!formData.transporter_id) {
      error = "Le transporteur est obligatoire";
      return;
    }

    const transportData = {
      transporter_id: formData.transporter_id,
      departure_date: formData.departure_date || null,
      arrival_date: formData.arrival_date || null,
      status: formData.status || null,
      pallets_number: formData.pallets_number
        ? parseInt(formData.pallets_number)
        : null,
      price: formData.price ? parseFloat(formData.price) : null,
      note: formData.note || null,
    };

    const { error: insertError } = await supabase
      .from("transport")
      .insert(transportData);

    if (insertError) {
      error = insertError.message;
      return;
    }

    closeModal();
    window.location.reload();
  }

  async function handleUpdate() {
    if (!formData.transporter_id) {
      error = "Le transporteur est obligatoire";
      return;
    }

    const transportData = {
      transporter_id: formData.transporter_id,
      departure_date: formData.departure_date || null,
      arrival_date: formData.arrival_date || null,
      status: formData.status || null,
      pallets_number: formData.pallets_number
        ? parseInt(formData.pallets_number)
        : null,
      price: formData.price ? parseFloat(formData.price) : null,
      note: formData.note || null,
    };

    const { error: updateError } = await supabase
      .from("transport")
      .update(transportData)
      .eq("id", editingTransport.id);

    if (updateError) {
      error = updateError.message;
      return;
    }

    closeEditModal();
    window.location.reload();
  }

  async function deleteTransport(id: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce transport ?")) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("transport")
      .delete()
      .eq("id", id);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    window.location.reload();
  }
</script>

<svelte:head>
  <title>Transports - Gestion</title>
</svelte:head>

<div class="page-container">
  <header class="page-header">
    <h1>Transports</h1>
    <button class="btn-primary" on:click={openCreateModal}
      >+ Nouveau transport</button
    >
  </header>

  <div class="page-content">
    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    {#if loading}
      <div class="loading">Chargement...</div>
    {:else if transports.length === 0}
      <div class="empty-state">
        <p>Aucun transport trouvé</p>
        <button class="btn-primary" on:click={openCreateModal}>
          Créer le premier transport
        </button>
      </div>
    {:else}
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Transporteur</th>
              <th>Date de départ</th>
              <th>Date d'arrivée</th>
              <th>Statut</th>
              <th>Nb palettes</th>
              <th>Prix</th>
              <th>Note</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each transports as transport}
              <tr>
                <td><strong>{transport.transporter.name}</strong></td>
                <td>
                  {#if transport.departure_date}
                    {new Date(transport.departure_date).toLocaleDateString(
                      "fr-FR"
                    )}
                  {:else}
                    -
                  {/if}
                </td>
                <td>
                  {#if transport.arrival_date}
                    {new Date(transport.arrival_date).toLocaleDateString(
                      "fr-FR"
                    )}
                  {:else}
                    -
                  {/if}
                </td>
                <td>
                  <span class="status-badge status-{transport.status}"
                    >{transport.status}</span
                  >
                </td>
                <td>{transport.pallets_number || "-"}</td>
                <td>
                  {#if transport.price}
                    €{transport.price.toFixed(2)}
                  {:else}
                    -
                  {/if}
                </td>
                <td>
                  {#if transport.note}
                    <span class="description-text" title={transport.note}>
                      {transport.note.length > 50
                        ? transport.note.substring(0, 50) + "..."
                        : transport.note}
                    </span>
                  {:else}
                    -
                  {/if}
                </td>
                <td class="actions">
                  <button
                    class="btn-edit"
                    on:click={() => openEditModal(transport)}
                  >
                    Modifier
                  </button>
                  <button
                    class="btn-delete"
                    on:click={() => deleteTransport(transport.id)}
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

<!-- Modal de création -->
<Modal
  show={showModal}
  title="Nouveau transport"
  modalId="modal-title-create"
  on:close={closeModal}
>
  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-grid">
      <div class="form-group">
        <label for="transporter_id">Transporteur *</label>
        <select
          id="transporter_id"
          bind:value={formData.transporter_id}
          required
        >
          <option value="">Sélectionner un transporteur</option>
          {#each transporters as transporter}
            <option value={transporter.id}>{transporter.name}</option>
          {/each}
        </select>
      </div>

      <div class="form-group">
        <label for="status">Statut</label>
        <select id="status" bind:value={formData.status}>
          <option value="pending">En attente</option>
          <option value="in_transit">En transit</option>
          <option value="delivered">Livré</option>
          <option value="cancelled">Annulé</option>
        </select>
      </div>

      <div class="form-group">
        <label for="departure_date">Date de départ</label>
        <input
          type="date"
          id="departure_date"
          bind:value={formData.departure_date}
        />
      </div>

      <div class="form-group">
        <label for="arrival_date">Date d'arrivée</label>
        <input
          type="date"
          id="arrival_date"
          bind:value={formData.arrival_date}
        />
      </div>

      <div class="form-group">
        <label for="pallets_number">Nombre de palettes</label>
        <input
          type="number"
          id="pallets_number"
          bind:value={formData.pallets_number}
        />
      </div>

      <div class="form-group">
        <label for="price">Prix</label>
        <input
          type="number"
          step="0.01"
          id="price"
          bind:value={formData.price}
        />
      </div>

      <div class="form-group full-width">
        <label for="note">Note</label>
        <textarea id="note" bind:value={formData.note} rows="3"></textarea>
      </div>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn-secondary" on:click={closeModal}
        >Annuler</button
      >
      <button type="submit" class="btn-primary">Créer le transport</button>
    </div>
  </form>
</Modal>

<!-- Modal d'édition -->
<Modal
  show={showEditModal}
  title="Modifier le transport"
  modalId="modal-title-edit"
  on:close={closeEditModal}
>
  <form on:submit|preventDefault={handleUpdate}>
    <div class="form-grid">
      <div class="form-group">
        <label for="transporter_id_edit">Transporteur *</label>
        <select
          id="transporter_id_edit"
          bind:value={formData.transporter_id}
          required
        >
          <option value="">Sélectionner un transporteur</option>
          {#each transporters as transporter}
            <option value={transporter.id}>{transporter.name}</option>
          {/each}
        </select>
      </div>

      <div class="form-group">
        <label for="status_edit">Statut</label>
        <select id="status_edit" bind:value={formData.status}>
          <option value="pending">En attente</option>
          <option value="in_transit">En transit</option>
          <option value="delivered">Livré</option>
          <option value="cancelled">Annulé</option>
        </select>
      </div>

      <div class="form-group">
        <label for="departure_date_edit">Date de départ</label>
        <input
          type="date"
          id="departure_date_edit"
          bind:value={formData.departure_date}
        />
      </div>

      <div class="form-group">
        <label for="arrival_date_edit">Date d'arrivée</label>
        <input
          type="date"
          id="arrival_date_edit"
          bind:value={formData.arrival_date}
        />
      </div>

      <div class="form-group">
        <label for="pallets_number_edit">Nombre de palettes</label>
        <input
          type="number"
          id="pallets_number_edit"
          bind:value={formData.pallets_number}
        />
      </div>

      <div class="form-group">
        <label for="price_edit">Prix</label>
        <input
          type="number"
          step="0.01"
          id="price_edit"
          bind:value={formData.price}
        />
      </div>

      <div class="form-group full-width">
        <label for="note_edit">Note</label>
        <textarea id="note_edit" bind:value={formData.note} rows="3"></textarea>
      </div>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn-secondary" on:click={closeEditModal}
        >Annuler</button
      >
      <button type="submit" class="btn-primary">Enregistrer</button>
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

  .status-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.85rem;
    font-weight: 500;
  }

  .status-pending {
    background: #fff3cd;
    color: #856404;
  }

  .status-in_transit {
    background: #d1ecf1;
    color: #0c5460;
  }

  .status-delivered {
    background: #d4edda;
    color: #155724;
  }

  .status-cancelled {
    background: #f8d7da;
    color: #721c24;
  }
</style>
