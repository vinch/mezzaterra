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
  import { formatDate, formatEUR } from "$lib/format";
  import { vintageProductLabel } from "$lib/wine";

  export let data: PageData;

  let transports: any[];
  /* Rechargé par invalidateAll() après une création, une modification ou une suppression. */
  $: transports = data.transports;
  let transporters: any[] = [];
  let loading = true;
  let error = "";
  /** Modale unique création / édition (`editingTransport` les distingue). */
  let formOpen = false;
  let saving = false;
  let showOrdersModal = false;
  let showDetailsModal = false;
  let editingTransport: any = null;
  let selectedTransport: any = null;
  let detailsTransport: any = null;
  let detailsOrders: any[] = [];
  let availableOrders: any[] = [];
  let associatedOrders: any[] = [];
  let selectedOrderIds: string[] = [];

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
    formOpen = true;
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
    formOpen = true;
  }

  function closeForm() {
    formOpen = false;
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

  /** Création (toujours « En attente ») ou modification ; le statut se change dans le tableau. */
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
    if (!formData.transporter_id) {
      error = "Le transporteur est obligatoire";
      return;
    }

    const transportData = {
      transporter_id: formData.transporter_id,
      departure_date: formData.departure_date || null,
      arrival_date: formData.arrival_date || null,
      pallets_number: formData.pallets_number
        ? parseInt(formData.pallets_number)
        : null,
      price: formData.price ? parseFloat(formData.price) : null,
      note: formData.note || null,
    };

    const { error: saveError } = editingTransport
      ? await supabase.from("transport").update(transportData).eq("id", editingTransport.id)
      : await supabase.from("transport").insert({ ...transportData, status: "pending" });

    if (saveError) {
      error = saveError.message;
      return;
    }

    error = "";
    closeForm();
    error = "";
    await invalidateAll();
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

    error = "";
    await invalidateAll();
  }

  async function updateTransportStatus(
    transportId: string,
    newStatus: string,
    currentStatus: string
  ): Promise<boolean> {
    // Confirmation for status change to "delivered"
    if (newStatus === "delivered" && currentStatus !== "delivered") {
      if (
        !confirm(
          "Êtes-vous sûr de vouloir marquer ce transport comme livré ?\n\nCette action va créer des mouvements de stock pour tous les vins des commandes associées."
        )
      ) {
        return false;
      }
    }

    /* Statut et entrée en stock à la livraison en une transaction (fonction SQL set_transport_status). */
    const { error: statusError } = await supabase.rpc("set_transport_status", {
      p_transport_id: transportId,
      p_status: newStatus,
    });

    if (statusError) {
      error = statusError.message;
      return false;
    }

    // Update the local state
    const transportIndex = transports.findIndex((t) => t.id === transportId);
    if (transportIndex !== -1) {
      transports[transportIndex].status = newStatus;
      transports = [...transports];
    }

    return true;
  }

  async function openOrdersModal(transport: any) {
    selectedTransport = transport;
    selectedOrderIds = [];
    await Promise.all([loadAvailableOrders(), loadAssociatedOrders(transport.id)]);
    showOrdersModal = true;
  }

  function closeOrdersModal() {
    showOrdersModal = false;
    selectedTransport = null;
    selectedOrderIds = [];
    availableOrders = [];
    associatedOrders = [];
  }

  async function openDetailsModal(transport: any) {
    detailsTransport = transport;
    await loadDetailsOrders(transport.id);
    showDetailsModal = true;
  }

  function closeDetailsModal() {
    showDetailsModal = false;
    detailsTransport = null;
    detailsOrders = [];
  }

  async function loadDetailsOrders(transportId: string) {
    const { data: orders, error: ordersError } = await supabase
      .from("order")
      .select(
        `
        *,
        supplier (*),
        order_item (
          *,
          wine_vintage (
            *,
            wine (
              *,
              winery (*),
              appelation (*)
            )
          )
        )
      `
      )
      .eq("transport_id", transportId)
      .order("date", { ascending: false });

    if (ordersError) {
      error = ordersError.message;
      return;
    }

    detailsOrders = orders || [];
  }

  async function loadAvailableOrders() {
    const { data, error: fetchError } = await supabase
      .from("order")
      .select(
        `
        *,
        supplier (*)
      `
      )
      .is("transport_id", null)
      .eq("status", "confirmed")
      .order("date", { ascending: false });

    if (fetchError) {
      error = fetchError.message;
      return;
    }

    availableOrders = data || [];
  }

  async function loadAssociatedOrders(transportId: string) {
    const { data, error: fetchError } = await supabase
      .from("order")
      .select(
        `
        *,
        supplier (*)
      `
      )
      .eq("transport_id", transportId)
      .order("date", { ascending: false });

    if (fetchError) {
      error = fetchError.message;
      return;
    }

    associatedOrders = data || [];
  }

  function toggleOrderSelection(orderId: string) {
    if (selectedOrderIds.includes(orderId)) {
      selectedOrderIds = selectedOrderIds.filter((id) => id !== orderId);
    } else {
      selectedOrderIds = [...selectedOrderIds, orderId];
    }
  }

  async function associateOrders() {
    if (!selectedTransport || selectedOrderIds.length === 0) {
      error = "Veuillez sélectionner au moins une commande";
      return;
    }

    /* Tout ou rien, transport verrouillé (fonction SQL attach_orders_to_transport). */
    const { error: attachError } = await supabase.rpc("attach_orders_to_transport", {
      p_transport_id: selectedTransport.id,
      p_order_ids: selectedOrderIds,
    });

    if (attachError) {
      error = attachError.message;
      return;
    }

    error = "";
    closeOrdersModal();
    await invalidateAll();
  }
