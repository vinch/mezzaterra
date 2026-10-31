<script lang="ts">
  import { preventDefault } from "$lib/ui/events";

  import { NEW_ROW, supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import type { Customer, Tasting } from "$lib/types";
  import Modal from "$lib/ui/Modal.svelte";
  import Button from "$lib/ui/Button.svelte";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import ProductVintageAutocomplete from "$lib/components/manage/ProductVintageAutocomplete.svelte";
  import CustomerAutocomplete from "$lib/components/manage/CustomerAutocomplete.svelte";
  import Spinner from "$lib/ui/Spinner.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import { IconUsers } from "$lib/ui/icons";
  import { compareCustomersByLabel, customerDisplayLabel, namesakeIds } from "$lib/customerDisplay";
  import { fetchCustomers, fetchPickerVintages } from "$lib/manageData";
  import { errorMessage, latestOnly } from "$lib/async";
  import { fetchTastingWithWines, onlineSeatsByCustomer, participantOrigin, placesLabel, seatsTaken, tastingTitle } from "$lib/publicData";
  import { todayIso } from "$lib/dates";
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

  let formData = $state({
    name: "",
    date: "",
    location: "",
    notes: "",
    start_time: "",
    price: "",
    capacity: "",
    description: "",
    is_private: false,
  });

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
      error = e instanceof Error ? e.message : "Génération des fiches impossible";
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

  function isoDateOnly(value: string): string {
    if (!value) return "";
    return value.includes("T") ? value.split("T")[0] : value;
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
    formData = {
      name: "",
      date: todayIso(),
      location: "",
      notes: "",
      start_time: "",
      price: "",
      capacity: "",
      description: "",
      is_private: false,
    };
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

  function moveWine(index: number, delta: number) {
    const j = index + delta;
    if (j < 0 || j >= modalWines.length) return;
    const next = [...modalWines];
    [next[index], next[j]] = [next[j], next[index]];
    modalWines = next;
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
      error = e instanceof Error ? e.message : "Erreur lors de l’enregistrement";
    } finally {
      saving = false;
    }
  }

  async function deleteTasting(tasting: TastingRow) {
    const label = tasting.name || formatDate(tasting.date);
    if (
      !confirm(
        `Supprimer la dégustation « ${label} » et toutes les données associées ?`,
      )
    ) {
      return;
    }

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
</script>

<svelte:head>
  <title>Dégustations - Gestion</title>
</svelte:head>

<ManagePageShell title="Dégustations">
  {#snippet actions()}
      <button type="button" class="btn-primary" onclick={openCreateModal}>
        + Nouvelle dégustation
      </button>
  {/snippet}

  {#if error && !showModal}
    <div class="error-message">{error}</div>
  {/if}

  {#if loading}
    <Spinner />
  {:else if tastings.length === 0}
    <div class="empty-state">
      <p>Aucune dégustation enregistrée.</p>
      <button type="button" class="btn-primary" onclick={openCreateModal}>
        Créer la première dégustation
      </button>
    </div>
  {:else}
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Nom</th>
            <th>Lieu</th>
            <th class="num">Produits</th>
            <th class="num">Participants</th>
            <th>Actions</th>
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
              <td class="num">{wineCount(tasting)}</td>
              <td class="num">
                {#if tasting.tasting_customer?.length}
                  <Button size="sm" variant="ghost" title="Voir les participants" ariaLabel="Voir les participants ({placesLabel(count)})" onclick={() => showParticipants(tasting)}>{count}</Button>
                {:else}
                  0
                {/if}
              </td>
              <td>
                <div class="actions">
                  <a
                    href="/tastings/{tasting.id}"
                    class="ui-btn ui-btn--secondary ui-btn--sm"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Voir
                  </a>
                  <a href="/manage/tastings/{tasting.id}/live" class="ui-btn ui-btn--secondary ui-btn--sm">
                    Piloter
                  </a>
                  <button
                    type="button"
                    class="ui-btn ui-btn--secondary ui-btn--sm"
                    disabled={cardsBusyId === tasting.id}
                    onclick={() => downloadCards(tasting)}
                  >
                    {cardsBusyId === tasting.id ? "…" : "Fiches de table"}
                  </button>
                  <button
                    type="button"
                    class="ui-btn ui-btn--secondary ui-btn--sm"
                    onclick={() => openEditModal(tasting)}
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    class="ui-btn ui-btn--danger ui-btn--sm"
                    onclick={() => deleteTasting(tasting)}
                  >
                    Supprimer
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</ManagePageShell>

<Modal open={showModal} title={editingTasting ? "Modifier la dégustation" : "Nouvelle dégustation"} onclose={closeModal}>
  <form id="tasting-form" onsubmit={preventDefault(handleSubmit)}>
    {#if error && showModal}
      <div class="error-message">{error}</div>
    {/if}

    <div class="form-grid">
      <div class="form-group">
        <label for="tasting-date">Date *</label>
        <input type="date" id="tasting-date" bind:value={formData.date} required />
      </div>
      <div class="form-group">
        <label for="tasting-name">Nom</label>
        <input type="text" id="tasting-name" bind:value={formData.name} />
      </div>
      <div class="form-group">
        <label for="tasting-location">Lieu</label>
        <input type="text" id="tasting-location" bind:value={formData.location} />
      </div>
      <div class="form-group full-width">
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={formData.is_private} />
          Dégustation privée (chez un client, en externe)
        </label>
        <small class="field-hint">
          Non listée sur le site et sans inscription en ligne. La page et le mode live restent accessibles par lien.
        </small>
      </div>
      <div class="form-group">
        <label for="tasting-time">Heure</label>
        <input type="time" id="tasting-time" bind:value={formData.start_time} />
      </div>
      <div class="form-group">
        <label for="tasting-price">Prix / personne (€)</label>
        <input type="text" inputmode="decimal" id="tasting-price" bind:value={formData.price} />
      </div>
      <div class="form-group">
        <label for="tasting-capacity">Places au total</label>
        <input type="number" min="0" id="tasting-capacity" bind:value={formData.capacity} placeholder="Illimité" />
        <small class="field-hint">Participants ajoutés ici compris : une fois plein, le site met les réservations en liste d’attente.</small>
      </div>
      <div class="form-group full-width">
        <label for="tasting-description">Description publique</label>
        <textarea id="tasting-description" rows="3" bind:value={formData.description} placeholder="Affichée sur le site (thème, vigneron invité, menu…)"></textarea>
      </div>
      <div class="form-group full-width">
        <label for="tasting-notes">Notes internes</label>
        <textarea id="tasting-notes" rows="3" bind:value={formData.notes}></textarea>
        <small class="field-hint">Jamais affichées sur le site public.</small>
      </div>

      <div class="form-group full-width tasting-wines-block">
        <span class="section-title" id="tasting-wines-label">Produits (ordre de passage)</span>

      {#if modalWines.length === 0}
        <p class="empty-text">Aucun produit ajouté.</p>
      {:else}
        <ol class="wine-order-list">
          {#each modalWines as entry, i (entry.wine_vintage_id)}
            <li class="wine-order-item">
              <span class="wine-order-num" aria-hidden="true">{i + 1}</span>
              <span class="wine-order-label"
                >{vintageLabel(entry.vintage)}</span
              >
              <div class="wine-order-actions">
                <button
                  type="button"
                  class="btn-icon"
                  title="Monter"
                  disabled={i === 0}
                  onclick={() => moveWine(i, -1)}
                  aria-label="Monter"
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="btn-icon"
                  title="Descendre"
                  disabled={i === modalWines.length - 1}
                  onclick={() => moveWine(i, 1)}
                  aria-label="Descendre"
                >
                  ↓
                </button>
                <button
                  type="button"
                  class="ui-remove"
                  title="Retirer"
                  onclick={() => removeWineFromList(i)}
                  aria-label="Retirer"
                >
                  ×
                </button>
              </div>
            </li>
          {/each}
        </ol>
      {/if}

      <div class="add-wine-row">
        <ProductVintageAutocomplete
          bind:value={selectedVintageId}
          wineVintages={wineVintages.filter((v) => !isDiscontinued(v))}
          includeTastingOption={false}
          disableWhenNoStock={false}
          isVintageAlreadyAdded={isVintageInModal}
          formatLabel={vintageLabel}
          getAvailableStock={() => 0}
          placeholder="Rechercher un produit…"
        />
        <button
          type="button"
          class="ui-btn ui-btn--secondary ui-btn--sm"
          disabled={!selectedVintageId}
          onclick={addWineToTasting}
        >
          Ajouter
        </button>
      </div>
      </div>

      <div class="form-group full-width tasting-customers-block">
        <span class="section-title" id="tasting-customers-label">Participants</span>

        {#if modalCustomers.length === 0}
          <p class="empty-text">Aucun participant. Les réservations faites sur le site s’ajoutent ici toutes seules.</p>
        {:else}
          <ul class="customer-list">
            {#each modalCustomers as entry, i (entry.customer_id)}
              <li class="customer-list-item">
                <span>
                  {customerDisplayLabel(entry.customer)}
                  <span class="t-caption origin">{participantOrigin(entry.onlineSeats, entry.seats)}</span>
                </span>
                <button
                  type="button"
                  class="ui-remove"
                  title={entry.onlineSeats ? "Retirer et annuler sa réservation en ligne" : "Retirer"}
                  onclick={() => removeCustomerFromList(i)}
                  aria-label={entry.onlineSeats ? "Retirer et annuler sa réservation en ligne" : "Retirer"}
                >
                  ×
                </button>
              </li>
            {/each}
          </ul>
          {#if modalCustomers.some((e) => e.onlineSeats)}
            <small class="field-hint">Retirer un inscrit du site annule sa réservation en ligne (elle peut être rétablie depuis Piloter).</small>
          {/if}
        {/if}

        <div class="add-customer-row">
          <CustomerAutocomplete
            bind:value={selectedCustomerId}
            {customers}
            isCustomerAlreadyAdded={isCustomerInModal}
            placeholder="Rechercher un client…"
          />
          <button
            type="button"
            class="ui-btn ui-btn--secondary ui-btn--sm"
            disabled={!selectedCustomerId}
            onclick={addCustomerToTasting}
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
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
  .actions {
    flex-wrap: wrap;
  }

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

  .field-hint {
    color: var(--ink-2);
    font-size: 0.8rem;
  }

  .origin {
    display: block;
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

  .tasting-wines-block .section-title {
    display: block;
    margin-bottom: 0.75rem;
  }

  .tasting-wines-block .add-wine-row {
    margin-bottom: 0.25rem;
  }

  .tasting-customers-block .section-title {
    display: block;
    margin-bottom: 0.75rem;
  }

  .customer-list {
    list-style: none;
    margin: 0 0 1rem;
    padding: 0;
    border: 1px solid var(--border-soft);
    border-radius: 6px;
    overflow: hidden;
  }

  .customer-list-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.6rem 0.75rem;
    border-bottom: 1px solid var(--border-soft);
    background: #fafbfc;
    font-size: 0.9rem;
  }

  .customer-list-item:last-child {
    border-bottom: none;
  }

  .add-customer-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 0.25rem;
  }

  .add-customer-row :global(.customer-autocomplete) {
    flex: 1;
    min-width: 220px;
  }

  .empty-text {
    color: var(--ink-2);
    margin: 0 0 1rem;
    font-size: 0.9rem;
  }

  .wine-order-list {
    list-style: none;
    margin: 0 0 1rem;
    padding: 0;
    border: 1px solid var(--border-soft);
    border-radius: 6px;
    overflow: hidden;
  }

  .wine-order-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0.75rem;
    border-bottom: 1px solid var(--border-soft);
    background: #fafbfc;
  }

  .wine-order-item:last-child {
    border-bottom: none;
  }

  .wine-order-num {
    flex: 0 0 1.5rem;
    font-weight: 700;
    color: var(--ink-2);
    text-align: center;
  }

  .wine-order-label {
    flex: 1;
    font-size: 0.9rem;
  }

  .wine-order-actions {
    display: flex;
    gap: 0.25rem;
    align-items: center;
  }

  .btn-icon {
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--input-border);
    background: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    line-height: 1;
  }

  .btn-icon:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .add-wine-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .add-wine-row :global(.product-autocomplete) {
    flex: 1;
    min-width: 220px;
  }

</style>
