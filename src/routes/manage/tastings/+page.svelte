<script lang="ts">
  import { preventDefault } from "$lib/ui/events";

  import { NEW_ROW, supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import type { Customer, Tasting } from "$lib/types";
  import Modal from "$lib/ui/Modal.svelte";
  import Button from "$lib/ui/Button.svelte";
  import IconButton from "$lib/ui/IconButton.svelte";
  import type { MenuItem } from "$lib/ui/Menu.svelte";
  import RowMenu from "$lib/ui/RowMenu.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import DataTable from "$lib/ui/DataTable.svelte";
  import Card from "$lib/ui/Card.svelte";
  import Field from "$lib/ui/Field.svelte";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import LotAutocomplete from "$lib/components/manage/LotAutocomplete.svelte";
  import CustomerAutocomplete from "$lib/components/manage/CustomerAutocomplete.svelte";
  import Spinner from "$lib/ui/Spinner.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import {
    IconDownload,
    IconExternal,
    IconGlasses,
    IconPencil,
    IconPlay,
    IconPlus,
    IconTrash,
    IconUsers,
    IconX,
  } from "$lib/ui/icons";
  import MoveButtons from "$lib/ui/MoveButtons.svelte";
  import { compareCustomersByLabel, customerDisplayLabel, namesakeIds } from "$lib/customerDisplay";
  import { fetchCustomers, fetchPickerLots } from "$lib/manageData";
  import { errorMessage, latestOnly } from "$lib/async";
  import { fetchTastingWithLots, onlineSeatsByCustomer, participantOrigin, placesLabel, seatsTaken, tastingTitle } from "$lib/publicData";
  import { isoDateOnly, todayIso } from "$lib/dates";
  import { formatDate } from "$lib/format";
  import { isDiscontinued, lotLabel } from "$lib/products";

  type TastingRow = Tasting & {
    tasting_lot: { order: number; lot_id: string }[];
    tasting_customer: { customer_id: string; seats: number }[];
    tasting_registration: { customer_id: string | null; seats: number; status: string }[];
  };

  type ModalLotEntry = {
    lot_id: string;
    lot: any;
  };

  type ModalCustomerEntry = {
    customer_id: string;
    customer: Customer;
    /** Places de sa réservation en ligne, s'il vient du site. */
    onlineSeats?: number;
    /** tasting_customer.seats (1, le défaut de la colonne, pour un ajout pas encore enregistré). */
    seats: number;
  };

  let tastings = $state<TastingRow[]>([]);
  let customers = $state.raw<Customer[]>([]);
  /** Participants signalés « Doublon possible » (une autre fiche porte leur nom). */
  let duplicateIds = $derived(namesakeIds(customers));
  let lots = $state.raw<any[]>([]);
  let loading = $state(true);
  let error = $state("");
  let showModal = $state(false);
  let editingTasting = $state<TastingRow | null>(null);
  let modalLots = $state<ModalLotEntry[]>([]);
  let modalCustomers = $state<ModalCustomerEntry[]>([]);
  /** Participants à l'ouverture du formulaire : seuls les ajouts et retraits sont enregistrés. */
  let initialCustomerIds: string[] = [];
  let selectedLotId = $state("");
  let selectedCustomerId = $state("");
  let saving = $state(false);
  let cardsBusyId = $state("");
  /** Participants d'une dégustation, en lecture seule depuis la liste (`entries` nul pendant le chargement). */
  let participantsView = $state.raw<{ title: string; entries: ModalCustomerEntry[] | null } | null>(null);

  const emptyForm = () => ({
    name: "",
    date: todayIso(),
    location: "",
    notes: "",
    start_time: "",
    price: "",
    capacity: "",
    description: "",
    is_private: false,
  });
  let formData = $state(emptyForm());
  /* On ne propose pas un lot « plus jamais disponible ». */
  let pickableLots = $derived(lots.filter((v) => !isDiscontinued(v)));

  onMount(async () => {
    /* Chaque liste est gardée même si une autre échoue. */
    const results = await Promise.allSettled([
      loadTastings(),
      fetchPickerLots().then((v) => (lots = v)),
      fetchCustomers().then((c) => (customers = c)),
    ]);
    const failed = results.find((r) => r.status === "rejected");
    if (failed) error = errorMessage(failed.reason);
    loading = false;
    /* /manage/tastings?id=… ouvre directement la dégustation (lien du tableau de bord, de Piloter). */
    const linked = tastings.find((t) => t.id === $page.url.searchParams.get("id"));
    if (linked) void openEditModal(linked);
  });

  async function downloadCards(tasting: TastingRow) {
    if (cardsBusyId) return;
    cardsBusyId = tasting.id;
    error = "";
    try {
      const res = await fetchTastingWithLots(tasting.id);
      if (!res.tasting || res.lots.length === 0) {
        error = "Ajoutez des produits à la dégustation pour générer les fiches.";
        return;
      }
      /* jsPDF et qrcode ne sont chargés qu'au moment de générer les fiches. */
      const { downloadTableCardsPdf } = await import("$lib/pdf/tableCardsPdf");
      await downloadTableCardsPdf(res.tasting, res.lots, window.location.origin);
    } catch (e) {
      error = errorMessage(e);
    } finally {
      cardsBusyId = "";
    }
  }

  function numOrNull(v: string): number | null {
    const n = parseFloat(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  function isCustomerInModal(customerId: string): boolean {
    return modalCustomers.some((e) => e.customer_id === customerId);
  }

  function isLotInModal(lotId: string): boolean {
    return modalLots.some((e) => e.lot_id === lotId);
  }

  async function loadTastings() {
    const { data, error: fetchError } = await supabase
      .from("tasting")
      .select(
        `
        *,
        tasting_lot ( order, lot_id ),
        tasting_customer ( customer_id, seats ),
        tasting_registration ( customer_id, seats, status )
      `,
      )
      .eq("tasting_registration.status", "confirmed")
      .order("date", { ascending: false });

    if (fetchError) {
      error = fetchError.message;
      tastings = [];
    } else {
      tastings = (data || []) as TastingRow[];
    }
  }

  function byCustomerLabel(a: ModalCustomerEntry, b: ModalCustomerEntry): number {
    return compareCustomersByLabel(a.customer, b.customer);
  }

  /* Les chargeurs de la modale lèvent leurs erreurs : save_tasting remplace vins et inscrits
     par ceux de la modale, qui ne doit donc jamais s'ouvrir sans eux. */
  async function loadModalCustomers(tastingId: string): Promise<{ entries: ModalCustomerEntry[]; ids: string[] }> {
    const [{ data, error: fetchError }, { data: regs, error: regError }] = await Promise.all([
      supabase
      .from("tasting_customer")
      .select(
        `
        customer_id,
        seats,
        customer (
          id,
          first_name,
          last_name,
          company_name,
          email
        )
      `,
      )
      .eq("tasting_id", tastingId),
      supabase
        .from("tasting_registration")
        .select("customer_id, seats, status")
        .eq("tasting_id", tastingId)
        .eq("status", "confirmed")
        .not("customer_id", "is", null),
    ]);

    if (fetchError || regError) throw new Error((fetchError || regError)!.message);
    const onlineSeats = onlineSeatsByCustomer(regs || []);
    const entries = (data || [])
      .filter((r) => r.customer)
      .map((r) => ({
        customer_id: r.customer_id,
        customer: r.customer as Customer,
        onlineSeats: onlineSeats.get(r.customer_id),
        seats: r.seats,
      }))
      .sort(byCustomerLabel);
    return { entries, ids: (data || []).map((r) => r.customer_id) };
  }

  async function loadModalLots(tastingId: string): Promise<ModalLotEntry[]> {
    const { data, error: fetchError } = await supabase
      .from("tasting_lot")
      .select(
        `
        order,
        lot_id,
        lot (
          id,
          production_year,
          year,
          volume_ml,
          product (
            kind,
            name,
            producer (name),
            appellation (name, label (name))
          )
        )
      `,
      )
      .eq("tasting_id", tastingId)
      .order("order", { ascending: true });

    if (fetchError) throw new Error(fetchError.message);
    return (data || [])
      .filter((r) => r.lot)
      .map((r) => ({
        lot_id: r.lot_id,
        lot: r.lot,
      }));
  }

  function resetForm() {
    formData = emptyForm();
    modalLots = [];
    modalCustomers = [];
    initialCustomerIds = [];
    selectedLotId = "";
    selectedCustomerId = "";
  }

  const formLoad = latestOnly((e) => (error = errorMessage(e)));

  function openCreateModal() {
    formLoad.cancel();
    editingTasting = null;
    error = "";
    resetForm();
    showModal = true;
  }

  async function openEditModal(tasting: TastingRow) {
    error = "";
    const loaded = await formLoad.run(
      () => Promise.all([loadModalLots(tasting.id), loadModalCustomers(tasting.id)]),
    );
    if (!loaded) return;

    const [tastingLots, registered] = loaded;
    modalLots = tastingLots;
    modalCustomers = registered.entries;
    initialCustomerIds = registered.ids;
    editingTasting = tasting;
    formData = {
      name: tasting.name || "",
      date: isoDateOnly(tasting.date),
      location: tasting.location || "",
      notes: tasting.notes || "",
      start_time: tasting.start_time ? tasting.start_time.slice(0, 5) : "",
      price: tasting.price != null ? String(tasting.price) : "",
      capacity: tasting.capacity != null ? String(tasting.capacity) : "",
      description: tasting.description || "",
      is_private: tasting.is_private === true,
    };
    selectedLotId = "";
    selectedCustomerId = "";
    showModal = true;
  }

  const participantsLoad = latestOnly((e) => {
    participantsView = null;
    error = errorMessage(e);
  });

  async function showParticipants(tasting: TastingRow) {
    error = "";
    const title = `Participants · ${tastingTitle(tasting)}`;
    participantsView = { title, entries: null };
    const loaded = await participantsLoad.run(() => loadModalCustomers(tasting.id));
    if (loaded) participantsView = { title, entries: loaded.entries };
  }

  function closeParticipants() {
    participantsLoad.cancel();
    participantsView = null;
  }

  function closeModal() {
    showModal = false;
    editingTasting = null;
    resetForm();
  }

  function addCustomerToTasting() {
    if (!selectedCustomerId) return;
    if (isCustomerInModal(selectedCustomerId)) {
      error = "Ce client est déjà associé.";
      return;
    }
    const customer = customers.find((c) => c.id === selectedCustomerId);
    if (!customer) return;
    modalCustomers = [...modalCustomers, { customer_id: customer.id, customer, seats: 1 }].sort(byCustomerLabel);
    selectedCustomerId = "";
    error = "";
  }

  function removeCustomerFromList(index: number) {
    modalCustomers = modalCustomers.filter((_, i) => i !== index);
  }

  function addLotToTasting() {
    if (!selectedLotId) return;
    if (isLotInModal(selectedLotId)) {
      error = "Ce lot est déjà dans la liste.";
      return;
    }
    const lot = lots.find((v) => v.id === selectedLotId);
    if (!lot) return;
    modalLots = [
      ...modalLots,
      { lot_id: selectedLotId, lot },
    ];
    selectedLotId = "";
    error = "";
  }

  function removeLotFromList(index: number) {
    modalLots = modalLots.filter((_, i) => i !== index);
  }

  async function handleSubmit() {
    if (!formData.date) {
      error = "La date est obligatoire.";
      return;
    }

    saving = true;
    error = "";

    const capacity = numOrNull(formData.capacity);
    const payload = {
      name: formData.name.trim() || null,
      date: formData.date,
      location: formData.location.trim() || null,
      notes: formData.notes.trim() || null,
      start_time: formData.start_time || null,
      price: numOrNull(formData.price),
      capacity: capacity != null ? Math.max(0, Math.round(capacity)) : null,
      description: formData.description.trim() || null,
      is_private: formData.is_private,
    };

    try {
      /* Dégustation, vins (dans l'ordre) et participants en une transaction (fonction SQL save_tasting). */
      const { error: saveError } = await supabase.rpc("save_tasting", {
        p_tasting_id: editingTasting?.id ?? NEW_ROW,
        p_tasting: payload,
        p_lot_ids: modalLots.map((e) => e.lot_id),
        p_added_customer_ids: modalCustomers.map((e) => e.customer_id).filter((id) => !initialCustomerIds.includes(id)),
        p_removed_customer_ids: initialCustomerIds.filter((id) => !modalCustomers.some((e) => e.customer_id === id)),
      });
      if (saveError) throw new Error(saveError.message);

      closeModal();
      await loadTastings();
    } catch (e) {
      error = errorMessage(e);
    } finally {
      saving = false;
    }
  }

  /** Appelée après confirmation via le ConfirmDialog. */
  async function deleteTasting(tasting: TastingRow) {
    /* Les participants partent avec la dégustation (cascade) : les supprimer avant annulerait leurs
       réservations en ligne même si la suppression de la dégustation échouait. */
    const { error: linkErr } = await supabase.from("tasting_lot").delete().eq("tasting_id", tasting.id);
    if (linkErr) {
      error = linkErr.message;
      return;
    }

    const { error: delErr } = await supabase
      .from("tasting")
      .delete()
      .eq("id", tasting.id);

    if (delErr) {
      error = delErr.message;
      return;
    }

    await loadTastings();
  }

  function lotCount(t: TastingRow): number {
    return t.tasting_lot?.length ?? 0;
  }

  /** Places prises, comme dans Piloter : une réservation en ligne de 2 places compte pour 2. */
  function participantPlaces(t: TastingRow): number {
    return seatsTaken(t.tasting_customer ?? [], t.tasting_registration ?? []);
  }

  function rowItems(tasting: TastingRow): MenuItem[] {
    return [
      { label: "Modifier", icon: IconPencil, onSelect: () => openEditModal(tasting) },
      /* Page publique dans un nouvel onglet, comme l'ancien lien « Voir ». */
      { label: "Voir sur le site", icon: IconExternal, onSelect: () => window.open(`/tastings/${tasting.id}`, "_blank", "noopener,noreferrer") },
      { label: "Fiches de table", icon: IconDownload, disabled: !!cardsBusyId, onSelect: () => downloadCards(tasting) },
      { label: "Supprimer…", icon: IconTrash, danger: true, separator: true, onSelect: () => askDelete(tasting) },
    ];
  }

  let deleteTarget = $state<TastingRow | null>(null);
  let confirmOpen = $state(false);
  function askDelete(tasting: TastingRow) {
    deleteTarget = tasting;
    confirmOpen = true;
  }
</script>

<svelte:head>
  <title>Dégustations - Gestion</title>
</svelte:head>

<ManagePageShell title="Dégustations">
  {#snippet actions()}
    <Button variant="primary" onclick={openCreateModal}><IconPlus size={18} strokeWidth={1.75} /> Nouvelle dégustation</Button>
  {/snippet}

  {#if error && !showModal}
    <div class="error-message" role="alert">{error}</div>
  {/if}

  {#if loading}
    <Spinner />
  {:else if tastings.length === 0}
    <Card padded={false}>
      <EmptyState icon={IconGlasses} title="Aucune dégustation pour l’instant" text="Créez la première dégustation, puis ajoutez-y ses produits et ses participants.">
        <Button onclick={openCreateModal}>Créer la première dégustation</Button>
      </EmptyState>
    </Card>
  {:else}
    <DataTable caption="Liste des dégustations">
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th scope="col">Nom</th>
          <th scope="col">Lieu</th>
          <th scope="col" class="num">Produits</th>
          <th scope="col" class="num">Participants</th>
          <th scope="col" class="col-actions"><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {#each tastings as tasting (tasting.id)}
          {@const count = participantPlaces(tasting)}
          <tr>
            <td>{formatDate(tasting.date)}</td>
            <td>
              <strong>{tasting.name || "—"}</strong>
              {#if tasting.is_private}<span class="private-badge" title="Non listée sur le site public">Privée</span>{/if}
            </td>
            <td>{tasting.location || "—"}</td>
            <td class="num">{lotCount(tasting)}</td>
            <td class="num">
              {#if tasting.tasting_customer?.length}
                <Button size="sm" variant="ghost" title="Voir les participants" ariaLabel="Voir les participants ({placesLabel(count)})" onclick={() => showParticipants(tasting)}>{count}</Button>
              {:else}
                0
              {/if}
            </td>
            <td class="col-actions">
              <div class="ui-row-actions">
                <!-- Fiches de table en cours de génération pour cette dégustation. -->
                {#if cardsBusyId === tasting.id}<Spinner size={18} inline />{/if}
                <IconButton href="/manage/tastings/{tasting.id}/live" label="Piloter {tastingTitle(tasting)}">
                  <IconPlay size={18} strokeWidth={1.75} />
                </IconButton>
                <RowMenu items={rowItems(tasting)} label="Actions pour {tastingTitle(tasting)}" />
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
  title="Supprimer cette dégustation ?"
  message={deleteTarget
    ? `La dégustation « ${deleteTarget.name || formatDate(deleteTarget.date)} » sera supprimée avec toutes les données associées.`
    : ""}
  action={() => deleteTasting(deleteTarget!)}
/>

<Modal open={showModal} title={editingTasting ? "Modifier la dégustation" : "Nouvelle dégustation"} maxWidth={720} onclose={closeModal}>
  <form id="tasting-form" class="tasting-form" onsubmit={preventDefault(handleSubmit)}>
    {#if error}
      <div class="error-message" role="alert">{error}</div>
    {/if}

    <div class="ui-grid-2">
      <Field id="tasting-date" label="Date" required>
        <input id="tasting-date" class="ui-control" type="date" bind:value={formData.date} required />
      </Field>
      <Field id="tasting-time" label="Heure">
        <input id="tasting-time" class="ui-control" type="time" bind:value={formData.start_time} />
      </Field>
      <Field id="tasting-name" label="Nom">
        <input id="tasting-name" class="ui-control" type="text" bind:value={formData.name} />
      </Field>
      <Field id="tasting-location" label="Lieu">
        <input id="tasting-location" class="ui-control" type="text" bind:value={formData.location} />
      </Field>
      <Field id="tasting-price" label="Prix / personne (€)">
        <input id="tasting-price" class="ui-control" type="text" inputmode="decimal" bind:value={formData.price} />
      </Field>
      <Field id="tasting-capacity" label="Places au total" help="Participants ajoutés ici compris : une fois plein, le site met les réservations en liste d’attente.">
        {#snippet children({ describedby })}
          <input id="tasting-capacity" class="ui-control" type="number" min="0" placeholder="Illimité" bind:value={formData.capacity} aria-describedby={describedby} />
        {/snippet}
      </Field>
    </div>

    <div class="checkbox-field">
      <label class="checkbox-label">
        <input type="checkbox" bind:checked={formData.is_private} aria-describedby="tasting-private-help" />
        Dégustation privée (chez un client, en externe)
      </label>
      <small id="tasting-private-help" class="t-caption">Non listée sur le site et sans inscription en ligne. La page et le mode live restent accessibles par lien.</small>
    </div>

    <Field id="tasting-description" label="Description publique">
      <textarea id="tasting-description" class="ui-control" rows="3" bind:value={formData.description} placeholder="Affichée sur le site (thème, vigneron invité, menu…)"></textarea>
    </Field>
    <Field id="tasting-notes" label="Notes internes" help="Jamais affichées sur le site public.">
      {#snippet children({ describedby })}
        <textarea id="tasting-notes" class="ui-control" rows="3" bind:value={formData.notes} aria-describedby={describedby}></textarea>
      {/snippet}
    </Field>

    <section class="block" aria-labelledby="tasting-lots-label">
      <h3 id="tasting-lots-label" class="t-label">Produits (ordre de passage)</h3>
      {#if modalLots.length === 0}
        <EmptyState title="Aucun produit ajouté" compact />
      {:else}
        <ol class="entries">
          {#each modalLots as entry, i (entry.lot_id)}
            {@const label = lotLabel(entry.lot)}
            <li class="entry">
              <span class="entry-num" aria-hidden="true">{i + 1}</span>
              <span class="entry-label">{label}</span>
              <MoveButtons bind:list={modalLots} index={i} {label} />
              <IconButton label="Retirer {label}" onclick={() => removeLotFromList(i)}>
                <IconX size={18} strokeWidth={1.75} />
              </IconButton>
            </li>
          {/each}
        </ol>
      {/if}

      <div class="add-row">
        <LotAutocomplete
          bind:value={selectedLotId}
          lots={pickableLots}
          includeTastingOption={false}
          isLotAlreadyAdded={isLotInModal}
          formatLabel={lotLabel}
          placeholder="Rechercher un produit…"
        />
        <Button disabled={!selectedLotId} onclick={addLotToTasting}><IconPlus size={16} strokeWidth={1.75} /> Ajouter</Button>
      </div>
    </section>

    <section class="block" aria-labelledby="tasting-customers-label">
      <h3 id="tasting-customers-label" class="t-label">Participants</h3>
      {#if modalCustomers.length === 0}
        <EmptyState title="Aucun participant" text="Les réservations faites sur le site s’ajoutent ici toutes seules." compact />
      {:else}
        <ul class="entries">
          {#each modalCustomers as entry, i (entry.customer_id)}
            {@const label = customerDisplayLabel(entry.customer)}
            <li class="entry">
              <span class="entry-label">
                {label}
                <span class="t-caption origin">{participantOrigin(entry.onlineSeats, entry.seats)}</span>
              </span>
              <IconButton label={entry.onlineSeats ? `Retirer ${label} et annuler sa réservation en ligne` : `Retirer ${label}`} onclick={() => removeCustomerFromList(i)}>
                <IconX size={18} strokeWidth={1.75} />
              </IconButton>
            </li>
          {/each}
        </ul>
        {#if modalCustomers.some((e) => e.onlineSeats)}
          <small class="t-caption">Retirer un inscrit du site annule sa réservation en ligne (elle peut être rétablie depuis Piloter).</small>
        {/if}
      {/if}

      <div class="add-row">
        <CustomerAutocomplete
          bind:value={selectedCustomerId}
          {customers}
          isCustomerAlreadyAdded={isCustomerInModal}
          placeholder="Rechercher un client…"
        />
        <Button disabled={!selectedCustomerId} onclick={addCustomerToTasting}><IconPlus size={16} strokeWidth={1.75} /> Ajouter</Button>
      </div>
    </section>
  </form>
  {#snippet footer()}
    <Button variant="ghost" onclick={closeModal} disabled={saving}>Annuler</Button>
    <Button variant="primary" type="submit" form="tasting-form" disabled={saving}>{saving ? "Enregistrement…" : editingTasting ? "Mettre à jour" : "Créer"}</Button>
  {/snippet}
</Modal>

<Modal open={participantsView != null} title={participantsView?.title} maxWidth={480} onclose={closeParticipants}>
  {#if !participantsView?.entries}
    <Spinner />
  {:else if participantsView.entries.length === 0}
    <EmptyState icon={IconUsers} title="Aucun participant" compact />
  {:else}
    <ul class="participants">
      {#each participantsView.entries as entry (entry.customer_id)}
        <li>
          <a href="/manage/customers/{entry.customer_id}"><strong>{customerDisplayLabel(entry.customer)}</strong></a>
          <span class="t-caption">{participantOrigin(entry.onlineSeats, entry.seats)}</span>
          {#if duplicateIds.has(entry.customer_id)}
            <span class="t-caption t-warn">Doublon possible : un autre client porte ce nom (fusion depuis sa fiche)</span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</Modal>

<style>
  .private-badge {
    display: inline-flex;
    align-items: center;
    height: 20px;
    margin-left: 8px;
    padding: 0 8px;
    border-radius: var(--r-pill);
    background: var(--st-closed-bg);
    color: var(--st-closed-fg);
    font-size: 11px;
    font-weight: 500;
    vertical-align: middle;
  }

  .tasting-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .checkbox-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .block h3 {
    margin: 0;
  }

  .entries {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--border-soft);
    border-radius: var(--r-sm);
    overflow: hidden;
  }

  .entry {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 4px 4px 12px;
    border-bottom: 1px solid var(--border-soft);
    background: var(--table-head);
  }

  .entry:last-child {
    border-bottom: none;
  }

  .entry-num {
    flex: 0 0 1.5rem;
    font-weight: 700;
    color: var(--ink-2);
    text-align: center;
  }

  .entry-label {
    flex: 1;
    min-width: 0;
  }

  .origin {
    display: block;
  }

  .add-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .participants {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .participants li {
    display: flex;
    flex-direction: column;
    padding: 10px 0;
    border-bottom: 1px solid var(--border-soft);
  }

  .participants li:last-child {
    border-bottom: none;
  }
</style>
