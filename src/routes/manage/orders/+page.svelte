<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import type { PageData } from "./$types";
  import Modal from "$lib/components/Modal.svelte";
  import jsPDF from "jspdf";

  export let data: PageData;

  let orders: any[] = data.orders;
  let suppliers: any[] = [];
  let wineVintages: any[] = [];
  let loading = true;
  let error = "";
  let showModal = false;
  let showEditModal = false;
  let showDetailsModal = false;
  let showLanguageModal = false;
  let editingOrder: any = null;
  let detailsOrder: any = null;
  let detailsOrderItems: any[] = [];
  let orderIdForPDF: string | null = null;

  // Form fields
  let formData = {
    date: new Date().toISOString().split("T")[0],
    supplier_id: "",
    status: "pending",
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
    if (order.status === "confirmed") {
      error = "Impossible de modifier une commande confirmée";
      return;
    }

    editingOrder = order;
    formData = {
      date: order.date.split("T")[0],
      supplier_id: order.supplier_id || "",
      status: order.status || "pending",
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
      status: "pending",
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
    selectedVintageId = "";
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
      status: formData.status || "pending",
      transport_id: null,
      total_price: calculatedTotal,
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
      status: formData.status || "pending",
      transport_id: null,
      total_price: calculatedTotal,
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

    window.location.reload();
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
        `${t.date}: ${new Date(order.date).toLocaleDateString(locale)}`,
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

        const productName = getProductDisplayNameWithYear(item.wine_vintage);
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
            `${t.departureDate}: ${new Date(order.transport.departure_date).toLocaleDateString(locale)}`,
            margin,
            yPos
          );
          yPos += 5;
        }
        if (order.transport.arrival_date) {
          doc.text(
            `${t.arrivalDate}: ${new Date(order.transport.arrival_date).toLocaleDateString(locale)}`,
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
      const dateStr = new Date(order.date).toISOString().split("T")[0];
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
              <th>Statut</th>
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
                    <div style="line-height: 1.4;">
                      <div>
                        <strong>{order.transport.transporter.name}</strong>
                      </div>
                      {#if order.transport.departure_date}
                        <div
                          style="font-size: 0.85rem; color: #666; margin-top: 0.15rem; line-height: 1.2;"
                        >
                          {new Date(
                            order.transport.departure_date
                          ).toLocaleDateString("fr-FR")}
                        </div>
                      {:else if order.transport.arrival_date}
                        <div
                          style="font-size: 0.85rem; color: #666; margin-top: 0.15rem; line-height: 1.2;"
                        >
                          {new Date(
                            order.transport.arrival_date
                          ).toLocaleDateString("fr-FR")}
                        </div>
                      {/if}
                    </div>
                  {:else}
                    -
                  {/if}
                </td>
                <td>
                  <select
                    class="status-select status-{order.status}"
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
                    <option value="pending">En attente</option>
                    <option value="confirmed">Confirmée</option>
                  </select>
                </td>
                <td>
                  <strong>€{order.total_price?.toFixed(2) || "0.00"}</strong>
                </td>
                <td>
                  <div class="actions">
                    <button
                      class="btn-pdf"
                      on:click={() => openLanguageModal(order.id)}
                      title="Exporter en PDF"
                    >
                      PDF
                    </button>
                    {#if order.status === "confirmed" || (order.transport && (order.transport.status === "delivered" || order.transport.status === "cancelled"))}
                      <button
                        class="btn-details"
                        on:click={() => openDetailsModal(order)}
                      >
                        Détails
                      </button>
                    {:else}
                      <button
                        class="btn-edit"
                        on:click={() => openEditModal(order)}
                      >
                        Modifier
                      </button>
                      <button
                        class="btn-delete"
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
            {#key orderItems.map((i) => i.wine_vintage_id).join("|")}
              <select
                bind:value={selectedVintageId}
                on:change={handleVintageChange}
              >
                <option value="">Sélectionner un produit</option>
                {#each wineVintages as vintage}
                  {@const alreadyAdded = isVintageAlreadyAdded(vintage.id)}
                  <option value={vintage.id} disabled={alreadyAdded}>
                    {getProductDisplayNameWithYear(vintage)}
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
            {#key orderItems.map((i) => i.wine_vintage_id).join("|")}
              <select
                bind:value={selectedVintageId}
                on:change={handleVintageChange}
              >
                <option value="">Sélectionner un produit</option>
                {#each wineVintages as vintage}
                  {@const alreadyAdded = isVintageAlreadyAdded(vintage.id)}
                  <option value={vintage.id} disabled={alreadyAdded}>
                    {getProductDisplayNameWithYear(vintage)}
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
          <div class="details-section">
            <strong>Statut:</strong>
            <p>
              <span
                class="status-badge status-{detailsOrder.status || 'pending'}"
              >
                {detailsOrder.status === "pending" ? "En attente" : "Confirmée"}
              </span>
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

<!-- Modal de sélection de langue pour PDF -->
<Modal
  show={showLanguageModal}
  title="Choisir la langue pour l'export PDF"
  modalId="modal-title-language"
  on:close={closeLanguageModal}
>
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

  .btn-pdf {
    padding: 0.4rem 0.8rem;
    background: #6f42c1;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .btn-pdf:hover {
    background: #5a32a3;
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

  .status-select {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.85rem;
    font-weight: 500;
    border: 1px solid rgba(0, 0, 0, 0.1);
    cursor: pointer;
    transition: all 0.2s;
  }

  .status-select:hover:not(:disabled) {
    opacity: 0.9;
  }

  .status-select:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  .status-select.status-pending {
    background: #fff3cd;
    color: #856404;
  }

  .status-select.status-confirmed {
    background: #d4edda;
    color: #155724;
  }

  .status-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.85rem;
    font-weight: 500;
  }

  .status-badge.status-pending {
    background: #fff3cd;
    color: #856404;
  }

  .status-badge.status-confirmed {
    background: #d4edda;
    color: #155724;
  }

  .language-selection {
    padding: 1.5rem;
  }

  .language-selection p {
    margin: 0 0 1.5rem 0;
    color: #333;
    font-size: 0.95rem;
  }

  .language-buttons {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .btn-language {
    padding: 1rem;
    background: #f8f9fa;
    border: 2px solid #dee2e6;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1rem;
    text-align: left;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .btn-language:hover {
    background: #e9ecef;
    border-color: #007bff;
    transform: translateX(4px);
  }

  .btn-language:active {
    transform: translateX(0);
  }
</style>
