<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import { invalidateAll } from "$app/navigation";
  import type { PageData } from "./$types";
  import Modal from "$lib/ui/Modal.svelte";
  import Button from "$lib/ui/Button.svelte";
  import StatusBadge from "$lib/ui/StatusBadge.svelte";
  import { KIND_META, statusMeta } from "$lib/status";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import { fetchPickerVintages, orderItemPrice } from "$lib/manageData";
  import { todayIso } from "$lib/dates";
  import type { OrderPdfLanguage } from "$lib/pdf/purchaseOrderPdf";
  import { formatDate, formatEUR } from "$lib/format";
  import { isDiscontinued, vintageProductLabel } from "$lib/wine";

  export let data: PageData;

  let orders: any[];
  /* Rechargé par invalidateAll() après une création, une modification ou une suppression. */
  $: orders = data.orders;
  let suppliers: any[] = [];
  let wineVintages: any[] = [];
  let loading = true;
  let error = "";
  /** Modale unique création / édition (`editingOrder` les distingue). */
  let formOpen = false;
  let saving = false;
  let showDetailsModal = false;
  let showLanguageModal = false;
  let editingOrder: any = null;
  let detailsOrder: any = null;
  let detailsOrderItems: any[] = [];
  let orderIdForPDF: string | null = null;

  // Form fields
  let formData = {
    date: todayIso(),
    supplier_id: "",
    status: "pending",
    note: "",
  };

  // Order items
  let orderItems: any[] = [];
  let selectedVintageId = "";
  let selectedQuantity = "";
  let selectedPrice = "";

  onMount(async () => {
    await Promise.all([loadSuppliers(), fetchPickerVintages().then((v) => (wineVintages = v))]);
    loading = false;
  });

  async function loadSuppliers() {
    const { data } = await supabase.from("supplier").select("*").order("name");
    if (data) suppliers = data;
  }

  function openCreateModal() {
    editingOrder = null;
    resetForm();
    formOpen = true;
  }

  async function openEditModal(order: any) {
    if (order.status === "confirmed") {
      error = "Impossible de modifier une commande confirmée";
      return;
    }

    editingOrder = order;
    formData = {
      date: order.date.split("T")[0],
      supplier_id: order.supplier_id || "",
      status: order.status || "pending",
      note: order.note || "",
    };
    const [vintages, items] = await Promise.all([fetchPickerVintages(), loadOrderItems(order.id)]);
    wineVintages = vintages;
    orderItems = items.map((item: any) => ({
      wine_vintage: item.wine_vintage,
      wine_vintage_id: item.wine_vintage_id,
      quantity: item.quantity,
      price: orderItemPrice(item),
      note: item.note || "",
    }));
    formOpen = true;
  }

  async function loadOrderItems(orderId: string): Promise<any[]> {
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

    return data || [];
  }

  function closeForm() {
    formOpen = false;
    editingOrder = null;
    resetForm();
  }

  async function openDetailsModal(order: any) {
    detailsOrder = order;
    detailsOrderItems = await loadOrderItems(order.id);
    showDetailsModal = true;
  }

  function closeDetailsModal() {
    showDetailsModal = false;
    detailsOrder = null;
    detailsOrderItems = [];
  }

  function resetForm() {
    formData = {
      date: todayIso(),
      supplier_id: "",
      status: "pending",
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

  $: total = orderItems.reduce((sum, item) => sum + calculateItemTotal(item), 0);

  /* On ne recommande pas un millésime « plus jamais disponible ». */
  $: orderableVintages = wineVintages.filter((v) => !isDiscontinued(v));

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
      error = ""; // Clear any previous errors
    }
  }

  function removeOrderItem(index: number) {
    orderItems = orderItems.filter((_, i) => i !== index);
    selectedVintageId = "";
  }

  /** Création ou modification (selon `editingOrder`) de la commande et de ses lignes. */
  async function submitForm() {
    if (saving) return;
    saving = true;
    try {
      await saveForm();
    } finally {
      saving = false;
    }
  }

  async function saveForm() {
    if (!formData.supplier_id || orderItems.length === 0) {
      error = "Le fournisseur et au moins un article sont obligatoires";
      return;
    }

    const orderData = {
      date: formData.date,
      supplier_id: formData.supplier_id,
      status: formData.status || "pending",
      total_price: total,
      note: formData.note || null,
    };

    let orderId: string;
    if (editingOrder) {
      orderId = editingOrder.id;
      const { error: updateError } = await supabase
        .from("order")
        .update(orderData)
        .eq("id", orderId);

      if (updateError) {
        error = updateError.message;
        return;
      }

      // Delete existing order items
      const { error: deleteError } = await supabase
        .from("order_item")
        .delete()
        .eq("order_id", orderId);

      if (deleteError) {
        error = deleteError.message;
        return;
      }
    } else {
      const { data: newOrder, error: insertError } = await supabase
        .from("order")
        .insert({ ...orderData, transport_id: null })
        .select("id")
        .single();

      if (insertError) {
        error = insertError.message;
        return;
      }
      orderId = newOrder.id;
    }

    const { error: itemError } = await supabase.from("order_item").insert(
      orderItems.map((item) => ({
        order_id: orderId,
        wine_vintage_id: item.wine_vintage_id,
        quantity: item.quantity,
        price: item.price,
        note: item.note || null,
      })),
    );

    if (itemError) {
      error = itemError.message;
      return;
    }

    error = "";
    closeForm();
    error = "";
    await invalidateAll();
  }

  async function updateOrderStatus(
    orderId: string,
    newStatus: string,
    currentStatus: string
  ): Promise<boolean> {
    // Prevent changing status if already confirmed
    if (currentStatus === "confirmed") {
      error = "Impossible de modifier le statut d'une commande confirmée";
      return false;
    }

    const { error: updateError } = await supabase
      .from("order")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (updateError) {
      error = updateError.message;
      return false;
    }

    // Update the local state
    const orderIndex = orders.findIndex((o) => o.id === orderId);
    if (orderIndex !== -1) {
      orders[orderIndex].status = newStatus;
      orders = [...orders];
    }

    return true;
  }

  async function deleteOrder(id: string) {
    // Find the order to check its status
    const order = orders.find((o) => o.id === id);
    if (order && order.status === "confirmed") {
      error = "Impossible de supprimer une commande confirmée";
      return;
    }

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

    error = "";
    await invalidateAll();
  }


  function openLanguageModal(orderId: string) {
    orderIdForPDF = orderId;
    showLanguageModal = true;
  }

  function closeLanguageModal() {
    showLanguageModal = false;
    orderIdForPDF = null;
  }

  async function downloadOrderPDF(orderId: string, lang: OrderPdfLanguage) {
    try {
      /* jsPDF n'est chargé qu'au moment de générer le document. */
      const { downloadOrderPdf } = await import("$lib/pdf/purchaseOrderPdf");
      await downloadOrderPdf(orderId, lang);
    } catch (err) {
      error = `Erreur lors de la génération du PDF : ${err instanceof Error ? err.message : err}`;
      console.error(err);
    }
  }
