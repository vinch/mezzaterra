<script lang="ts">
  import { preventDefault } from "$lib/ui/events";

  import { supabase } from "$lib/supabase";
  import { invalidateAll } from "$app/navigation";
  import type { PageData } from "./$types";
  import Modal from "$lib/ui/Modal.svelte";
  import Button from "$lib/ui/Button.svelte";
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
  import { IconClipboard, IconEye, IconPencil, IconPlus, IconRoute, IconTrash } from "$lib/ui/icons";
  import { isEditable } from "$lib/status";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import { LINE_ITEMS_SELECT } from "$lib/manageData";
  import { isoDateOnly } from "$lib/dates";
  import { errorMessage, latestOnly } from "$lib/async";
  import { formatDate, formatEUR } from "$lib/format";
  import { lineTotal } from "$lib/analytics";
  import { vintageProductLabel } from "$lib/wine";

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  let transports: any[] = $derived(data.transports);
  /* Rechargés par invalidateAll() après une création, une modification ou une suppression. */
  let transporters: any[] = $derived(data.transporters);
  let error = $state("");
  /** Modale unique création / édition (`editingTransport` les distingue). */
  let formOpen = $state(false);
  let saving = $state(false);
  let editingTransport = $state<any>(null);
  let selectedTransport = $state<any>(null);
  let detailsTransport = $state<any>(null);
  let detailsOrders = $state<any[]>([]);
  let availableOrders = $state<any[]>([]);
  let associatedOrders = $state<any[]>([]);
  let selectedOrderIds = $state<string[]>([]);

  const emptyForm = () => ({
    transporter_id: "",
    departure_date: "",
    arrival_date: "",
    pallets_number: "",
    price: "",
    note: "",
  });
  let formData = $state(emptyForm());

  function openCreateModal() {
    error = "";
    editingTransport = null;
    formData = emptyForm();
    formOpen = true;
  }

  function openEditModal(transport: any) {
    error = "";
    editingTransport = transport;
    formData = {
      transporter_id: transport.transporter_id || "",
      departure_date: isoDateOnly(transport.departure_date),
      arrival_date: isoDateOnly(transport.arrival_date),
      pallets_number: transport.pallets_number ? String(transport.pallets_number) : "",
      price: transport.price ? String(transport.price) : "",
      note: transport.note || "",
    };
    formOpen = true;
  }

  function closeForm() {
    formOpen = false;
    editingTransport = null;
    formData = emptyForm();
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
      pallets_number: formData.pallets_number ? parseInt(formData.pallets_number) : null,
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
    await invalidateAll();
  }

  /** Appelée après confirmation via le ConfirmDialog. */
  async function deleteTransport(id: string) {
    const { error: deleteError } = await supabase.from("transport").delete().eq("id", id);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    error = "";
    await invalidateAll();
  }

  /* Statut et entrée en stock à la livraison en une transaction (fonction SQL set_transport_status). */
  async function setTransportStatus(transportId: string, newStatus: string) {
    const { error: statusError } = await supabase.rpc("set_transport_status", {
      p_transport_id: transportId,
      p_status: newStatus,
    });

    if (statusError) {
      error = statusError.message;
      return;
    }

    /* Objet neuf pour la ligne : la liste ($derived, sans proxy) ne suit pas les mutations. */
    transports = transports.map((t) => (t.id === transportId ? { ...t, status: newStatus } : t));
  }

  /* Le passage à « Livré » crée les mouvements de stock des commandes associées : il est confirmé d'abord. */
  let deliverTarget = $state<any>(null);
  let deliverOpen = $state(false);
  function changeStatus(transport: any, next: string) {
    if (next === "delivered" && transport.status !== "delivered") {
      deliverTarget = transport;
      deliverOpen = true;
      return;
    }
    void setTransportStatus(transport.id, next);
  }

  /* Chargements des modales : le dernier clic gagne ; une modale s'ouvre une fois ses listes lues (elle suit sa cible). */
  const modalLoad = latestOnly((e) => (error = errorMessage(e)));

  async function openOrdersModal(transport: any) {
    error = "";
    const loaded = await modalLoad.run(() => Promise.all([fetchOrders(null), fetchOrders(transport.id)]));
    if (!loaded) return;
    [availableOrders, associatedOrders] = loaded;
    selectedOrderIds = [];
    selectedTransport = transport;
  }

  function closeOrdersModal() {
    selectedTransport = null;
    selectedOrderIds = [];
    availableOrders = [];
    associatedOrders = [];
  }

  async function openDetailsModal(transport: any) {
    error = "";
    const orders = await modalLoad.run(() => fetchOrders(transport.id, `*, supplier (*), order_item ( ${LINE_ITEMS_SELECT} )`));
    if (!orders) return;
    detailsOrders = orders;
    detailsTransport = transport;
  }

  function closeDetailsModal() {
    detailsTransport = null;
    detailsOrders = [];
  }

  /**
   * Commandes d'un transport, ou avec `null` les commandes confirmées encore sans transport
   * (seules associables), les plus récentes d'abord. Lève une erreur : une modale ne s'ouvre pas
   * avec une liste vide trompeuse (« aucune commande disponible »).
   */
  async function fetchOrders(transportId: string | null, select = "*, supplier (*)"): Promise<any[]> {
    const query = supabase.from("order").select(select);
    const { data, error: fetchError } = await (transportId
      ? query.eq("transport_id", transportId)
      : query.is("transport_id", null).eq("status", "confirmed")
    ).order("date", { ascending: false });
    if (fetchError) throw new Error(fetchError.message);
    return data || [];
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

  /** Livré ou annulé : seul le détail reste. */
  function rowItems(transport: any): MenuItem[] {
    if (!isEditable("transport", transport.status)) {
      return [{ label: "Voir le détail", icon: IconEye, onSelect: () => openDetailsModal(transport) }];
    }
    return [
      { label: "Associer des commandes", icon: IconClipboard, onSelect: () => openOrdersModal(transport) },
      { label: "Modifier", icon: IconPencil, onSelect: () => openEditModal(transport) },
      { label: "Supprimer…", icon: IconTrash, danger: true, separator: true, onSelect: () => askDelete(transport) },
    ];
  }

  let deleteTarget = $state<any>(null);
  let confirmOpen = $state(false);
  function askDelete(transport: any) {
    deleteTarget = transport;
    confirmOpen = true;
  }
</script>

<svelte:head>
  <title>Transports - Gestion</title>
</svelte:head>

<ManagePageShell title="Transports">
  {#snippet actions()}
    <Button variant="primary" onclick={openCreateModal}><IconPlus size={18} strokeWidth={1.75} /> Nouveau transport</Button>
  {/snippet}

  {#if error}
    <div class="error-message" role="alert">{error}</div>
  {/if}

  {#if transports.length === 0}
    <Card padded={false}>
      <EmptyState icon={IconRoute} title="Aucun transport pour l’instant" text="Créez le premier transport, puis associez-lui des commandes confirmées.">
        <Button onclick={openCreateModal}>Créer le premier transport</Button>
      </EmptyState>
    </Card>
  {:else}
    <DataTable caption="Liste des transports">
      <thead>
        <tr>
          <th scope="col">Transporteur</th>
          <th scope="col">Départ</th>
          <th scope="col">Arrivée</th>
          <th scope="col">Statut</th>
          <th scope="col" class="num">Commandes</th>
          <th scope="col" class="num">Palettes</th>
          <th scope="col" class="num">Prix</th>
          <th scope="col" class="col-actions"><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {#each transports as transport (transport.id)}
          <tr>
            <td><strong>{transport.transporter.name}</strong></td>
            <td>{formatDate(transport.departure_date)}</td>
            <td>{formatDate(transport.arrival_date)}</td>
            <td>
              <span title={transport.status === "delivered" ? "Livré : le stock est entré, le statut est définitif" : undefined}>
                <StatusMenuBadge kind="transport" status={transport.status} onselect={(next) => changeStatus(transport, next)} />
              </span>
            </td>
            <td class="num">{transport.order_count || 0}</td>
            <td class="num">{transport.pallets_number || "—"}</td>
            <td class="num">{formatEUR(transport.price)}</td>
            <td class="col-actions">
              <RowMenu items={rowItems(transport)} label="Actions pour le transport {transport.transporter.name}" />
            </td>
          </tr>
        {/each}
      </tbody>
    </DataTable>
  {/if}
</ManagePageShell>

<ConfirmDialog
  bind:open={deliverOpen}
  title="Marquer ce transport comme livré ?"
  message="Cette action va créer des mouvements de stock pour tous les produits des commandes associées."
  confirmLabel="Oui, marquer comme livré"
  action={() => setTransportStatus(deliverTarget.id, "delivered")}
/>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Supprimer ce transport ?"
  message={deleteTarget ? `Le transport ${deleteTarget.transporter.name} sera définitivement supprimé.` : ""}
  action={() => deleteTransport(deleteTarget.id)}
/>

<!-- Création / modification -->
<Modal open={formOpen} title={editingTransport ? "Modifier le transport" : "Nouveau transport"} onclose={closeForm}>
  <form id="transport-form" class="transport-form" onsubmit={preventDefault(submitForm)}>
    {#if error}
      <div class="error-message" role="alert">{error}</div>
    {/if}
    <Field id="transport-transporter" label="Transporteur" required>
      <Select id="transport-transporter" bind:value={formData.transporter_id} required>
        <option value="">Sélectionner un transporteur</option>
        {#each transporters as transporter}
          <option value={transporter.id}>{transporter.name}</option>
        {/each}
      </Select>
    </Field>
    <div class="grid-2">
      <Field id="transport-departure" label="Date de départ">
        <input id="transport-departure" class="ui-control" type="date" bind:value={formData.departure_date} />
      </Field>
      <Field id="transport-arrival" label="Date d’arrivée">
        <input id="transport-arrival" class="ui-control" type="date" bind:value={formData.arrival_date} />
      </Field>
      <Field id="transport-pallets" label="Nombre de palettes">
        <input id="transport-pallets" class="ui-control" type="number" inputmode="numeric" bind:value={formData.pallets_number} />
      </Field>
      <Field id="transport-price" label="Prix">
        <input id="transport-price" class="ui-control" type="number" step="0.01" inputmode="decimal" bind:value={formData.price} />
      </Field>
    </div>
    <Field id="transport-note" label="Note">
      <textarea id="transport-note" class="ui-control" rows="3" bind:value={formData.note}></textarea>
    </Field>
  </form>
  {#snippet footer()}
    <Button variant="ghost" onclick={closeForm}>Annuler</Button>
    <Button variant="primary" type="submit" form="transport-form" disabled={saving}>{editingTransport ? "Enregistrer" : "Créer le transport"}</Button>
  {/snippet}
</Modal>

{#snippet orderSummary(order: any)}
  <span class="order-info">
    <span class="order-head">
      <strong>{formatDate(order.date)} — {order.supplier.name}</strong>
      <span class="num">{formatEUR(order.total_price ?? 0)}</span>
    </span>
    <StatusBadge kind="order" status={order.status} />
    {#if order.note}<span class="t-caption">{order.note}</span>{/if}
  </span>
{/snippet}

<!-- Association de commandes -->
<Modal open={selectedTransport != null} title="Associer des commandes au transport" onclose={closeOrdersModal}>
  {#if selectedTransport}
    <p class="intro t-muted">
      Sélectionnez les commandes à associer au transport <strong>{selectedTransport.transporter.name}</strong>.
    </p>

    {#if associatedOrders.length > 0}
      <h3 class="t-label section">Commandes déjà associées</h3>
      <ul class="order-list">
        {#each associatedOrders as order (order.id)}
          <li class="order-row is-readonly">{@render orderSummary(order)}</li>
        {/each}
      </ul>
      {#if availableOrders.length > 0}
        <h3 class="t-label section">Commandes disponibles</h3>
      {/if}
    {/if}

    {#if availableOrders.length === 0}
      {#if associatedOrders.length === 0}
        <EmptyState title="Aucune commande confirmée disponible" text="Seules les commandes confirmées peuvent être associées à un transport." compact />
      {:else}
        <EmptyState title="Aucune autre commande confirmée disponible" compact />
      {/if}
    {:else}
      <ul class="order-list">
        {#each availableOrders as order (order.id)}
          <li>
            <label class="order-row is-selectable">
              <input type="checkbox" bind:group={selectedOrderIds} value={order.id} />
              {@render orderSummary(order)}
            </label>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
  {#snippet footer()}
    <Button variant="ghost" onclick={closeOrdersModal}>Annuler</Button>
    <Button variant="primary" onclick={associateOrders} disabled={selectedOrderIds.length === 0}>Associer {selectedOrderIds.length > 0 ? `(${selectedOrderIds.length})` : ""}</Button>
  {/snippet}
</Modal>

<!-- Détail -->
<Modal open={detailsTransport != null} title="Détail du transport" maxWidth={720} onclose={closeDetailsModal}>
  {#snippet titleExtra()}
    {#if detailsTransport}<StatusBadge kind="transport" status={detailsTransport.status} />{/if}
  {/snippet}
  {#if detailsTransport}
    <dl class="facts">
      <div><dt>Transporteur</dt><dd><strong>{detailsTransport.transporter.name}</strong></dd></div>
      <div><dt>Prix</dt><dd>{formatEUR(detailsTransport.price)}</dd></div>
      <div><dt>Date de départ</dt><dd>{formatDate(detailsTransport.departure_date)}</dd></div>
      <div><dt>Date d’arrivée</dt><dd>{formatDate(detailsTransport.arrival_date)}</dd></div>
      <div><dt>Nombre de palettes</dt><dd>{detailsTransport.pallets_number || "—"}</dd></div>
      {#if detailsTransport.note}
        <div class="wide"><dt>Note</dt><dd>{detailsTransport.note}</dd></div>
      {/if}
    </dl>

    <h3 class="t-label section">Commandes associées</h3>
    {#if detailsOrders.length === 0}
      <EmptyState title="Aucune commande associée" compact />
    {:else}
      {#each detailsOrders as order (order.id)}
        <section class="detail-order">
          <p class="order-head">
            <strong>{formatDate(order.date)} — {order.supplier.name}</strong>
            <span>Total : {formatEUR(order.total_price ?? 0)}</span>
          </p>
          {#if order.note}<p class="t-caption">{order.note}</p>{/if}
          {#if order.order_item?.length}
            <DataTable caption="Articles de la commande du {formatDate(order.date)}">
              <thead>
                <tr>
                  <th scope="col">Article</th>
                  <th scope="col" class="num">Qté</th>
                  <th scope="col" class="num">Prix unit.</th>
                  <th scope="col" class="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {#each order.order_item as item}
                  <tr>
                    <td>{vintageProductLabel(item.wine_vintage)}</td>
                    <td class="num">{item.quantity}</td>
                    <td class="num">{formatEUR(item.price)}</td>
                    <td class="num"><strong>{formatEUR(item.price ? lineTotal(item) : null)}</strong></td>
                  </tr>
                {/each}
              </tbody>
            </DataTable>
          {/if}
        </section>
      {/each}
    {/if}
  {/if}
  {#snippet footer()}
    <Button variant="primary" onclick={closeDetailsModal}>Fermer</Button>
  {/snippet}
</Modal>

<style>
  .transport-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .intro {
    margin: 0 0 16px;
  }

  .intro strong {
    color: var(--ink);
  }

  .section {
    margin: 16px 0 8px;
  }

  .order-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .order-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    border: 1px solid var(--border-soft);
    border-radius: var(--r-sm);
    background: var(--card);
  }

  .order-row.is-readonly {
    background: var(--table-head);
    color: var(--ink-2);
  }

  .order-row.is-selectable {
    cursor: pointer;
  }

  .order-row.is-selectable:hover {
    background: var(--row-hover);
  }

  .order-row input {
    margin-top: 3px;
    accent-color: var(--teal-600);
  }

  .order-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .order-head {
    align-self: stretch;
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin: 0;
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

  .detail-order {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 20px;
  }

  .detail-order p {
    margin: 0;
  }

  @media (max-width: 767px) {
    .grid-2,
    .facts {
      grid-template-columns: 1fr;
    }
  }
</style>
