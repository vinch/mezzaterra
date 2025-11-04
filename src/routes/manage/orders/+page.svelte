<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import type { PageData } from "./$types";
  import Modal from "$lib/components/Modal.svelte";

  export let data: PageData;

  let orders: any[] = data.orders;
  let suppliers: any[] = [];
  let wineVintages: any[] = [];
  let loading = true;
  let error = "";
  let showModal = false;
  let showEditModal = false;
  let showDetailsModal = false;
  let editingOrder: any = null;
  let detailsOrder: any = null;
  let detailsOrderItems: any[] = [];

  // Form fields
  let formData = {
    date: new Date().toISOString().split("T")[0],
    supplier_id: "",
    total_price: 0,
    note: "",
  };

  // Order items
  let orderItems: any[] = [];
  let selectedVintageId = "";
  let selectedQuantity = "";
  let selectedPrice = "";

  onMount(async () => {
    await loadSuppliers();
    await loadWineVintages();
    loading = false;
  });

  function getProductDisplayName(vintage: any) {
    const winery = vintage.wine.winery.name;
    const wineName = vintage.wine.name;
    const appelation = vintage.wine.appelation?.name;

    if (wineName) {
      return `${winery} - ${wineName}`;
    } else if (appelation) {
      return `${winery} - ${appelation}`;
    } else {
      return winery;
    }
  }

  function getProductDisplayNameWithYear(vintage: any) {
    const baseName = getProductDisplayName(vintage);
    if (vintage.year) {
      return `${baseName} - ${vintage.year}`;
    } else {
      return `${baseName} (${vintage.production_year})`;
    }
  }

  async function loadSuppliers() {
    const { data } = await supabase.from("supplier").select("*").order("name");
    if (data) suppliers = data;
  }

  async function loadWineVintages() {
    const { data } = await supabase
      .from("wine_vintage")
      .select(
        `
        *,
        wine (
          *,
          winery (*),
          appelation (*)
        )
      `
      )
      .order("production_year", { ascending: false });
    if (data) {
      // Sort by winery, then wine name/appellation, then year
      wineVintages = data.sort((a, b) => {
        // First: sort by winery name
        const wineryA = a.wine.winery.name.toLowerCase();
        const wineryB = b.wine.winery.name.toLowerCase();
        if (wineryA !== wineryB) {
          return wineryA.localeCompare(wineryB);
        }

        // Second: sort by wine name or appellation
        const wineNameA =
          a.wine.name?.toLowerCase() ||
          a.wine.appelation?.name?.toLowerCase() ||
          "";
        const wineNameB =
          b.wine.name?.toLowerCase() ||
          b.wine.appelation?.name?.toLowerCase() ||
          "";
        if (wineNameA !== wineNameB) {
          return wineNameA.localeCompare(wineNameB);
        }

        // Third: sort by year (year if exists, else production_year)
        const yearA = a.year || a.production_year;
        const yearB = b.year || b.production_year;
        return yearB - yearA; // Descending order (newest first)
      });
    }
  }

  function openCreateModal() {
    editingOrder = null;
    resetForm();
    orderItems = [];
    showModal = true;
  }

  async function openEditModal(order: any) {
    editingOrder = order;
    formData = {
      date: order.date.split("T")[0],
      supplier_id: order.supplier_id || "",
      total_price: order.total_price || 0,
      note: order.note || "",
    };
    await loadWineVintages();
    await loadOrderItems(order.id);
    // Update orderItems format to match what the form expects
    orderItems = orderItems.map((item: any) => {
      return {
        wine_vintage: item.wine_vintage,
        wine_vintage_id: item.wine_vintage_id,
        quantity: item.quantity,
        price: item.price || item.wine_vintage?.purchase_price || 0,
        note: item.note || "",
      };
    });
    formData.total_price = calculateTotal();
    showEditModal = true;
  }

  async function loadOrderItems(orderId: string) {
    const { data } = await supabase
      .from("order_item")
      .select(
        `
        *,
        wine_vintage (
          *,
          wine (
            *,
            winery (*),
            appelation (*)
          )
        )
      `
      )
      .eq("order_id", orderId);

    orderItems = data || [];
  }

  function closeModal() {
    showModal = false;
    editingOrder = null;
    resetForm();
    orderItems = [];
  }

  function closeEditModal() {
    showEditModal = false;
    editingOrder = null;
    resetForm();
    orderItems = [];
  }

  async function openDetailsModal(order: any) {
    detailsOrder = order;
    await loadOrderItems(order.id);
    detailsOrderItems = orderItems;
    showDetailsModal = true;
  }

  function closeDetailsModal() {
    showDetailsModal = false;
    detailsOrder = null;
    detailsOrderItems = [];
  }

  function resetForm() {
    formData = {
      date: new Date().toISOString().split("T")[0],
      supplier_id: "",
      total_price: 0,
      note: "",
    };
    orderItems = [];
    selectedVintageId = "";
    selectedQuantity = "";
    selectedPrice = "";
  }

  function calculateItemTotal(item: any) {
    const price = parseFloat(item.price) || 0;
    const quantity = parseInt(item.quantity) || 0;
    return price * quantity;
  }

  function calculateTotal() {
    let total = 0;
    for (const item of orderItems) {
      total += calculateItemTotal(item);
    }
    return total;
  }

  function handleVintageChange() {
    if (selectedVintageId) {
      const vintage = wineVintages.find((v) => v.id === selectedVintageId);
      if (vintage && vintage.purchase_price) {
        selectedPrice = vintage.purchase_price.toString();
      } else {
        selectedPrice = "";
      }
    }
  }

  function isVintageAlreadyAdded(vintageId: string): boolean {
    return orderItems.some((item) => item.wine_vintage_id === vintageId);
  }

  function addOrderItem() {
    if (!selectedVintageId || !selectedQuantity || !selectedPrice) return;

    const vintage = wineVintages.find((v) => v.id === selectedVintageId);
    if (vintage) {
      orderItems = [
        ...orderItems,
        {
          wine_vintage: vintage,
          wine_vintage_id: selectedVintageId,
          quantity: parseInt(selectedQuantity),
          price: parseFloat(selectedPrice),
          note: "",
        },
      ];
      selectedVintageId = "";
      selectedQuantity = "";
      selectedPrice = "";
      formData.total_price = calculateTotal();
      error = ""; // Clear any previous errors
    }
  }

  function removeOrderItem(index: number) {
    orderItems = orderItems.filter((_, i) => i !== index);
    formData.total_price = calculateTotal();
  }

  async function handleSubmit() {
    if (!formData.supplier_id || orderItems.length === 0) {
      error = "Le fournisseur et au moins un article sont obligatoires";
      return;
    }

    const calculatedTotal = calculateTotal();
    const orderData = {
      date: formData.date,
      supplier_id: formData.supplier_id,
      transport_id: null,
      note: formData.note || null,
    };

    const { data: newOrder, error: insertError } = await supabase
      .from("order")
      .insert(orderData)
      .select()
      .single();

    if (insertError) {
      error = insertError.message;
      return;
    }

    // Insert order items
    for (const item of orderItems) {
      const { error: itemError } = await supabase.from("order_item").insert({
        order_id: newOrder.id,
        wine_vintage_id: item.wine_vintage_id,
        quantity: item.quantity,
        price: item.price,
        note: item.note || null,
      });

      if (itemError) {
        error = itemError.message;
        return;
      }
    }

    closeModal();
    window.location.reload();
  }

  async function handleUpdate() {
    if (!formData.supplier_id || orderItems.length === 0) {
      error = "Le fournisseur et au moins un article sont obligatoires";
      return;
    }

    if (!editingOrder) return;

    const calculatedTotal = calculateTotal();
    const orderData = {
      date: formData.date,
      supplier_id: formData.supplier_id,
      transport_id: null,
      note: formData.note || null,
    };

    const { error: updateError } = await supabase
      .from("order")
      .update(orderData)
      .eq("id", editingOrder.id);

    if (updateError) {
      error = updateError.message;
      return;
    }

    // Delete existing order items
    const { error: deleteError } = await supabase
      .from("order_item")
      .delete()
      .eq("order_id", editingOrder.id);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    // Insert updated order items
    for (const item of orderItems) {
      const { error: itemError } = await supabase.from("order_item").insert({
        order_id: editingOrder.id,
        wine_vintage_id: item.wine_vintage_id,
        quantity: item.quantity,
        price: item.price,
        note: item.note || null,
      });

      if (itemError) {
        error = itemError.message;
        return;
      }
    }

    closeEditModal();
    window.location.reload();
  }

  async function deleteOrder(id: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette commande ?")) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("order")
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
  <title>Commandes - Gestion</title>
</svelte:head>

<div class="page-container">
  <header class="page-header">
    <h1>Commandes</h1>
    <button class="btn-primary" on:click={openCreateModal}
      >+ Nouvelle commande</button
    >
  </header>

  <div class="page-content">
    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    {#if loading}
      <div class="loading">Chargement...</div>
    {:else if orders.length === 0}
      <div class="empty-state">
        <p>Aucune commande trouvée</p>
        <button class="btn-primary" on:click={openCreateModal}>
          Créer la première commande
        </button>
      </div>
    {:else}
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Fournisseur</th>
              <th>Transport</th>
              <th>Montant total</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each orders as order}
              <tr>
                <td>{new Date(order.date).toLocaleDateString("fr-FR")}</td>
                <td><strong>{order.supplier.name}</strong></td>
                <td>
                  {#if order.transport}
                    {order.transport.transporter.name}
                  {:else}
                    -
                  {/if}
                </td>
                <td>
                  <strong>€{order.total_price?.toFixed(2) || "0.00"}</strong>
                </td>
                <td class="actions">
                  <button
                    class="btn-edit"
                    on:click={() => openEditModal(order)}
                  >
                    Modifier
                  </button>
                  <button
                    class="btn-details"
                    on:click={() => openDetailsModal(order)}
                  >
                    Détails
                  </button>
                  <button
                    class="btn-delete"
                    on:click={() => deleteOrder(order.id)}
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
  title="Nouvelle commande"
  modalId="modal-title-create"
  on:close={closeModal}
>
  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-grid">
      <div class="form-group">
        <label for="date">Date *</label>
        <input type="date" id="date" bind:value={formData.date} required />
      </div>

      <div class="form-group">
        <label for="supplier_id">Fournisseur *</label>
        <select id="supplier_id" bind:value={formData.supplier_id} required>
          <option value="">Sélectionner un fournisseur</option>
          {#each suppliers as supplier}
            <option value={supplier.id}>{supplier.name}</option>
          {/each}
        </select>
      </div>

      <div class="form-group full-width">
        <label for="note">Note</label>
        <textarea id="note" bind:value={formData.note} rows="2"></textarea>
      </div>

      <div class="form-group full-width">
        <div class="section-title">Articles *</div>
        <div class="order-items-container">
          {#if orderItems.length === 0}
            <p class="empty-text">Aucun article ajouté</p>
          {:else}
            <div class="order-items-list">
              {#each orderItems as item, index}
                <div class="order-item">
                  <span>
                    {getProductDisplayNameWithYear(item.wine_vintage)} - x{item.quantity}
                    @ €{item.price.toFixed(2)} = €{calculateItemTotal(
                      item
                    ).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    class="btn-remove"
                    on:click={() => removeOrderItem(index)}
                  >
                    ×
                  </button>
                </div>
              {/each}
            </div>
          {/if}
          <div class="add-item-form">
            <select
              bind:value={selectedVintageId}
              on:change={handleVintageChange}
            >
              <option value="">Sélectionner un produit</option>
              {#each wineVintages as vintage}
                {@const alreadyAdded = isVintageAlreadyAdded(vintage.id)}
                <option value={vintage.id} disabled={alreadyAdded}>
                  {getProductDisplayNameWithYear(vintage)}
                  {#if vintage.purchase_price}
                    - €{vintage.purchase_price.toFixed(2)}
                  {/if}
                </option>
              {/each}
            </select>
            <input
              type="number"
              min="1"
              placeholder="Qté"
              bind:value={selectedQuantity}
            />
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Prix d'achat"
              bind:value={selectedPrice}
            />
            <button type="button" class="btn-add" on:click={addOrderItem}>
              Ajouter
            </button>
          </div>
          <div class="total-display">
            <strong>Total: €{formData.total_price.toFixed(2)}</strong>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn-secondary" on:click={closeModal}>
        Annuler
      </button>
      <button type="submit" class="btn-primary">Créer la commande</button>
    </div>
  </form>
</Modal>

<!-- Modal d'édition -->
<Modal
  show={showEditModal}
  title="Modifier la commande"
  modalId="modal-title-edit"
  on:close={closeEditModal}
>
  <form on:submit|preventDefault={handleUpdate}>
    <div class="form-grid">
      <div class="form-group">
        <label for="edit-date">Date *</label>
        <input type="date" id="edit-date" bind:value={formData.date} required />
      </div>

      <div class="form-group">
        <label for="edit-supplier_id">Fournisseur *</label>
        <select
          id="edit-supplier_id"
          bind:value={formData.supplier_id}
          required
        >
          <option value="">Sélectionner un fournisseur</option>
          {#each suppliers as supplier}
            <option value={supplier.id}>{supplier.name}</option>
          {/each}
        </select>
      </div>

      <div class="form-group full-width">
        <label for="edit-note">Note</label>
        <textarea id="edit-note" bind:value={formData.note} rows="2"></textarea>
      </div>

      <div class="form-group full-width">
        <div class="section-title">Articles *</div>
        <div class="order-items-container">
          {#if orderItems.length === 0}
            <p class="empty-text">Aucun article ajouté</p>
          {:else}
            <div class="order-items-list">
              {#each orderItems as item, index}
                <div class="order-item">
                  <span>
                    {getProductDisplayNameWithYear(item.wine_vintage)} - x{item.quantity}
                    @ €{item.price.toFixed(2)} = €{calculateItemTotal(
                      item
                    ).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    class="btn-remove"
                    on:click={() => removeOrderItem(index)}
                  >
                    ×
                  </button>
                </div>
              {/each}
            </div>
          {/if}
          <div class="add-item-form">
            <select
              bind:value={selectedVintageId}
              on:change={handleVintageChange}
            >
              <option value="">Sélectionner un produit</option>
              {#each wineVintages as vintage}
                {@const alreadyAdded = isVintageAlreadyAdded(vintage.id)}
                <option value={vintage.id} disabled={alreadyAdded}>
                  {getProductDisplayNameWithYear(vintage)}
                  {#if vintage.purchase_price}
                    - €{vintage.purchase_price.toFixed(2)}
                  {/if}
                </option>
              {/each}
            </select>
            <input
              type="number"
              min="1"
              placeholder="Qté"
              bind:value={selectedQuantity}
            />
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Prix d'achat"
              bind:value={selectedPrice}
            />
            <button type="button" class="btn-add" on:click={addOrderItem}>
              Ajouter
            </button>
          </div>
          <div class="total-display">
            <strong>Total: €{formData.total_price.toFixed(2)}</strong>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn-secondary" on:click={closeEditModal}>
        Annuler
      </button>
      <button type="submit" class="btn-primary">Enregistrer</button>
    </div>
  </form>
</Modal>

<!-- Modal de détails -->
<Modal
  show={showDetailsModal}
  title="Détails de la commande"
  modalId="modal-title-details"
  on:close={closeDetailsModal}
>
  {#if detailsOrder}
    <div class="details-content">
      <div class="details-grid">
        <div class="details-group">
          <div class="details-section">
            <strong>Fournisseur:</strong>
            <p>{detailsOrder.supplier.name}</p>
          </div>
          <div class="details-section">
            <strong>Date:</strong>
            <p>{new Date(detailsOrder.date).toLocaleDateString("fr-FR")}</p>
          </div>
          {#if detailsOrder.transport}
            <div class="details-section">
              <strong>Transport:</strong>
              <p>{detailsOrder.transport.transporter.name}</p>
            </div>
          {/if}
        </div>
      </div>

      <div class="details-section">
        <strong>Articles:</strong>
        <div class="details-items-list">
          {#each detailsOrderItems as item}
            <div class="details-item">
              <div class="details-item-name">
                {getProductDisplayNameWithYear(item.wine_vintage)}
              </div>
              <div class="details-item-details">
                x{item.quantity} @ €{item.price?.toFixed(2) || "0.00"} = €{(
                  (item.price || 0) * item.quantity
                ).toFixed(2)}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <div class="details-total">
        <strong>Total: €{detailsOrder.total_price?.toFixed(2) || "0.00"}</strong
        >
      </div>

      {#if detailsOrder.note}
        <div class="details-section">
          <strong>Note:</strong>
          <p>{detailsOrder.note}</p>
        </div>
      {/if}
    </div>
  {/if}
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

  .btn-details {
    padding: 0.4rem 0.8rem;
    background: #17a2b8;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .btn-details:hover {
    background: #138496;
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

  .section-title {
    margin-bottom: 0.5rem;
    color: #333;
    font-weight: 500;
    font-size: 0.9rem;
  }

  .order-items-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .order-items-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid #ced4da;
    border-radius: 4px;
    padding: 0.5rem;
  }

  .order-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: #f8f9fa;
    border-radius: 4px;
    font-size: 0.9rem;
  }

  .add-item-form {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .add-item-form select {
    flex: 1;
    min-width: 200px;
  }

  .add-item-form input {
    width: 80px;
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

  .btn-add:hover {
    background: #218838;
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

  .empty-text {
    color: #666;
    font-style: italic;
    font-size: 0.9rem;
    text-align: center;
    padding: 1rem;
  }

  .total-display {
    text-align: right;
    padding-top: 0.5rem;
    border-top: 1px solid #dee2e6;
    font-size: 1.1rem;
  }

  .details-content {
    padding: 1.5rem;
  }

  .details-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .details-group {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .details-section {
    margin-bottom: 1rem;
  }

  .details-section strong {
    display: block;
    margin-bottom: 0.5rem;
    color: #333;
  }

  .details-section p {
    margin: 0;
    color: #666;
  }

  .details-items-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .details-item {
    padding: 0.75rem;
    background: #f8f9fa;
    border-radius: 4px;
  }

  .details-item-name {
    font-weight: 500;
    margin-bottom: 0.25rem;
  }

  .details-item-details {
    font-size: 0.9rem;
    color: #666;
  }

  .details-total {
    text-align: right;
    padding-top: 1rem;
    border-top: 2px solid #dee2e6;
    font-size: 1.2rem;
    margin-top: 1rem;
  }
</style>