</script>

<svelte:head>
  <title>Transports - Gestion</title>
</svelte:head>

<ManagePageShell title="Transports">
  <svelte:fragment slot="actions">
    <button class="btn-primary" on:click={openCreateModal}>+ Nouveau transport</button>
  </svelte:fragment>

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
              <th>Nb commandes</th>
              <th>Nb palettes</th>
              <th>Prix</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each transports as transport}
              <tr>
                <td><strong>{transport.transporter.name}</strong></td>
                <td>
                  {#if transport.departure_date}
                    {formatDate(transport.departure_date)}
                  {:else}
                    -
                  {/if}
                </td>
                <td>
                  {#if transport.arrival_date}
                    {formatDate(transport.arrival_date)}
                  {:else}
                    -
                  {/if}
                </td>
                <td>
                  <select
                    class="status-select tone-{statusMeta("transport", transport.status).tone}"
                    value={transport.status}
                    disabled={transport.status === "delivered"}
                    title={transport.status === "delivered" ? "Livré : le stock est entré, le statut est définitif" : undefined}
                    on:change={async (e) => {
                      const target = e.target as HTMLSelectElement;
                      const previousStatus = transport.status;
                      const newStatus = target.value;

                      // Try to update, if cancelled, restore previous value
                      const success = await updateTransportStatus(
                        transport.id,
                        newStatus,
                        previousStatus
                      );

                      // If update failed (user cancelled or error), restore select value
                      if (!success) {
                        target.value = previousStatus;
                        // Force reactivity by triggering a small delay
                        await new Promise((resolve) => setTimeout(resolve, 0));
                        transports = [...transports];
                      }
                    }}
                  >
                    {#each Object.entries(KIND_META.transport) as [value, meta]}<option {value}>{meta.label}</option>{/each}
                  </select>
                </td>
                <td>
                  <strong>{transport.order_count || 0}</strong>
                </td>
                <td>{transport.pallets_number || "-"}</td>
                <td>
                  {#if transport.price}
                    {formatEUR(transport.price)}
                  {:else}
                    -
                  {/if}
                </td>
                <td>
                  <div class="actions">
                    {#if transport.status === "delivered" || transport.status === "cancelled"}
                      <button
                        class="ui-btn ui-btn--secondary ui-btn--sm"
                        on:click={() => openDetailsModal(transport)}
                      >
                        Détails
                      </button>
                    {:else}
                      <button
                        class="ui-btn ui-btn--secondary ui-btn--sm"
                        on:click={() => openOrdersModal(transport)}
                      >
                        Associer des commandes
                      </button>
                      <button
                        class="ui-btn ui-btn--secondary ui-btn--sm"
                        on:click={() => openEditModal(transport)}
                      >
                        Modifier
                      </button>
                      <button
                        class="ui-btn ui-btn--danger ui-btn--sm"
                        on:click={() => deleteTransport(transport.id)}
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
<Modal open={formOpen} title={editingTransport ? "Modifier le transport" : "Nouveau transport"} on:close={closeForm}>
  <form id="transport-form" on:submit|preventDefault={submitForm}>
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
  </form>
  <svelte:fragment slot="footer">
    <Button variant="ghost" on:click={closeForm}>Annuler</Button>
    <Button variant="primary" type="submit" form="transport-form" disabled={saving}>{editingTransport ? "Enregistrer" : "Créer le transport"}</Button>
  </svelte:fragment>
</Modal>

<!-- Modal d'association de commandes -->
<Modal open={showOrdersModal} title="Associer des commandes au transport" on:close={closeOrdersModal}>
  {#if selectedTransport}
    <div class="orders-modal-content">
      <p class="modal-description">
        Sélectionnez les commandes à associer au transport
        <strong>{selectedTransport.transporter.name}</strong>
      </p>

      {#if associatedOrders.length > 0}
        <div class="section-title">Commandes déjà associées</div>
        <div class="orders-list orders-list-readonly">
          {#each associatedOrders as order}
            <div class="order-item-readonly">
              <div class="order-info">
                <div class="order-header">
                  <div>
                    <strong>
                      {formatDate(order.date)} - {order
                        .supplier.name}
                    </strong>
                    <StatusBadge kind="order" status={order.status} />
                  </div>
                  <span class="order-total">
                    {formatEUR(order.total_price ?? 0)}
                  </span>
                </div>
                {#if order.note}
                  <div class="order-note">{order.note}</div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      {#if associatedOrders.length > 0 && availableOrders.length > 0}
        <div class="section-title" style="margin-top: 1.5rem;">
          Commandes disponibles
        </div>
      {/if}

      {#if availableOrders.length === 0}
        {#if associatedOrders.length === 0}
          <p class="empty-text">
            Aucune commande confirmée disponible (seules les commandes
            confirmées peuvent être associées à un transport)
          </p>
        {:else}
          <p class="empty-text">Aucune autre commande confirmée disponible</p>
        {/if}
      {:else}
        <div class="orders-list">
          {#each availableOrders as order}
            <label class="order-checkbox">
              <input
                type="checkbox"
                checked={selectedOrderIds.includes(order.id)}
                on:change={() => toggleOrderSelection(order.id)}
              />
              <div class="order-info">
                <div class="order-header">
                  <div>
                    <strong>
                      {formatDate(order.date)} - {order
                        .supplier.name}
                    </strong>
                    <StatusBadge kind="order" status={order.status} />
                  </div>
                  <span class="order-total">
                    {formatEUR(order.total_price ?? 0)}
                  </span>
                </div>
                {#if order.note}
                  <div class="order-note">{order.note}</div>
                {/if}
              </div>
            </label>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
  <svelte:fragment slot="footer">
    <Button variant="ghost" on:click={closeOrdersModal}>Annuler</Button>
    <Button variant="primary" on:click={associateOrders} disabled={selectedOrderIds.length === 0}>Associer {selectedOrderIds.length > 0 ? `(${selectedOrderIds.length})` : ""}</Button>
  </svelte:fragment>
</Modal>

<!-- Modal de détails -->
<Modal open={showDetailsModal} title="Détails du transport" on:close={closeDetailsModal}>
  {#if detailsTransport}
    <div class="details-content">
      <div class="details-grid">
        <div class="details-group">
          <div class="details-label">Transporteur</div>
          <div><strong>{detailsTransport.transporter.name}</strong></div>
        </div>

        <div class="details-group">
          <div class="details-label">Statut</div>
          <div>
            <StatusBadge kind="transport" status={detailsTransport.status} />
          </div>
        </div>

        <div class="details-group">
          <div class="details-label">Date de départ</div>
          <div>
            {#if detailsTransport.departure_date}
              {formatDate(detailsTransport.departure_date)}
            {:else}
              -
            {/if}
          </div>
        </div>

        <div class="details-group">
          <div class="details-label">Date d'arrivée</div>
          <div>
            {#if detailsTransport.arrival_date}
              {formatDate(detailsTransport.arrival_date)}
            {:else}
              -
            {/if}
          </div>
        </div>

        <div class="details-group">
          <div class="details-label">Nombre de palettes</div>
          <div>{detailsTransport.pallets_number || "-"}</div>
        </div>

        <div class="details-group">
          <div class="details-label">Prix</div>
          <div>
            {#if detailsTransport.price}
              <strong>{formatEUR(detailsTransport.price)}</strong>
            {:else}
              -
            {/if}
          </div>
        </div>

        {#if detailsTransport.note}
          <div class="details-group full-width">
            <div class="details-label">Note</div>
            <div>{detailsTransport.note}</div>
          </div>
        {/if}
      </div>

      <div class="details-section">
        <h3>Commandes associées</h3>
        {#if detailsOrders.length === 0}
          <p class="empty-text">Aucune commande associée</p>
        {:else}
          <div class="details-orders-list">
            {#each detailsOrders as order}
              <div class="details-order">
                <div class="details-order-header">
                  <div class="details-order-info">
                    <strong>
                      {formatDate(order.date)} - {order
                        .supplier.name}
                    </strong>
                    <span class="details-order-total">
                      Total : {formatEUR(order.total_price ?? 0)}
                    </span>
                  </div>
                </div>
                {#if order.note}
                  <div class="details-order-note">{order.note}</div>
                {/if}
                {#if order.order_item && order.order_item.length > 0}
                  <div class="details-order-items">
                    {#each order.order_item as item}
                      <div class="details-order-item">
                        <div class="details-order-item-name">
                          {vintageProductLabel(item.wine_vintage)}
                        </div>
                        <div class="details-order-item-details">
                          <span>x{item.quantity}</span>
                          {#if item.price}
                            <span>@ {formatEUR(item.price)}</span>
                            <strong>= {formatEUR(item.price * item.quantity)}</strong>
                          {/if}
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</Modal>

<style>

  /* Orders modal styles */

  .modal-description {
    margin-bottom: 1.5rem;
    color: var(--ink-2);
    font-size: 0.95rem;
  }

  .modal-description strong {
    color: var(--ink);
  }

  .orders-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-height: 400px;
    overflow-y: auto;
    margin-bottom: 1.5rem;
    padding: 0.5rem;
    border: 1px solid var(--border-soft);
    border-radius: 4px;
  }

  .order-checkbox {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--table-head);
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .order-checkbox:hover {
    background: var(--border-soft);
  }

  .order-checkbox input[type="checkbox"] {
    margin-top: 0.25rem;
    cursor: pointer;
  }

  .order-info {
    flex: 1;
  }

  .order-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
  }

  .order-header > div {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .order-header strong {
    color: var(--ink);
    font-size: 0.95rem;
  }

  .order-total {
    color: var(--teal-600);
    font-weight: 600;
    font-size: 0.95rem;
  }

  .order-note {
    color: var(--ink-2);
    font-size: 0.85rem;
    font-style: italic;
    margin-top: 0.25rem;
  }

  .empty-text {
    text-align: center;
    color: var(--ink-2);
    padding: 2rem;
    font-style: italic;
  }

  .section-title {
    margin-bottom: 0.75rem;
    color: var(--ink);
    font-weight: 600;
    font-size: 1rem;
  }

  .orders-list-readonly {
    background: var(--table-head);
    opacity: 0.8;
  }

  .order-item-readonly {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--border-soft);
    border-radius: 4px;
    cursor: default;
  }

  .order-item-readonly .order-info {
    flex: 1;
  }

  .order-item-readonly .order-header strong {
    color: var(--ink-2);
  }

  .order-item-readonly .order-total {
    color: var(--ink-2);
  }

  .btn-primary:disabled:hover {
    background: #ccc;
  }

  /* Details modal styles */

  .details-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .details-group {
    display: flex;
    flex-direction: column;
  }

  .details-group.full-width {
    grid-column: 1 / -1;
  }

  .details-label {
    margin-bottom: 0.5rem;
    color: var(--ink-2);
    font-weight: 600;
    font-size: 0.9rem;
  }

  .details-group div {
    color: var(--ink);
  }

  .details-section {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border-soft);
  }

  .details-section h3 {
    margin-top: 0;
    margin-bottom: 1rem;
    color: var(--ink);
    font-size: 1.1rem;
  }

  .details-orders-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .details-order {
    padding: 1rem;
    background: var(--table-head);
    border-radius: 4px;
    border: 1px solid var(--border-soft);
  }

  .details-order-header {
    margin-bottom: 0.5rem;
  }

  .details-order-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .details-order-info strong {
    color: var(--ink);
    font-size: 1rem;
  }

  .details-order-total {
    color: var(--teal-600);
    font-weight: 600;
    font-size: 1rem;
  }

  .details-order-note {
    color: var(--ink-2);
    font-size: 0.85rem;
    font-style: italic;
    margin-bottom: 0.75rem;
    margin-top: 0.5rem;
  }

  .details-order-items {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border);
  }

  .details-order-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: white;
    border-radius: 4px;
  }

  .details-order-item-name {
    flex: 1;
    color: var(--ink);
    font-weight: 500;
    font-size: 0.9rem;
  }

  .details-order-item-details {
    display: flex;
    gap: 1rem;
    align-items: center;
    color: var(--ink-2);
    font-size: 0.9rem;
  }

  .details-order-item-details strong {
    color: var(--ink);
    font-size: 0.95rem;
  }
</style>
