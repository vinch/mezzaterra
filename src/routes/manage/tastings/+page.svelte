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
  import SortHeader from "$lib/ui/SortHeader.svelte";
  import { sortedBy, type SortState } from "$lib/sort";
  import Card from "$lib/ui/Card.svelte";
  import Field from "$lib/ui/Field.svelte";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import ProductVintageAutocomplete from "$lib/components/manage/ProductVintageAutocomplete.svelte";
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
  import { fetchCustomers, fetchPickerVintages } from "$lib/manageData";
  import { errorMessage, latestOnly } from "$lib/async";
  import { fetchTastingWithWines, onlineSeatsByCustomer, participantOrigin, placesLabel, seatsTaken, tastingTitle } from "$lib/publicData";
  import { isoDateOnly, todayIso } from "$lib/dates";
  import { formatDate } from "$lib/format";
  import { isDiscontinued, vintageLabel } from "$lib/wine";

  type TastingRow = Tasting & {
    tasting_wine_vintage: { order: number; wine_vintage_id: string }[];
    tasting_customer: { customer_id: string; seats: number }[];
    tasting_registration: { customer_id: string | null; seats: number; status: string }[];
  };

  type ModalWineEntry = {
    wine_vintage_id: string;
    vintage: any;
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
  const SORT_VALUES = {
    date: (t: TastingRow) => t.date,
    name: (t: TastingRow) => t.name,
    location: (t: TastingRow) => t.location,
    products: (t: TastingRow) => wineCount(t),
    participants: (t: TastingRow) => participantPlaces(t),
  };
  /* Par défaut, la plus récente d'abord (ordre du chargement). */
  let sort = $state<SortState<keyof typeof SORT_VALUES>>({ key: "date", dir: "desc" });
  let sortedTastings = $derived(sortedBy(tastings, sort, SORT_VALUES));
  let customers = $state.raw<Customer[]>([]);
  /** Participants signalés « Doublon possible » (une autre fiche porte leur nom). */
  let duplicateIds = $derived(namesakeIds(customers));
  let wineVintages = $state.raw<any[]>([]);
  let loading = $state(true);
  let error = $state("");
  let showModal = $state(false);
  let editingTasting = $state<TastingRow | null>(null);
  let modalWines = $state<ModalWineEntry[]>([]);
  let modalCustomers = $state<ModalCustomerEntry[]>([]);
  /** Participants à l'ouverture du formulaire : seuls les ajouts et retraits sont enregistrés. */
  let initialCustomerIds: string[] = [];
  let selectedVintageId = $state("");
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
  let pickableVintages = $derived(wineVintages.filter((v) => !isDiscontinued(v)));

  onMount(async () => {
    /* Chaque liste est gardée même si une autre échoue. */
    const results = await Promise.allSettled([
      loadTastings(),
      fetchPickerVintages().then((v) => (wineVintages = v)),
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
      const res = await fetchTastingWithWines(tasting.id);
      if (!res.tasting || res.wineVintages.length === 0) {
        error = "Ajoutez des produits à la dégustation pour générer les fiches.";
        return;
      }
      /* jsPDF et qrcode ne sont chargés qu'au moment de générer les fiches. */
      const { downloadTableCardsPdf } = await import("$lib/pdf/tableCardsPdf");
      await downloadTableCardsPdf(res.tasting, res.wineVintages, window.location.origin);
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

  function isVintageInModal(vintageId: string): boolean {
    return modalWines.some((e) => e.wine_vintage_id === vintageId);
  }

  async function loadTastings() {
    const { data, error: fetchError } = await supabase
      .from("tasting")
      .select(
        `
        *,
        tasting_wine_vintage ( order, wine_vintage_id ),
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

  async function loadModalWines(tastingId: string): Promise<ModalWineEntry[]> {
    const { data, error: fetchError } = await supabase
      .from("tasting_wine_vintage")
      .select(
        `
        order,
        wine_vintage_id,
        wine_vintage (
          id,
          production_year,
          year,
          volume_ml,
          wine (
            kind,
            name,
            winery (name),
            appelation (name, label (name))
          )
        )
      `,
      )
      .eq("tasting_id", tastingId)
      .order("order", { ascending: true });

    if (fetchError) throw new Error(fetchError.message);
    return (data || [])
      .filter((r) => r.wine_vintage)
      .map((r) => ({
        wine_vintage_id: r.wine_vintage_id,
        vintage: r.wine_vintage,
      }));
  }

  function resetForm() {
    formData = emptyForm();
    modalWines = [];
    modalCustomers = [];
    initialCustomerIds = [];
    selectedVintageId = "";
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
      () => Promise.all([loadModalWines(tasting.id), loadModalCustomers(tasting.id)]),
    );
    if (!loaded) return;

    const [wines, registered] = loaded;
    modalWines = wines;
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
    selectedVintageId = "";
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

  function addWineToTasting() {
    if (!selectedVintageId) return;
    if (isVintageInModal(selectedVintageId)) {
      error = "Ce lot est déjà dans la liste.";
      return;
    }
    const vintage = wineVintages.find((v) => v.id === selectedVintageId);
    if (!vintage) return;
    modalWines = [
      ...modalWines,
      { wine_vintage_id: selectedVintageId, vintage },
    ];
    selectedVintageId = "";
    error = "";
  }

  function removeWineFromList(index: number) {
    modalWines = modalWines.filter((_, i) => i !== index);
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
        p_wine_ids: modalWines.map((e) => e.wine_vintage_id),
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
    const { error: linkErr } = await supabase.from("tasting_wine_vintage").delete().eq("tasting_id", tasting.id);
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

  function wineCount(t: TastingRow): number {
    return t.tasting_wine_vintage?.length ?? 0;
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
          <SortHeader column="date" label="Date" firstDir="desc" bind:sort />
          <SortHeader column="name" label="Nom" bind:sort />
          <SortHeader column="location" label="Lieu" bind:sort />
          <SortHeader column="products" label="Produits" num bind:sort />
          <SortHeader column="participants" label="Participants" num bind:sort />
          <th scope="col" class="col-actions"><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {#each sortedTastings as tasting (tasting.id)}
          {@const count = participantPlaces(tasting)}
          <tr>
            <td>{formatDate(tasting.date)}</td>
            <td>
              <strong>{tasting.name || "—"}</strong>
              {#if tasting.is_private}<span class="private-badge" title="Non listée sur le site public">Privée</span>{/if}
            </td>
            <td>{tasting.location || "—"}</td>
            <td class="num">{wineCount(tasting)}</td>
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

    <section class="block" aria-labelledby="tasting-wines-label">
      <h3 id="tasting-wines-label" class="t-label">Produits (ordre de passage)</h3>
      {#if modalWines.length === 0}
        <EmptyState title="Aucun produit ajouté" compact />
      {:else}
        <ol class="entries">
          {#each modalWines as entry, i (entry.wine_vintage_id)}
            {@const label = vintageLabel(entry.vintage)}
            <li class="entry">
              <span class="entry-num" aria-hidden="true">{i + 1}</span>
              <span class="entry-label">{label}</span>
              <MoveButtons bind:list={modalWines} index={i} {label} />
              <IconButton label="Retirer {label}" onclick={() => removeWineFromList(i)}>
                <IconX size={18} strokeWidth={1.75} />
              </IconButton>
            </li>
          {/each}
        </ol>
      {/if}

      <div class="add-row">
        <ProductVintageAutocomplete
          bind:value={selectedVintageId}
          wineVintages={pickableVintages}
          includeTastingOption={false}
          isVintageAlreadyAdded={isVintageInModal}
          formatLabel={vintageLabel}
          placeholder="Rechercher un produit…"
        />
        <Button disabled={!selectedVintageId} onclick={addWineToTasting}><IconPlus size={16} strokeWidth={1.75} /> Ajouter</Button>
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
