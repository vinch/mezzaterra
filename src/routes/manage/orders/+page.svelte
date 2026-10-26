<script lang="ts">
  import { preventDefault } from "$lib/ui/events";

  import { NEW_ROW, supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import { invalidateAll } from "$app/navigation";
  import type { PageData } from "./$types";
  import Modal from "$lib/ui/Modal.svelte";
  import Button from "$lib/ui/Button.svelte";
  import StatusBadge from "$lib/ui/StatusBadge.svelte";
  import { KIND_META, statusMeta } from "$lib/status";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import Spinner from "$lib/ui/Spinner.svelte";
  import { fetchPickerVintages } from "$lib/manageData";
  import { errorMessage, latestOnly } from "$lib/async";
  import { todayIso } from "$lib/dates";
  import type { OrderPdfLanguage } from "$lib/pdf/purchaseOrderPdf";
  import { formatDate, formatEUR } from "$lib/format";
  import { isDiscontinued, vintageProductLabel } from "$lib/wine";

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  let orders: any[] = $derived(data.orders);
  /* Rechargé par invalidateAll() après une création, une modification ou une suppression. */
  let suppliers = $state<any[]>([]);
  let wineVintages = $state.raw<any[]>([]);
  let loading = $state(true);
  let error = $state("");
  /** Modale unique création / édition (`editingOrder` les distingue). */
  let formOpen = $state(false);
  let saving = $state(false);
  let showDetailsModal = $state(false);
  let showLanguageModal = $state(false);
  let editingOrder = $state<any>(null);
  let detailsOrder = $state<any>(null);
  let detailsOrderItems = $state<any[]>([]);
  let orderIdForPDF = $state<string | null>(null);

  // Form fields
  let formData = $state({
    date: todayIso(),
    supplier_id: "",
    status: "pending",
    note: "",
  });

  // Order items
  let orderItems = $state<any[]>([]);
  let selectedVintageId = $state("");
  let selectedQuantity = $state("");
  let selectedPrice = $state("");

  onMount(async () => {
    try {
      await Promise.all([loadSuppliers(), fetchPickerVintages().then((v) => (wineVintages = v))]);
    } catch (e) {
      error = errorMessage(e);
    } finally {
      loading = false;
    }
  });

  async function loadSuppliers() {
    const { data } = await supabase.from("supplier").select("*").order("name");
    if (data) suppliers = data;
  }

  /* Chargements des modales : le dernier clic gagne (deux « Modifier » enchaînés…). */
  const formLoad = latestOnly((e) => (error = errorMessage(e)));

  function openCreateModal() {
    error = "";
    formLoad.cancel();
    editingOrder = null;
    resetForm();
    formOpen = true;
  }

  async function openEditModal(order: any) {
    error = "";
    if (order.status === "confirmed") {
      error = "Impossible de modifier une commande confirmée";
      formLoad.cancel();
      return;
    }

    /* Catalogue lu au chargement de la page : relu seulement s'il avait échoué. */
    const loaded = await formLoad.run(() =>
      Promise.all([wineVintages.length ? wineVintages : fetchPickerVintages(), loadOrderItems(order.id)]),
    );
    if (!loaded) return;
    const [vintages, items] = loaded;

    editingOrder = order;
    formData = {
      date: order.date.split("T")[0],
      supplier_id: order.supplier_id || "",
      status: order.status || "pending",
      note: order.note || "",
    };
    wineVintages = vintages;
    orderItems = items.map((item: any) => ({
      wine_vintage: item.wine_vintage,
      wine_vintage_id: item.wine_vintage_id,
      quantity: item.quantity,
      price: item.price,
      note: item.note || "",
    }));
    formOpen = true;
  }

  /** Lève une erreur : une édition ouverte sans ses lignes les effacerait à l'enregistrement. */
  async function loadOrderItems(orderId: string): Promise<any[]> {
    const { data, error: itemsError } = await supabase
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

    if (itemsError) throw new Error(itemsError.message);
    return data || [];
  }

  function closeForm() {
    formOpen = false;
    editingOrder = null;
    resetForm();
  }

  async function openDetailsModal(order: any) {
    const items = await formLoad.run(() => loadOrderItems(order.id));
    if (!items) return;
    detailsOrderItems = items;
    detailsOrder = order;
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

  let total = $derived(orderItems.reduce((sum, item) => sum + calculateItemTotal(item), 0));

  /* On ne recommande pas un millésime « plus jamais disponible ». */
  let orderableVintages = $derived(wineVintages.filter((v) => !isDiscontinued(v)));

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
      status: formData.status,
      note: formData.note || null,
    };

    /* Commande et lignes enregistrées ensemble (fonction SQL save_order) : tout ou rien. */
    const { error: saveError } = await supabase.rpc("save_order", {
      p_order_id: editingOrder?.id ?? NEW_ROW,
      p_order: orderData,
      p_items: orderItems.map((item) => ({
        wine_vintage_id: item.wine_vintage_id,
        quantity: item.quantity,
        price: item.price,
        note: item.note || null,
      })),
    });

    if (saveError) {
      error = saveError.message;
      return;
    }

    error = "";
    closeForm();
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

    /* Filtré sur « non confirmée » : une commande confirmée entre-temps ailleurs ne bouge plus. */
    const { data: updated, error: updateError } = await supabase
      .from("order")
      .update({ status: newStatus })
      .eq("id", orderId)
      .neq("status", "confirmed")
      .select("id");

    if (updateError || !updated?.length) {
      error = updateError?.message ?? "Impossible de modifier le statut d'une commande confirmée";
      return false;
    }

    /* Objet neuf pour la ligne : la liste ($derived, sans proxy) ne suit pas les mutations. */
    orders = orders.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o));

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

    const { data: deleted, error: deleteError } = await supabase
      .from("order")
      .delete()
      .eq("id", id)
      .neq("status", "confirmed")
      .select("id");

    if (deleteError || !deleted?.length) {
      error = deleteError?.message ?? "Impossible de supprimer une commande confirmée";
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
      error = `Erreur lors de la génération du PDF : ${errorMessage(err)}`;
      console.error(err);
    }
  }
