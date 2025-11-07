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
      status: "pending", // Always set to pending on creation
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
      // Status is managed in the table, not in the edit modal
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

    const { error: updateError } = await supabase
      .from("transport")
      .update({ status: newStatus })
      .eq("id", transportId);

    if (updateError) {
      error = updateError.message;
      return false;
    }

    // If status is changed to "delivered", create stock_move records
    if (newStatus === "delivered" && currentStatus !== "delivered") {
      // Load all orders associated with this transport
      const { data: orders, error: ordersError } = await supabase
        .from("order")
        .select("id")
        .eq("transport_id", transportId);

      if (ordersError) {
        error = `Erreur lors du chargement des commandes: ${ordersError.message}`;
        return false;
      }

      if (orders && orders.length > 0) {
        // Load all order items for all orders
        const orderIds = orders.map((o) => o.id);
        const { data: orderItems, error: itemsError } = await supabase
          .from("order_item")
          .select("wine_vintage_id, quantity")
          .in("order_id", orderIds);

        if (itemsError) {
          error = `Erreur lors du chargement des articles: ${itemsError.message}`;
          return false;
        }

        // Create stock_move for each item
        if (orderItems) {
          for (const item of orderItems) {
            const { error: stockMoveError } = await supabase
              .from("stock_move")
              .insert({
                wine_vintage_id: item.wine_vintage_id,
                reason: "purchase_in",
                quantity: Math.abs(item.quantity), // Positive for in
                date: new Date().toISOString().split("T")[0],
                note: "Réception transport",
              });

            if (stockMoveError) {
              error = `Erreur lors de la création du mouvement de stock: ${stockMoveError.message}`;
              return false;
            }
          }
        }
      }
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
    await loadAvailableOrders();
    await loadAssociatedOrders(transport.id);
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
        supplier (*)
      `
      )
      .eq("transport_id", transportId)
      .order("date", { ascending: false });

    if (ordersError) {
      error = ordersError.message;
      return;
    }

    // Load order items for each order
    if (orders) {
      detailsOrders = await Promise.all(
        orders.map(async (order) => {
          const { data: orderItems, error: itemsError } = await supabase
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
            .eq("order_id", order.id);

          if (itemsError) {
            console.error("Error loading order items:", itemsError);
            return {
              ...order,
              items: [],
              total_price: order.total_price || 0,
            };
          }

          // Calculate total if missing
          let totalPrice = order.total_price || 0;
          if (!totalPrice && orderItems) {
            totalPrice = orderItems.reduce((sum, item) => {
              const price =
                item.price || item.wine_vintage?.purchase_price || 0;
              return sum + price * item.quantity;
            }, 0);
          }

          return {
            ...order,
            items: orderItems || [],
            total_price: totalPrice,
          };
        })
      );
    } else {
      detailsOrders = [];
    }
  }

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
      .order("date", { ascending: false });

    if (fetchError) {
      error = fetchError.message;
      return;
    }

    // Calculate total_price for each order if it's missing or 0
    if (data) {
      availableOrders = await Promise.all(
        data.map(async (order) => {
          // If total_price exists and is not 0, use it
          if (order.total_price != null && order.total_price !== 0) {
            return order;
          }

          // Otherwise, calculate it from order items
          const { data: orderItems } = await supabase
            .from("order_item")
            .select(
              `
              *,
              wine_vintage (
                purchase_price
              )
            `
            )
            .eq("order_id", order.id);

          let totalPrice = 0;
          if (orderItems) {
            totalPrice = orderItems.reduce((sum, item) => {
              // Use price from order_item if it exists, otherwise use purchase_price from wine_vintage
              const price =
                item.price || item.wine_vintage?.purchase_price || 0;
              return sum + price * item.quantity;
            }, 0);
          }

          return {
            ...order,
            total_price: totalPrice,
          };
        })
      );
    } else {
      availableOrders = [];
    }
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

    // Calculate total_price for each order if it's missing or 0
    if (data) {
      associatedOrders = await Promise.all(
        data.map(async (order) => {
          // If total_price exists and is not 0, use it
          if (order.total_price != null && order.total_price !== 0) {
            return order;
          }

          // Otherwise, calculate it from order items
          const { data: orderItems } = await supabase
            .from("order_item")
            .select(
              `
              *,
              wine_vintage (
                purchase_price
              )
            `
            )
            .eq("order_id", order.id);

          let totalPrice = 0;
          if (orderItems) {
            totalPrice = orderItems.reduce((sum, item) => {
              // Use price from order_item if it exists, otherwise use purchase_price from wine_vintage
              const price =
                item.price || item.wine_vintage?.purchase_price || 0;
              return sum + price * item.quantity;
            }, 0);
          }

          return {
            ...order,
            total_price: totalPrice,
          };
        })
      );
    } else {
      associatedOrders = [];
    }
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

    for (const orderId of selectedOrderIds) {
      const { error: updateError } = await supabase
        .from("order")
        .update({ transport_id: selectedTransport.id })
        .eq("id", orderId);

      if (updateError) {
        error = `Erreur lors de l'association de la commande: ${updateError.message}`;
        return;
      }
    }

    closeOrdersModal();
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
                  <select
                    class="status-select status-{transport.status}"
                    value={transport.status}
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
                    <option value="pending">En attente</option>
                    <option value="in_transit">En transit</option>
                    <option value="delivered">Livré</option>
                    <option value="cancelled">Annulé</option>
                  </select>
                </td>
                <td>
                  <strong>{transport.order_count || 0}</strong>
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
                  <div class="actions">
                    {#if transport.status === "delivered" || transport.status === "cancelled"}
                      <button
                        class="btn-details"
                        on:click={() => openDetailsModal(transport)}
                      >
                        Détails
                      </button>
                    {:else}
                      <button
                        class="btn-associate"
                        on:click={() => openOrdersModal(transport)}
                      >
                        Associer des commandes
                      </button>
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
                    {/if}
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

<!-- Modal d'association de commandes -->
<Modal
  show={showOrdersModal}
  title="Associer des commandes au transport"
  modalId="modal-title-orders"
  on:close={closeOrdersModal}
>
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
                  <strong>
                    {new Date(order.date).toLocaleDateString("fr-FR")} - {order
                      .supplier.name}
                  </strong>
                  <span class="order-total">
                    €{order.total_price?.toFixed(2) || "0.00"}
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
            Aucune commande disponible (toutes ont déjà un transport)
          </p>
        {:else}
          <p class="empty-text">Aucune autre commande disponible</p>
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
                  <strong>
                    {new Date(order.date).toLocaleDateString("fr-FR")} - {order
                      .supplier.name}
                  </strong>
                  <span class="order-total">
                    €{order.total_price?.toFixed(2) || "0.00"}
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

      <div class="modal-footer">
        <button type="button" class="btn-secondary" on:click={closeOrdersModal}>
          Annuler
        </button>
        <button
          type="button"
          class="btn-primary"
          on:click={associateOrders}
          disabled={selectedOrderIds.length === 0}
        >
          Associer {selectedOrderIds.length > 0
            ? `(${selectedOrderIds.length})`
            : ""}
        </button>
      </div>
    </div>
  {/if}
</Modal>

<!-- Modal de détails -->
<Modal
  show={showDetailsModal}
  title="Détails du transport"
  modalId="modal-title-details"
  on:close={closeDetailsModal}
>
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
            <span class="status-badge status-{detailsTransport.status}">
              {detailsTransport.status === "pending"
                ? "En attente"
                : detailsTransport.status === "in_transit"
                  ? "En transit"
                  : detailsTransport.status === "delivered"
                    ? "Livré"
                    : "Annulé"}
            </span>
          </div>
        </div>

        <div class="details-group">
          <div class="details-label">Date de départ</div>
          <div>
            {#if detailsTransport.departure_date}
              {new Date(detailsTransport.departure_date).toLocaleDateString(
                "fr-FR"
              )}
            {:else}
              -
            {/if}
          </div>
        </div>

        <div class="details-group">
          <div class="details-label">Date d'arrivée</div>
          <div>
            {#if detailsTransport.arrival_date}
              {new Date(detailsTransport.arrival_date).toLocaleDateString(
                "fr-FR"
              )}
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
              <strong>€{detailsTransport.price.toFixed(2)}</strong>
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
                      {new Date(order.date).toLocaleDateString("fr-FR")} - {order
                        .supplier.name}
                    </strong>
                    <span class="details-order-total">
                      Total: €{order.total_price?.toFixed(2) || "0.00"}
                    </span>
                  </div>
                </div>
                {#if order.note}
                  <div class="details-order-note">{order.note}</div>
                {/if}
                {#if order.items && order.items.length > 0}
                  <div class="details-order-items">
                    {#each order.items as item}
                      <div class="details-order-item">
                        <div class="details-order-item-name">
                          {getProductDisplayNameWithYear(item.wine_vintage)}
                        </div>
                        <div class="details-order-item-details">
                          <span>x{item.quantity}</span>
                          {#if item.price}
                            <span>@ €{item.price.toFixed(2)}</span>
                            <strong
                              >= €{(item.price * item.quantity).toFixed(
                                2
                              )}</strong
                            >
                          {:else if item.wine_vintage?.purchase_price}
                            <span
                              >@ €{item.wine_vintage.purchase_price.toFixed(
                                2
                              )}</span
                            >
                            <strong
                              >= €{(
                                item.wine_vintage.purchase_price * item.quantity
                              ).toFixed(2)}</strong
                            >
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

  .btn-associate {
    padding: 0.4rem 0.8rem;
    background: #17a2b8;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .btn-associate:hover {
    background: #138496;
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

  .status-select {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.85rem;
    font-weight: 500;
    border: 1px solid rgba(0, 0, 0, 0.1);
    cursor: pointer;
    min-width: 120px;
  }

  .status-select.status-pending {
    background: #fff3cd;
    color: #856404;
  }

  .status-select.status-in_transit {
    background: #d1ecf1;
    color: #0c5460;
  }

  .status-select.status-delivered {
    background: #d4edda;
    color: #155724;
  }

  .status-select.status-cancelled {
    background: #f8d7da;
    color: #721c24;
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

  /* Orders modal styles */
  .orders-modal-content {
    padding: 1.5rem;
  }

  .modal-description {
    margin-bottom: 1.5rem;
    color: #666;
    font-size: 0.95rem;
  }

  .modal-description strong {
    color: #333;
  }

  .orders-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-height: 400px;
    overflow-y: auto;
    margin-bottom: 1.5rem;
    padding: 0.5rem;
    border: 1px solid #e9ecef;
    border-radius: 4px;
  }

  .order-checkbox {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    background: #f8f9fa;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .order-checkbox:hover {
    background: #e9ecef;
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

  .order-header strong {
    color: #333;
    font-size: 0.95rem;
  }

  .order-total {
    color: #007bff;
    font-weight: 600;
    font-size: 0.95rem;
  }

  .order-note {
    color: #666;
    font-size: 0.85rem;
    font-style: italic;
    margin-top: 0.25rem;
  }

  .empty-text {
    text-align: center;
    color: #666;
    padding: 2rem;
    font-style: italic;
  }

  .section-title {
    margin-bottom: 0.75rem;
    color: #333;
    font-weight: 600;
    font-size: 1rem;
  }

  .orders-list-readonly {
    background: #f8f9fa;
    opacity: 0.8;
  }

  .order-item-readonly {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    background: #e9ecef;
    border-radius: 4px;
    cursor: default;
  }

  .order-item-readonly .order-info {
    flex: 1;
  }

  .order-item-readonly .order-header strong {
    color: #666;
  }

  .order-item-readonly .order-total {
    color: #666;
  }

  .btn-primary:disabled {
    background: #ccc;
    color: #666;
    cursor: not-allowed;
  }

  .btn-primary:disabled:hover {
    background: #ccc;
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

  /* Details modal styles */
  .details-content {
    padding: 1.5rem;
  }

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
    color: #666;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .details-group div {
    color: #333;
  }

  .details-section {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e9ecef;
  }

  .details-section h3 {
    margin-top: 0;
    margin-bottom: 1rem;
    color: #333;
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
    background: #f8f9fa;
    border-radius: 4px;
    border: 1px solid #e9ecef;
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
    color: #333;
    font-size: 1rem;
  }

  .details-order-total {
    color: #007bff;
    font-weight: 600;
    font-size: 1rem;
  }

  .details-order-note {
    color: #666;
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
    border-top: 1px solid #dee2e6;
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
    color: #333;
    font-weight: 500;
    font-size: 0.9rem;
  }

  .details-order-item-details {
    display: flex;
    gap: 1rem;
    align-items: center;
    color: #666;
    font-size: 0.9rem;
  }

  .details-order-item-details strong {
    color: #333;
    font-size: 0.95rem;
  }
</style>