</script>

<svelte:head>
  <title>Commandes - Gestion</title>
</svelte:head>

<ManagePageShell title="Commandes">
  <svelte:fragment slot="actions">
    <button class="btn-primary" on:click={openCreateModal}>+ Nouvelle commande</button>
  </svelte:fragment>

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
              <th>Statut</th>
              <th>Montant total</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each orders as order}
              <tr>
                <td>{formatDate(order.date)}</td>
                <td><strong>{order.supplier.name}</strong></td>
                <td>
                  {#if order.transport}
                    <div style="line-height: 1.4;">
                      <div>
                        <strong>{order.transport.transporter.name}</strong>
                      </div>
                      {#if order.transport.departure_date}
                        <div
                          style="font-size: 0.85rem; color: #666; margin-top: 0.15rem; line-height: 1.2;"
                        >
                          {formatDate(order.transport.departure_date)}
                        </div>
                      {:else if order.transport.arrival_date}
                        <div
                          style="font-size: 0.85rem; color: #666; margin-top: 0.15rem; line-height: 1.2;"
                        >
                          {formatDate(order.transport.arrival_date)}
                        </div>
                      {/if}
                    </div>
                  {:else}
                    -
                  {/if}
                </td>
                <td>
                  <select
                    class="status-select tone-{statusMeta("order", order.status).tone}"
                    value={order.status || "pending"}
                    disabled={order.status === "confirmed"}
                    on:change={async (e) => {
                      const target = e.target as HTMLSelectElement;
                      const previousStatus = order.status || "pending";
                      const newStatus = target.value;

                      // Try to update, if failed, restore previous value
                      const success = await updateOrderStatus(
                        order.id,
                        newStatus,
                        previousStatus
                      );

                      // If update failed, restore select value
                      if (!success) {
                        target.value = previousStatus;
                        // Force reactivity by triggering a small delay
                        await new Promise((resolve) => setTimeout(resolve, 0));
                        orders = [...orders];
                      }
                    }}
                  >
                    {#each Object.entries(KIND_META.order) as [value, meta]}<option {value}>{meta.label}</option>{/each}
                  </select>
                </td>
                <td>
                  <strong>{formatEUR(order.total_price ?? 0)}</strong>
                </td>
                <td>
                  <div class="actions">
                    <button
                      class="ui-btn ui-btn--secondary ui-btn--sm"
                      on:click={() => openLanguageModal(order.id)}
                      title="Exporter en PDF"
                    >
                      PDF
                    </button>
                    {#if order.status === "confirmed" || (order.transport && (order.transport.status === "delivered" || order.transport.status === "cancelled"))}
                      <button
                        class="ui-btn ui-btn--secondary ui-btn--sm"
                        on:click={() => openDetailsModal(order)}
                      >
                        Détails
                      </button>
                    {:else}
                      <button
                        class="ui-btn ui-btn--secondary ui-btn--sm"
                        on:click={() => openEditModal(order)}
                      >
                        Modifier
                      </button>
                      <button
                        class="ui-btn ui-btn--danger ui-btn--sm"
                        on:click={() => deleteOrder(order.id)}
                      >
                        Supprimer
                      </button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
</ManagePageShell>

<!-- Modal de création / édition -->
<Modal open={formOpen} title={editingOrder ? "Modifier la commande" : "Nouvelle commande"} on:close={closeForm}>
  <form id="order-form" on:submit|preventDefault={submitForm}>
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
                    {vintageProductLabel(item.wine_vintage)} - x{item.quantity}
                    @ {formatEUR(item.price)} = {formatEUR(calculateItemTotal(item))}
                  </span>
                  <button
                    type="button"
                    class="ui-remove"
                    on:click={() => removeOrderItem(index)}
                  >
                    ×
                  </button>
                </div>
              {/each}
            </div>
          {/if}
          <div class="add-item-form">
            {#key orderItems.map((i) => i.wine_vintage_id).join("|")}
              <select
                bind:value={selectedVintageId}
                on:change={handleVintageChange}
              >
                <option value="">Sélectionner un produit</option>
                {#each orderableVintages as vintage}
                  {@const alreadyAdded = isVintageAlreadyAdded(vintage.id)}
                  <option value={vintage.id} disabled={alreadyAdded}>
                    {vintageProductLabel(vintage)}
                  </option>
                {/each}
              </select>
            {/key}
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
            <button type="button" class="ui-btn ui-btn--secondary ui-btn--sm" on:click={addOrderItem}>
              Ajouter
            </button>
          </div>
          <div class="total-display">
            <strong>Total : {formatEUR(total)}</strong>
          </div>
        </div>
      </div>
    </div>
  </form>
  <svelte:fragment slot="footer">
    <Button variant="ghost" on:click={closeForm}>Annuler</Button>
    <Button variant="primary" type="submit" form="order-form" disabled={saving}>{editingOrder ? "Enregistrer" : "Créer la commande"}</Button>
  </svelte:fragment>
</Modal>

<!-- Modal de détails -->
<Modal open={showDetailsModal} title="Détails de la commande" on:close={closeDetailsModal}>
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
            <p>{formatDate(detailsOrder.date)}</p>
          </div>
          <div class="details-section">
            <strong>Statut:</strong>
            <p>
              <StatusBadge kind="order" status={detailsOrder.status} />
            </p>
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
                {vintageProductLabel(item.wine_vintage)}
              </div>
              <div class="details-item-details">
                x{item.quantity} @ {formatEUR(item.price ?? 0)} = {formatEUR((item.price || 0) * item.quantity)}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <div class="details-total">
        <strong>Total : {formatEUR(detailsOrder.total_price ?? 0)}</strong>
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

<!-- Modal de sélection de langue pour PDF -->
<Modal open={showLanguageModal} title="Choisir la langue pour l'export PDF" on:close={closeLanguageModal}>
  <div class="language-selection">
    <p>Sélectionnez la langue dans laquelle vous souhaitez générer le PDF :</p>
    <div class="language-buttons">
      {#each [["fr", "🇫🇷 Français"], ["en", "🇬🇧 English"], ["it", "🇮🇹 Italiano"]] as [lang, label]}
        <button
          class="btn-language"
          on:click={async () => {
            if (orderIdForPDF) {
              await downloadOrderPDF(orderIdForPDF, lang as OrderPdfLanguage);
              closeLanguageModal();
            }
          }}
        >
          {label}
        </button>
      {/each}
    </div>
  </div>
</Modal>

<style>
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
    border: 1px solid var(--input-border);
    border-radius: 4px;
    padding: 0.5rem;
  }

  .order-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: var(--table-head);
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

  .empty-text {
    color: var(--ink-2);
    font-style: italic;
    font-size: 0.9rem;
    text-align: center;
    padding: 1rem;
  }

  .total-display {
    text-align: right;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border);
    font-size: 1.1rem;
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
    color: var(--ink);
  }

  .details-section p {
    margin: 0;
    color: var(--ink-2);
  }

  .details-items-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .details-item {
    padding: 0.75rem;
    background: var(--table-head);
    border-radius: 4px;
  }

  .details-item-name {
    font-weight: 500;
    margin-bottom: 0.25rem;
  }

  .details-item-details {
    font-size: 0.9rem;
    color: var(--ink-2);
  }

  .details-total {
    text-align: right;
    padding-top: 1rem;
    border-top: 2px solid var(--border);
    font-size: 1.2rem;
    margin-top: 1rem;
  }

</style>