</script>

<svelte:head>
  <title>Commandes - Gestion</title>
</svelte:head>

<ManagePageShell title="Commandes">
  {#snippet actions()}
      <button class="btn-primary" onclick={openCreateModal}>+ Nouvelle commande</button>
  {/snippet}

  {#if error}
      <div class="error-message">{error}</div>
    {/if}

    {#if loading}
      <Spinner />
    {:else if orders.length === 0}
      <div class="empty-state">
        <p>Aucune commande trouvée</p>
        <button class="btn-primary" onclick={openCreateModal}>
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
                    onchange={async (e) => {
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
                      onclick={() => openLanguageModal(order.id)}
                      title="Exporter en PDF"
                    >
                      PDF
                    </button>
                    {#if order.status === "confirmed" || (order.transport && (order.transport.status === "delivered" || order.transport.status === "cancelled"))}
                      <button
                        class="ui-btn ui-btn--secondary ui-btn--sm"
                        onclick={() => openDetailsModal(order)}
                      >
                        Détails
                      </button>
                    {:else}
                      <button
                        class="ui-btn ui-btn--secondary ui-btn--sm"
                        onclick={() => openEditModal(order)}
                      >
                        Modifier
                      </button>
                      <button
                        class="ui-btn ui-btn--danger ui-btn--sm"
                        onclick={() => deleteOrder(order.id)}
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
<Modal open={formOpen} title={editingOrder ? "Modifier la commande" : "Nouvelle commande"} onclose={closeForm}>
  <form id="order-form" onsubmit={preventDefault(submitForm)}>
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
                    onclick={() => removeOrderItem(index)}
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
              onchange={handleVintageChange}
            >
              <option value="">Sélectionner un produit</option>
              {#each orderableVintages as vintage}
                {@const alreadyAdded = isVintageAlreadyAdded(vintage.id)}
                <option value={vintage.id} disabled={alreadyAdded}>
                  {vintageProductLabel(vintage)}
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
            <button type="button" class="ui-btn ui-btn--secondary ui-btn--sm" onclick={addOrderItem}>
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
  {#snippet footer()}
      <Button variant="ghost" onclick={closeForm}>Annuler</Button>
      <Button variant="primary" type="submit" form="order-form" disabled={saving}>{editingOrder ? "Enregistrer" : "Créer la commande"}</Button>
  {/snippet}
</Modal>

<!-- Modal de détails -->
<Modal open={showDetailsModal} title="Détails de la commande" onclose={closeDetailsModal}>
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
<Modal open={showLanguageModal} title="Choisir la langue pour l'export PDF" onclose={closeLanguageModal}>
  <div class="language-selection">
    <p>Sélectionnez la langue dans laquelle vous souhaitez générer le PDF :</p>
    <div class="language-buttons">
      {#each [["fr", "🇫🇷 Français"], ["en", "🇬🇧 English"], ["it", "🇮🇹 Italiano"]] as [lang, label]}
        <button
          class="btn-language"
          onclick={async () => {
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
