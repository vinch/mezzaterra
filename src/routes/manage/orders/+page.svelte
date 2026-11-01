<script lang="ts">
  import { preventDefault } from "$lib/ui/events";

  import { NEW_ROW, supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import { invalidateAll } from "$app/navigation";
  import type { PageData } from "./$types";
  import Modal from "$lib/ui/Modal.svelte";
  import Button from "$lib/ui/Button.svelte";
  import IconButton from "$lib/ui/IconButton.svelte";
  import Spinner from "$lib/ui/Spinner.svelte";
  import StatusBadge from "$lib/ui/StatusBadge.svelte";
  import type { MenuItem } from "$lib/ui/Menu.svelte";
  import StatusMenuBadge from "$lib/ui/StatusMenuBadge.svelte";
  import RowMenu from "$lib/ui/RowMenu.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import DataTable from "$lib/ui/DataTable.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import Card from "$lib/ui/Card.svelte";
  import Field from "$lib/ui/Field.svelte";
  import Select from "$lib/ui/Select.svelte";
  import { IconClipboard, IconDownload, IconEye, IconPencil, IconPlus, IconTrash } from "$lib/ui/icons";
  import { isEditable } from "$lib/status";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import ProductVintageAutocomplete from "$lib/components/manage/ProductVintageAutocomplete.svelte";
  import { fetchLineItems, fetchPickerVintages, LINE_ITEMS_SELECT } from "$lib/manageData";
  import { errorMessage, latestOnly } from "$lib/async";
  import { isoDateOnly, todayIso } from "$lib/dates";
  import type { OrderPdfLanguage } from "$lib/pdf/purchaseOrderPdf";
  import { formatDate, formatEUR } from "$lib/format";
  import { lineTotal } from "$lib/analytics";
  import { itemsSubtotal } from "$lib/sales";
  import { isDiscontinued, vintageProductLabel } from "$lib/wine";

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  let orders: any[] = $derived(data.orders);
  /* Rechargés par invalidateAll() après une création, une modification ou une suppression. */
  let suppliers: any[] = $derived(data.suppliers);
  /** Catalogue du formulaire, lu en arrière-plan : la liste s'affiche sans l'attendre. */
  let wineVintages = $state.raw<any[]>([]);
  let catalog: Promise<any[]> | null = null;
  let error = $state("");
  /** Modale unique création / édition (`editingOrder` les distingue). */
  let formOpen = $state(false);
  let saving = $state(false);
  let editingOrder = $state<any>(null);
  let detailsOrder = $state<any>(null);
  let detailsOrderItems = $state<any[]>([]);
  let orderIdForPDF = $state<string | null>(null);
  let exportingPdf = $state(false);

  /* Pas de statut : save_order crée la commande « En attente » et garde celui d'une commande modifiée. */
  const emptyForm = () => ({ date: todayIso(), supplier_id: "", note: "" });
  let formData = $state(emptyForm());

  let orderItems = $state<any[]>([]);
  let selectedVintageId = $state("");
  let selectedQuantity = $state("");
  let selectedPrice = $state("");

  /* Chargements des modales : le dernier clic gagne (deux « Modifier » enchaînés…). */
  const formLoad = latestOnly((e) => (error = errorMessage(e)));

  /** Ouverte tout de suite : le sélecteur de produit se remplit quand le catalogue arrive. */
  function openCreateModal() {
    error = "";
    formLoad.cancel();
    pickerVintages().catch((e) => (error = errorMessage(e)));
    editingOrder = null;
    resetForm();
    formOpen = true;
  }

  /** Une seule lecture du catalogue, partagée par les ouvertures du formulaire ; relue si elle a échoué. */
  function pickerVintages(): Promise<any[]> {
    catalog ??= fetchPickerVintages().then(
      (v) => (wineVintages = v),
      (e) => {
        catalog = null;
        throw e;
      },
    );
    return catalog;
  }

  onMount(() => {
    pickerVintages().catch((e) => (error = errorMessage(e)));
  });

  async function openEditModal(order: any) {
    error = "";
    /* Commande figée : le menu de ligne ne propose pas « Modifier » et save_order refuse. */
    const loaded = await formLoad.run(() => Promise.all([pickerVintages(), loadOrderItems(order.id)]));
    if (!loaded) return;
    const [, items] = loaded;

    editingOrder = order;
    formData = {
      date: isoDateOnly(order.date),
      supplier_id: order.supplier_id || "",
      note: order.note || "",
    };
    orderItems = items.map((item: any) => ({
      wine_vintage: item.wine_vintage,
      wine_vintage_id: item.wine_vintage_id,
      quantity: item.quantity,
      price: item.price,
      note: item.note || "",
    }));
    formOpen = true;
  }

  /* Note comprise : les lignes reprises dans le formulaire la gardent à l'enregistrement. */
  const loadOrderItems = (orderId: string) => fetchLineItems("order", orderId, `${LINE_ITEMS_SELECT}, note`);

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
  }

  function closeDetailsModal() {
    detailsOrder = null;
    detailsOrderItems = [];
  }

  function resetForm() {
    formData = emptyForm();
    orderItems = [];
    selectedVintageId = "";
    selectedQuantity = "";
    selectedPrice = "";
  }

  /* Lignes sans remise : prix d'achat × quantité, arrondis au centime comme les ventes. */
  let total = $derived(itemsSubtotal(orderItems));

  /* On ne recommande pas un millésime « plus jamais disponible ». */
  let orderableVintages = $derived(wineVintages.filter((v) => !isDiscontinued(v)));

  function handleVintageChange() {
    if (!selectedVintageId) return;
    const vintage = wineVintages.find((v) => v.id === selectedVintageId);
    selectedPrice = vintage?.purchase_price ? String(vintage.purchase_price) : "";
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
      error = "";
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

  async function updateOrderStatus(orderId: string, newStatus: string) {
    /* Filtré sur « non confirmée » : une commande confirmée entre-temps ailleurs ne bouge plus. */
    const { data: updated, error: updateError } = await supabase
      .from("order")
      .update({ status: newStatus })
      .eq("id", orderId)
      .neq("status", "confirmed")
      .select("id");

    if (updateError || !updated?.length) {
      error = updateError?.message ?? "Impossible de modifier le statut d'une commande confirmée";
      return;
    }

    error = "";
    /* Objet neuf pour la ligne : la liste ($derived, sans proxy) ne suit pas les mutations. */
    orders = orders.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o));
  }

  /** Appelée après confirmation via le ConfirmDialog. */
  async function deleteOrder(id: string) {
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

  const LANGUAGES: [OrderPdfLanguage, string][] = [
    ["fr", "🇫🇷 Français"],
    ["en", "🇬🇧 English"],
    ["it", "🇮🇹 Italiano"],
  ];

  function openLanguageModal(orderId: string) {
    orderIdForPDF = orderId;
  }

  function closeLanguageModal() {
    if (exportingPdf) return;
    orderIdForPDF = null;
  }

  async function exportPdf(lang: OrderPdfLanguage) {
    const orderId = orderIdForPDF;
    if (!orderId || exportingPdf) return;
    exportingPdf = true;
    try {
      /* jsPDF n'est chargé qu'au moment de générer le document. */
      const { downloadOrderPdf } = await import("$lib/pdf/purchaseOrderPdf");
      await downloadOrderPdf(orderId, lang);
    } catch (err) {
      error = `Erreur lors de la génération du PDF : ${errorMessage(err)}`;
      console.error(err);
    } finally {
      exportingPdf = false;
    }
    closeLanguageModal();
  }

  /** Commande figée : confirmée, ou partie avec un transport livré ou annulé. Seul le détail reste. */
  function isLocked(order: any): boolean {
    return !isEditable("order", order.status) || (!!order.transport && !isEditable("transport", order.transport.status));
  }

  function rowItems(order: any): MenuItem[] {
    const pdf: MenuItem = { label: "Exporter en PDF", icon: IconDownload, onSelect: () => openLanguageModal(order.id) };
    if (isLocked(order)) return [{ label: "Voir le détail", icon: IconEye, onSelect: () => openDetailsModal(order) }, pdf];
    return [
      { label: "Modifier", icon: IconPencil, onSelect: () => openEditModal(order) },
      pdf,
      { label: "Supprimer…", icon: IconTrash, danger: true, separator: true, onSelect: () => askDelete(order) },
    ];
  }

  let deleteTarget = $state<any>(null);
  let confirmOpen = $state(false);
  function askDelete(order: any) {
    deleteTarget = order;
    confirmOpen = true;
  }
</script>

<svelte:head>
  <title>Commandes - Gestion</title>
</svelte:head>

<ManagePageShell title="Commandes">
  {#snippet actions()}
    <Button variant="primary" onclick={openCreateModal}><IconPlus size={18} strokeWidth={1.75} /> Nouvelle commande</Button>
  {/snippet}

  {#if error}
    <div class="error-message" role="alert">{error}</div>
  {/if}

  {#if orders.length === 0}
    <Card padded={false}>
      <EmptyState icon={IconClipboard} title="Aucune commande pour l’instant" text="Créez la première commande fournisseur : elle sera enregistrée « En attente ».">
        <Button onclick={openCreateModal}>Créer la première commande</Button>
      </EmptyState>
    </Card>
  {:else}
    <DataTable caption="Liste des commandes fournisseur">
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th scope="col">Fournisseur</th>
          <th scope="col">Transport</th>
          <th scope="col">Statut</th>
          <th scope="col" class="num">Montant total</th>
          <th scope="col" class="col-actions"><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {#each orders as order (order.id)}
          <tr>
            <td>{formatDate(order.date)}</td>
            <td><strong>{order.supplier.name}</strong></td>
            <td>
              {#if order.transport}
                <span class="stack">
                  <strong>{order.transport.transporter.name}</strong>
                  {#if order.transport.departure_date || order.transport.arrival_date}
                    <span class="t-caption">{formatDate(order.transport.departure_date || order.transport.arrival_date)}</span>
                  {/if}
                </span>
              {:else}—{/if}
            </td>
            <td>
              <StatusMenuBadge kind="order" status={order.status} onselect={(next) => updateOrderStatus(order.id, next)} />
            </td>
            <td class="num"><strong>{formatEUR(order.total_price ?? 0)}</strong></td>
            <td class="col-actions">
              <div class="row-actions">
                <IconButton label="Exporter en PDF" onclick={() => openLanguageModal(order.id)}>
                  <IconDownload size={18} strokeWidth={1.75} />
                </IconButton>
                <RowMenu items={rowItems(order)} label="Actions pour la commande du {formatDate(order.date)} chez {order.supplier.name}" />
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </DataTable>
  {/if}
</ManagePageShell>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Supprimer cette commande ?"
  message={deleteTarget
    ? `La commande du ${formatDate(deleteTarget.date)} chez ${deleteTarget.supplier.name} (${formatEUR(deleteTarget.total_price ?? 0)}) sera définitivement supprimée, avec ses articles.`
    : ""}
  action={() => deleteOrder(deleteTarget.id)}
/>

<!-- Création / modification -->
<Modal open={formOpen} title={editingOrder ? "Modifier la commande" : "Nouvelle commande"} maxWidth={760} onclose={closeForm}>
  <form id="order-form" class="order-form" onsubmit={preventDefault(submitForm)}>
    {#if error}
      <div class="error-message" role="alert">{error}</div>
    {/if}
    <div class="grid-2">
      <Field id="order-date" label="Date" required>
        <input id="order-date" class="ui-control" type="date" bind:value={formData.date} required />
      </Field>
      <Field id="order-supplier" label="Fournisseur" required>
        <Select id="order-supplier" bind:value={formData.supplier_id} required>
          <option value="">Sélectionner un fournisseur</option>
          {#each suppliers as supplier}
            <option value={supplier.id}>{supplier.name}</option>
          {/each}
        </Select>
      </Field>
    </div>

    <Field id="order-note" label="Note">
      <textarea id="order-note" class="ui-control" rows="2" bind:value={formData.note}></textarea>
    </Field>

    <section class="items" aria-labelledby="order-items-title">
      <h3 id="order-items-title" class="t-label">Articles <span class="req" aria-hidden="true">*</span></h3>
      {#if orderItems.length === 0}
        <EmptyState title="Aucun article ajouté" text="Cherchez un produit ci-dessous, puis « Ajouter »." compact />
      {:else}
        <DataTable caption="Articles de la commande">
          <thead>
            <tr>
              <th scope="col">Produit</th>
              <th scope="col" class="num">Qté</th>
              <th scope="col" class="num">Prix d’achat</th>
              <th scope="col" class="num">Total</th>
              <th scope="col" class="col-actions"><span class="sr-only">Retirer</span></th>
            </tr>
          </thead>
          <tbody>
            {#each orderItems as item, index}
              <tr>
                <td>{vintageProductLabel(item.wine_vintage)}</td>
                <td class="num">{item.quantity}</td>
                <td class="num">{formatEUR(item.price)}</td>
                <td class="num"><strong>{formatEUR(lineTotal(item))}</strong></td>
                <td class="col-actions">
                  <IconButton label="Retirer {vintageProductLabel(item.wine_vintage)}" onclick={() => removeOrderItem(index)}>
                    <IconTrash size={18} strokeWidth={1.75} />
                  </IconButton>
                </td>
              </tr>
            {/each}
          </tbody>
        </DataTable>
      {/if}

      <div class="add-row">
        <div class="add-product">
          <label class="t-label" for="order-add-product">Ajouter un produit</label>
          <ProductVintageAutocomplete
            id="order-add-product"
            bind:value={selectedVintageId}
            wineVintages={orderableVintages}
            includeTastingOption={false}
            {isVintageAlreadyAdded}
            formatLabel={vintageProductLabel}
            onchange={handleVintageChange}
          />
        </div>
        <label>
          <span class="t-label">Qté</span>
          <input class="ui-control" type="number" min="1" inputmode="numeric" placeholder="1" bind:value={selectedQuantity} />
        </label>
        <label>
          <span class="t-label">Prix d’achat</span>
          <input class="ui-control num-input" type="number" step="0.01" min="0" inputmode="decimal" placeholder="0,00" bind:value={selectedPrice} />
        </label>
        <Button onclick={addOrderItem}><IconPlus size={16} strokeWidth={1.75} /> Ajouter</Button>
      </div>
    </section>
  </form>
  {#snippet footer()}
    <span class="total" aria-live="polite">Total <strong>{formatEUR(total)}</strong></span>
    <Button variant="ghost" onclick={closeForm}>Annuler</Button>
    <Button variant="primary" type="submit" form="order-form" disabled={saving}>{editingOrder ? "Enregistrer" : "Créer la commande"}</Button>
  {/snippet}
</Modal>

<!-- Détail -->
<Modal open={detailsOrder != null} title="Détail de la commande" maxWidth={720} onclose={closeDetailsModal}>
  {#snippet titleExtra()}
    {#if detailsOrder}<StatusBadge kind="order" status={detailsOrder.status} />{/if}
  {/snippet}
  {#if detailsOrder}
    <dl class="facts">
      <div><dt>Fournisseur</dt><dd>{detailsOrder.supplier.name}</dd></div>
      <div><dt>Date</dt><dd>{formatDate(detailsOrder.date)}</dd></div>
      <div><dt>Transport</dt><dd>{detailsOrder.transport?.transporter.name ?? "—"}</dd></div>
      {#if detailsOrder.note}
        <div class="wide"><dt>Note</dt><dd>{detailsOrder.note}</dd></div>
      {/if}
    </dl>

    <DataTable caption="Articles de la commande">
      <thead>
        <tr>
          <th scope="col">Article</th>
          <th scope="col" class="num">Qté</th>
          <th scope="col" class="num">Prix unit.</th>
          <th scope="col" class="num">Total</th>
        </tr>
      </thead>
      <tbody>
        {#each detailsOrderItems as item}
          <tr>
            <td>{vintageProductLabel(item.wine_vintage)}</td>
            <td class="num">{item.quantity}</td>
            <td class="num">{formatEUR(item.price)}</td>
            <td class="num"><strong>{formatEUR(lineTotal(item))}</strong></td>
          </tr>
        {/each}
      </tbody>
    </DataTable>
    <p class="grand-total"><span>Total</span><span>{formatEUR(detailsOrder.total_price ?? 0)}</span></p>
  {/if}
  {#snippet footer()}
    <Button variant="primary" onclick={closeDetailsModal}>Fermer</Button>
  {/snippet}
</Modal>

<!-- Langue du PDF -->
<Modal open={orderIdForPDF != null} title="Langue de l’export PDF" maxWidth={440} onclose={closeLanguageModal}>
  <p class="flush">Sélectionnez la langue dans laquelle générer le bon de commande :</p>
  <div class="languages">
    {#each LANGUAGES as [lang, label]}
      <Button disabled={exportingPdf} onclick={() => exportPdf(lang)}>{label}</Button>
    {/each}
  </div>
  {#snippet footer()}
    {#if exportingPdf}<Spinner size={18} inline />{/if}
    <Button variant="ghost" disabled={exportingPdf} onclick={closeLanguageModal}>Annuler</Button>
  {/snippet}
</Modal>

<style>
  .stack {
    display: flex;
    flex-direction: column;
  }

  .row-actions {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .order-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .items {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .items h3 {
    margin: 0;
  }

  .req {
    color: var(--danger);
  }

  .add-row {
    display: grid;
    grid-template-columns: minmax(200px, 1fr) 80px 120px auto;
    gap: 10px;
    align-items: end;
    padding: 12px;
    background: var(--table-head);
    border: 1px solid var(--border-soft);
    border-radius: var(--r-md);
  }

  .add-product,
  .add-row > label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .num-input {
    text-align: right;
  }

  .total {
    margin-right: auto;
    color: var(--ink-2);
  }

  .total strong,
  .grand-total {
    font-family: var(--font-serif);
    font-size: 20px;
    font-weight: 600;
    color: var(--ink);
  }

  .facts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 24px;
    margin: 0 0 20px;
  }

  .facts .wide {
    grid-column: 1 / -1;
  }

  .facts dt {
    font-size: 12px;
    color: var(--ink-2);
  }

  .facts dd {
    margin: 2px 0 0;
  }

  .grand-total {
    display: flex;
    justify-content: space-between;
    margin: 12px 0 0;
  }

  .flush {
    margin: 0 0 16px;
  }

  .languages {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  @media (max-width: 767px) {
    .grid-2,
    .facts {
      grid-template-columns: 1fr;
    }

    .add-row {
      grid-template-columns: 1fr 1fr;
    }

    .add-product {
      grid-column: 1 / -1;
    }
  }
</style>
