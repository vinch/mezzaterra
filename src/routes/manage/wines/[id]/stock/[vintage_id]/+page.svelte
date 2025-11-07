<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import type { PageData } from "./$types";
  import type { StockMove } from "$lib/types";
  import Modal from "$lib/components/Modal.svelte";

  export let data: PageData;

  let vintage = data.vintage;
  let stockMoves = data.stockMoves;
  let currentStock = data.currentStock;
  let loading = true;
  let error = "";
  let showModal = false;
  let showEditModal = false;
  let editingMove: any = null;

  // Form fields
  let formData = {
    reason: "",
    quantity: "",
    date: "",
    note: "",
  };

  // Raisons de mouvement de stock (triées par ordre alphabétique)
  const stockReasons = [
    { value: "purchase_in", label: "Achat", type: "in" },
    { value: "breakage_out", label: "Casse", type: "out" },
    { value: "gift_out", label: "Cadeau", type: "out" },
    { value: "tasting_out", label: "Dégustation", type: "out" },
    { value: "test_out", label: "Test interne", type: "out" },
    { value: "sale_out", label: "Vente payée", type: "out" },
  ];

  onMount(async () => {
    await loadStockMoves();
  });

  async function loadStockMoves() {
    loading = true;
    const { data: movesData, error: fetchError } = await supabase
      .from("stock_move")
      .select("*")
      .eq("wine_vintage_id", vintage.id)
      .order("date", { ascending: false });

    if (fetchError) {
      error = fetchError.message;
    } else {
      stockMoves = movesData || [];
    }

    // Récupérer le stock actuel depuis la vue inventory
    const { data: inventory, error: inventoryError } = await supabase
      .from("inventory")
      .select("quantity_on_hand")
      .eq("wine_vintage_id", vintage.id)
      .maybeSingle();

    if (inventoryError) {
      console.warn(
        "Aucun stock trouvé pour ce millésime:",
        inventoryError.message
      );
      currentStock = 0;
    } else if (inventory) {
      currentStock = inventory.quantity_on_hand || 0;
    } else {
      currentStock = 0;
    }

    loading = false;
  }

  function openCreateModal() {
    editingMove = null;
    resetForm();
    showModal = true;
  }

  function openEditModal(move: StockMove) {
    editingMove = move;
    formData = {
      reason: move.reason,
      quantity: normalizeQuantityForDisplay(move.quantity, move.reason),
      date: move.date.split("T")[0], // Format YYYY-MM-DDn
      note: move.note || "",
    };
    showEditModal = true;
  }

  function closeModal() {
    showModal = false;
    editingMove = null;
    resetForm();
  }

  function closeEditModal() {
    showEditModal = false;
    editingMove = null;
    resetForm();
  }

  function resetForm() {
    formData = {
      reason: "",
      quantity: "",
      date: new Date().toISOString().split("T")[0],
      note: "",
    };
  }

  async function handleSubmit() {
    if (!formData.reason || !formData.quantity || !formData.date) {
      error = "Raison, quantité et date sont obligatoires";
      return;
    }

    // Garde-fou pour les quantités
    let quantity = parseInt(formData.quantity);
    const reasonObj = stockReasons.find((r) => r.value === formData.reason);

    if (reasonObj) {
      if (reasonObj.type === "in" && quantity < 0) {
        // Pour les achats, enlever le signe négatif
        quantity = Math.abs(quantity);
      } else if (reasonObj.type === "out" && quantity > 0) {
        // Pour les sorties, ajouter le signe négatif
        quantity = -Math.abs(quantity);
      }
    }

    const moveData = {
      wine_vintage_id: vintage.id,
      reason: formData.reason,
      quantity: quantity,
      date: formData.date,
      note: formData.note || null,
    };

    const { error: insertError } = await supabase
      .from("stock_move")
      .insert(moveData);

    if (insertError) {
      error = insertError.message;
      return;
    }

    closeModal();
    await loadStockMoves();
  }

  async function handleUpdate() {
    if (
      !formData.reason ||
      !formData.quantity ||
      !formData.date ||
      !editingMove
    ) {
      error = "Raison, quantité et date sont obligatoires";
      return;
    }

    // Garde-fou pour les quantités
    let quantity = parseInt(formData.quantity);
    const reasonObj = stockReasons.find((r) => r.value === formData.reason);

    if (reasonObj) {
      if (reasonObj.type === "in" && quantity < 0) {
        // Pour les achats, enlever le signe négatif
        quantity = Math.abs(quantity);
      } else if (reasonObj.type === "out" && quantity > 0) {
        // Pour les sorties, ajouter le signe négatif
        quantity = -Math.abs(quantity);
      }
    }

    const moveData = {
      reason: formData.reason,
      quantity: quantity,
      date: formData.date,
      note: formData.note || null,
    };

    const { error: updateError } = await supabase
      .from("stock_move")
      .update(moveData)
      .eq("id", editingMove.id);

    if (updateError) {
      error = updateError.message;
      return;
    }

    closeEditModal();
    await loadStockMoves();
  }

  async function deleteMove(id: string) {
    if (
      !confirm("Êtes-vous sûr de vouloir supprimer ce mouvement de stock ?")
    ) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("stock_move")
      .delete()
      .eq("id", id);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    await loadStockMoves();
  }

  function getReasonLabel(reason: string) {
    const reasonObj = stockReasons.find((r) => r.value === reason);
    return reasonObj ? reasonObj.label : reason;
  }

  function getReasonType(reason: string) {
    const reasonObj = stockReasons.find((r) => r.value === reason);
    return reasonObj ? reasonObj.type : "out";
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString("fr-FR");
  }

  function normalizeQuantityForDisplay(quantity: number, reason: string) {
    const reasonObj = stockReasons.find((r) => r.value === reason);
    if (reasonObj) {
      if (reasonObj.type === "out") {
        // Pour les sorties, afficher la valeur absolue
        return Math.abs(quantity).toString();
      }
    }
    return quantity.toString();
  }
