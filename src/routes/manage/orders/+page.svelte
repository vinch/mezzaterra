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
  import { errorMessage, latestOnly } from "$lib/async";
  import { parseIsoDate, todayIso } from "$lib/dates";
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
    formLoad.cancel();
    editingOrder = null;
    resetForm();
    formOpen = true;
  }

  async function openEditModal(order: any) {
    if (order.status === "confirmed") {
      error = "Impossible de modifier une commande confirmée";
      return;
    }

    const loaded = await formLoad.run(() => Promise.all([fetchPickerVintages(), loadOrderItems(order.id)]));
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
      price: orderItemPrice(item),
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

  // Translations for PDF
  const translations = {
    fr: {
      documentTitleConfirmed: "COMMANDE",
      documentTitlePending: "DEVIS",
      date: "Date",
      status: "Statut",
      statusConfirmed: "Confirmée",
      statusPending: "En attente",
      description: "Description",
      quantity: "Qté",
      unitPrice: "Prix unitaire",
      total: "Total",
      totalLabel: "TOTAL",
      transport: "Transport",
      transporter: "Transporteur",
      departureDate: "Date de départ",
      arrivalDate: "Date d'arrivée",
      note: "Note",
    },
    en: {
      documentTitleConfirmed: "ORDER",
      documentTitlePending: "QUOTE",
      date: "Date",
      status: "Status",
      statusConfirmed: "Confirmed",
      statusPending: "Pending",
      description: "Description",
      quantity: "Qty",
      unitPrice: "Unit Price",
      total: "Total",
      totalLabel: "TOTAL",
      transport: "Transport",
      transporter: "Transporter",
      departureDate: "Departure Date",
      arrivalDate: "Arrival Date",
      note: "Note",
    },
    it: {
      documentTitleConfirmed: "ORDINE",
      documentTitlePending: "PREVENTIVO",
      date: "Data",
      status: "Stato",
      statusConfirmed: "Confermato",
      statusPending: "In attesa",
      description: "Descrizione",
      quantity: "Qtà",
      unitPrice: "Prezzo unitario",
      total: "Totale",
      totalLabel: "TOTALE",
      transport: "Trasporto",
      transporter: "Trasportatore",
      departureDate: "Data di partenza",
      arrivalDate: "Data di arrivo",
      note: "Nota",
    },
  };

  type Language = "fr" | "en" | "it";

  function openLanguageModal(orderId: string) {
    orderIdForPDF = orderId;
    showLanguageModal = true;
  }

  function closeLanguageModal() {
    showLanguageModal = false;
    orderIdForPDF = null;
  }

  async function downloadOrderPDF(orderId: string, lang: Language = "fr") {
    try {
      /* jsPDF n'est chargé qu'au moment de générer le document. */
      const { default: jsPDF } = await import("jspdf");
      // Load order with supplier info
      const { data: order, error: orderError } = await supabase
        .from("order")
        .select(
          `
          *,
          supplier (*),
          transport (
            *,
            transporter (*)
          )
        `
        )
        .eq("id", orderId)
        .single();

      if (orderError || !order) {
        error = `Erreur lors du chargement de la commande: ${orderError?.message}`;
        return;
      }

      // Load order items with wine info
      const { data: items, error: itemsError } = await supabase
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

      if (itemsError || !items) {
        error = `Erreur lors du chargement des articles: ${itemsError?.message}`;
        return;
      }

      // Create PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let yPos = margin;

      const t = translations[lang];
      const localeMap = { fr: "fr-FR", en: "en-US", it: "it-IT" };
      const locale = localeMap[lang];

      // Header - use translated title based on status
      const documentTitle =
        order.status === "confirmed"
          ? t.documentTitleConfirmed
          : t.documentTitlePending;
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text(documentTitle, pageWidth - margin, yPos, { align: "right" });
      yPos += 12;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(
        `${t.date}: ${parseIsoDate(order.date).toLocaleDateString(locale)}`,
        pageWidth - margin,
        yPos,
        { align: "right" }
      );
      yPos += 6;
      doc.text(
        `${t.status}: ${order.status === "confirmed" ? t.statusConfirmed : t.statusPending}`,
        pageWidth - margin,
        yPos,
        {
          align: "right",
        }
      );
      yPos += 15;

      // Company info (left side) and Supplier info (right side)
      const supplierX = pageWidth - margin;
      let supplierY = yPos;

      // Company info (left side)
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Mezzaterra", margin, yPos);
      yPos += 6;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      // Supplier info (right side)
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(order.supplier.name, supplierX, supplierY, { align: "right" });
      supplierY += 6;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      // Use the maximum Y position
      yPos = Math.max(yPos, supplierY);
      yPos += 15;

      // Items table header
      const descColStart = margin + 2;
      const numericColWidth = 22;
      const colSpacing = 2;

      const totalColX = pageWidth - margin - numericColWidth / 2;
      const priceColX = totalColX - numericColWidth - colSpacing;
      const qtyColX = priceColX - numericColWidth - colSpacing;
      const descColWidth = qtyColX - descColStart - numericColWidth / 2 - 15;

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 6;
      doc.text(t.description, descColStart, yPos);
      doc.text(t.quantity, qtyColX, yPos, { align: "center" });
      doc.text(t.unitPrice, priceColX, yPos, { align: "center" });
      doc.text(t.total, totalColX, yPos, { align: "center" });
      yPos += 3;
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 6;

      // Items
      doc.setFont("helvetica", "normal");

      for (const item of items) {
        if (yPos > doc.internal.pageSize.getHeight() - 40) {
          doc.addPage();
          yPos = margin + 20;
        }

        const productName = vintageProductLabel(item.wine_vintage);
        const quantity = item.quantity;
        const unitPrice = item.price || 0;
        const itemTotal = unitPrice * quantity;

        // Description (with wrapping)
        const descriptionLines = doc.splitTextToSize(productName, descColWidth);
        const startY = yPos;
        doc.text(descriptionLines, descColStart, startY);
        const itemHeight = Math.max(descriptionLines.length * 4.2, 6);

        // Quantity - centered in column
        doc.text(quantity.toString(), qtyColX, startY, { align: "center" });

        // Unit price - centered in column
        doc.text(`€${unitPrice.toFixed(2)}`, priceColX, startY, {
          align: "center",
        });

        // Total - centered in column
        doc.text(`€${itemTotal.toFixed(2)}`, totalColX, startY, {
          align: "center",
        });

        yPos += itemHeight + 2;
      }

      yPos += 5;
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 10;

      // Total
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(
        `${t.totalLabel}: €${order.total_price?.toFixed(2) || "0.00"}`,
        pageWidth - margin,
        yPos,
        { align: "right" }
      );

      // Transport info if present
      if (order.transport) {
        yPos += 15;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setFont("helvetica", "bold");
        doc.text(`${t.transport}:`, margin, yPos);
        yPos += 5;
        doc.setFont("helvetica", "normal");
        doc.text(
          `${t.transporter}: ${order.transport.transporter.name}`,
          margin,
          yPos
        );
        yPos += 5;
        if (order.transport.departure_date) {
          doc.text(
            `${t.departureDate}: ${parseIsoDate(order.transport.departure_date).toLocaleDateString(locale)}`,
            margin,
            yPos
          );
          yPos += 5;
        }
        if (order.transport.arrival_date) {
          doc.text(
            `${t.arrivalDate}: ${parseIsoDate(order.transport.arrival_date).toLocaleDateString(locale)}`,
            margin,
            yPos
          );
        }
      }

      // Note if present
      if (order.note) {
        yPos += 15;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setFont("helvetica", "italic");
        const noteLines = doc.splitTextToSize(
          `${t.note}: ${order.note}`,
          pageWidth - 2 * margin
        );
        doc.text(noteLines, margin, yPos);
      }

      // Save PDF
      const dateStr = order.date.slice(0, 10);
      const fileName = `${documentTitle}_${order.supplier.name.replace(/[^a-zA-Z0-9]/g, "_")}_${dateStr}.pdf`;
      doc.save(fileName);
    } catch (err) {
      error = `Erreur lors de la génération du PDF: ${err}`;
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
      <button
        class="btn-language"
        on:click={async () => {
          if (orderIdForPDF) {
            await downloadOrderPDF(orderIdForPDF, "fr");
            closeLanguageModal();
          }
        }}
      >
        🇫🇷 Français
      </button>
      <button
        class="btn-language"
        on:click={async () => {
          if (orderIdForPDF) {
            await downloadOrderPDF(orderIdForPDF, "en");
            closeLanguageModal();
          }
        }}
      >
        🇬🇧 English
      </button>
      <button
        class="btn-language"
        on:click={async () => {
          if (orderIdForPDF) {
            await downloadOrderPDF(orderIdForPDF, "it");
            closeLanguageModal();
          }
        }}
      >
        🇮🇹 Italiano
      </button>
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