</script>

<svelte:head>
  <title
    >Stock - {vintage.wine.name}
    {vintage.year || `(${vintage.production_year})`}</title
  >
</svelte:head>

<div class="page-container">
  <header class="page-header">
    <div class="breadcrumb">
      <a href="/manage/wines">← Vins</a>
      <span> / </span>
      <a href="/manage/wines/{vintage.wine.id}">Millésimes</a>
      <span> / </span>
      <span>Stock</span>
    </div>
    <div class="wine-info">
      <h1>
        {vintage.wine.name}
        {vintage.year || `(${vintage.production_year})`}
      </h1>
      <div class="stock-info">
        <div class="current-stock">
          <span class="stock-label">Stock actuel:</span>
          <span class="stock-value {currentStock < 0 ? 'negative' : ''}">
            {currentStock} bouteille{currentStock !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
    <button class="btn-primary" on:click={openCreateModal}>
      + Nouveau mouvement
    </button>
  </header>

  <div class="page-content">
    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    {#if loading}
      <div class="loading">Chargement...</div>
    {:else if stockMoves.length === 0}
      <div class="empty-state">
        <p>Aucun mouvement de stock trouvé</p>
        <button class="btn-primary" on:click={openCreateModal}>
          Créer le premier mouvement
        </button>
      </div>
    {:else}
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Raison</th>
              <th>Quantité</th>
              <th>Type</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each stockMoves as move}
              <tr>
                <td>{formatDate(move.date)}</td>
                <td>{getReasonLabel(move.reason)}</td>
                <td class="quantity-cell">
                  <span class="quantity {getReasonType(move.reason)}">
                    {getReasonType(move.reason) === "in"
                      ? `+${Math.abs(move.quantity)}`
                      : `-${Math.abs(move.quantity)}`}
                  </span>
                </td>
                <td>
                  <span class="type-badge {getReasonType(move.reason)}">
                    {getReasonType(move.reason) === "in" ? "Entrée" : "Sortie"}
                  </span>
                </td>
                <td>{move.note || "-"}</td>
                <td>
                  <div class="actions">
                    <button
                      class="btn-edit"
                      on:click={() => openEditModal(move)}
                    >
                      Modifier
                    </button>
                    <button
                      class="btn-delete"
                      on:click={() => deleteMove(move.id)}
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

<!-- Modal de création -->
<Modal
  show={showModal}
  title="Nouveau mouvement de stock"
  modalId="modal-title-create"
  on:close={closeModal}
>
  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-grid">
      <div class="form-group">
        <label for="reason">Raison *</label>
        <select id="reason" bind:value={formData.reason} required>
          <option value="">Sélectionner une raison</option>
          {#each stockReasons as reason}
            <option value={reason.value}>{reason.label}</option>
          {/each}
        </select>
      </div>

      <div class="form-group">
        <label for="quantity">Quantité *</label>
        <input
          type="number"
          id="quantity"
          bind:value={formData.quantity}
          min="1"
          placeholder="Entrez un nombre"
          required
        />
      </div>

      <div class="form-group">
        <label for="date">Date *</label>
        <input type="date" id="date" bind:value={formData.date} required />
      </div>

      <div class="form-group full-width">
        <label for="note">Note</label>
        <textarea
          id="note"
          bind:value={formData.note}
          rows="3"
          placeholder="Commentaires sur ce mouvement..."
        ></textarea>
      </div>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn-secondary" on:click={closeModal}>
        Annuler
      </button>
      <button type="submit" class="btn-primary"> Créer le mouvement </button>
    </div>
  </form>
</Modal>

<!-- Modal d'édition -->
<Modal
  show={showEditModal && !!editingMove}
  title="Modifier le mouvement de stock"
  modalId="modal-title-edit"
  on:close={closeEditModal}
>
  <form on:submit|preventDefault={handleUpdate}>
    <div class="form-grid">
      <div class="form-group">
        <label for="edit-reason">Raison *</label>
        <select id="edit-reason" bind:value={formData.reason} required>
          <option value="">Sélectionner une raison</option>
          {#each stockReasons as reason}
            <option value={reason.value}>{reason.label}</option>
          {/each}
        </select>
      </div>

      <div class="form-group">
        <label for="edit-quantity">Quantité *</label>
        <input
          type="number"
          id="edit-quantity"
          bind:value={formData.quantity}
          min="1"
          placeholder="Entrez un nombre"
          required
        />
      </div>

      <div class="form-group">
        <label for="edit-date">Date *</label>
        <input type="date" id="edit-date" bind:value={formData.date} required />
      </div>

      <div class="form-group full-width">
        <label for="edit-note">Note</label>
        <textarea
          id="edit-note"
          bind:value={formData.note}
          rows="3"
          placeholder="Commentaires sur ce mouvement..."
        ></textarea>
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
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .breadcrumb a {
    color: #007bff;
    text-decoration: none;
    font-size: 0.9rem;
  }

  .breadcrumb a:hover {
    text-decoration: underline;
  }

  .breadcrumb span {
    color: #666;
    font-size: 0.9rem;
  }

  .wine-info {
    flex: 1;
  }

  .wine-info h1 {
    margin: 0 0 0.5rem 0;
    color: #333;
    font-size: 1.75rem;
  }

  .stock-info {
    display: flex;
    gap: 2rem;
    align-items: center;
  }

  .current-stock {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #f8f9fa;
    border-radius: 6px;
    border: 1px solid #dee2e6;
  }

  .stock-label {
    font-size: 0.9rem;
    color: #666;
  }

  .stock-value {
    font-size: 1.1rem;
    font-weight: 600;
    color: #28a745;
  }

  .stock-value.negative {
    color: #dc3545;
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

  .quantity-cell {
    text-align: center;
  }

  .quantity {
    font-weight: 600;
    font-size: 1.1rem;
  }

  .quantity.in {
    color: #28a745;
  }

  .quantity.out {
    color: #dc3545;
  }

  .type-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .type-badge.in {
    background: #d4edda;
    color: #155724;
  }

  .type-badge.out {
    background: #f8d7da;
    color: #721c24;
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
