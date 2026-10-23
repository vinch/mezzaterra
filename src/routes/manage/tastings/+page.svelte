<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import type { Customer, Tasting } from "$lib/types";
  import Modal from "$lib/ui/Modal.svelte";
  import Button from "$lib/ui/Button.svelte";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import ProductVintageAutocomplete from "$lib/components/manage/ProductVintageAutocomplete.svelte";
  import CustomerAutocomplete from "$lib/components/manage/CustomerAutocomplete.svelte";
  import { customerDisplayLabel, sortCustomersByLabel } from "$lib/customerDisplay";
  import { fetchCustomers, fetchPickerVintages } from "$lib/manageData";
  import { fetchTastingWithWines } from "$lib/publicData";
  import { todayIso } from "$lib/dates";
  import { formatDate } from "$lib/format";
  import { isDiscontinued, vintageLabel } from "$lib/wine";

  type TastingRow = Tasting & {
    tasting_wine_vintage: { order: number; wine_vintage_id: string }[];
    tasting_customer: { customer_id: string }[];
  };

  type ModalWineEntry = {
    wine_vintage_id: string;
    vintage: any;
  };

  type ModalCustomerEntry = {
    customer_id: string;
    customer: Customer;
  };

  let tastings: TastingRow[] = [];
  let customers: Customer[] = [];
  let wineVintages: any[] = [];
  let loading = true;
  let error = "";
  let showModal = false;
  let editingTasting: TastingRow | null = null;
  let modalWines: ModalWineEntry[] = [];
  let modalCustomers: ModalCustomerEntry[] = [];
  let selectedVintageId = "";
  let selectedCustomerId = "";
  let saving = false;
  let cardsBusyId = "";

  let formData = {
    name: "",
    date: "",
    location: "",
    notes: "",
    start_time: "",
    price: "",
    capacity: "",
    description: "",
    is_private: false,
  };

  onMount(async () => {
    [, wineVintages, customers] = await Promise.all([loadTastings(), fetchPickerVintages(), fetchCustomers()]);
    loading = false;
  });

  async function downloadCards(tasting: TastingRow) {
    cardsBusyId = tasting.id;
    error = "";
    try {
      const res = await fetchTastingWithWines(tasting.id);
      if (!res.tasting || res.wineVintages.length === 0) {
        error = "Ajoutez des vins à la dégustation pour générer les fiches.";
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
        tasting_customer ( customer_id )
      `,
      )
      .order("date", { ascending: false });

    if (fetchError) {
      error = fetchError.message;
      tastings = [];
    } else {
      tastings = (data || []) as TastingRow[];
    }
  }

  async function loadModalCustomers(tastingId: string) {
    const { data, error: fetchError } = await supabase
      .from("tasting_customer")
      .select(
        `
        customer_id,
        customer (
          id,
          first_name,
          last_name,
          company_name,
          email
        )
      `,
      )
      .eq("tasting_id", tastingId);

    if (fetchError) {
      error = fetchError.message;
      modalCustomers = [];
      return;
    }

    modalCustomers = (data || [])
      .filter((r) => r.customer)
      .map((r) => ({
        customer_id: r.customer_id,
        customer: r.customer as Customer,
      }))
      .sort((a, b) =>
        customerDisplayLabel(a.customer).localeCompare(
          customerDisplayLabel(b.customer),
          "fr",
          { sensitivity: "base" },
        ),
      );
  }

  async function loadModalWines(tastingId: string) {
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
          wine (
            name,
            winery (name),
            appelation (name, label (name))
          )
        )
      `,
      )
      .eq("tasting_id", tastingId)
      .order("order", { ascending: true });

    if (fetchError) {
      error = fetchError.message;
      modalWines = [];
      return;
    }

    modalWines = (data || [])
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
    selectedVintageId = "";
    selectedCustomerId = "";
  }

  function openCreateModal() {
    editingTasting = null;
    error = "";
    resetForm();
    showModal = true;
  }

  async function openEditModal(tasting: TastingRow) {
    error = "";
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
    await Promise.all([
      loadModalWines(tasting.id),
      loadModalCustomers(tasting.id),
    ]);
    showModal = true;
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
    modalCustomers = sortCustomersByLabel([
      ...modalCustomers.map((e) => e.customer),
      customer,
    ]).map((c) => ({
      customer_id: c.id,
      customer: c,
    }));
    selectedCustomerId = "";
    error = "";
  }

  function removeCustomerFromList(index: number) {
    modalCustomers = modalCustomers.filter((_, i) => i !== index);
  }

  function addWineToTasting() {
    if (!selectedVintageId) return;
    if (isVintageInModal(selectedVintageId)) {
      error = "Ce millésime est déjà dans la liste.";
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

  async function saveTastingCustomers(tastingId: string) {
    const { error: delErr } = await supabase
      .from("tasting_customer")
      .delete()
      .eq("tasting_id", tastingId);

    if (delErr) throw new Error(delErr.message);

    if (modalCustomers.length === 0) return;

    const rows = modalCustomers.map((entry) => ({
      tasting_id: tastingId,
      customer_id: entry.customer_id,
    }));

    const { error: insErr } = await supabase
      .from("tasting_customer")
      .insert(rows);

    if (insErr) throw new Error(insErr.message);
  }

  async function saveTastingWines(tastingId: string) {
    const { error: delErr } = await supabase
      .from("tasting_wine_vintage")
      .delete()
      .eq("tasting_id", tastingId);

    if (delErr) throw new Error(delErr.message);

    if (modalWines.length === 0) return;

    const rows = modalWines.map((entry, i) => ({
      tasting_id: tastingId,
      wine_vintage_id: entry.wine_vintage_id,
      order: i + 1,
    }));

    const { error: insErr } = await supabase
      .from("tasting_wine_vintage")
      .insert(rows);

    if (insErr) throw new Error(insErr.message);
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
      if (editingTasting) {
        const { error: updateError } = await supabase
          .from("tasting")
          .update(payload)
          .eq("id", editingTasting.id);

        if (updateError) throw new Error(updateError.message);
        await Promise.all([saveTastingWines(editingTasting.id), saveTastingCustomers(editingTasting.id)]);
      } else {
        const { data: created, error: insertError } = await supabase
          .from("tasting")
          .insert(payload)
          .select("id")
          .single();

        if (insertError || !created) {
          throw new Error(insertError?.message || "Création impossible");
        }
        await Promise.all([saveTastingWines(created.id), saveTastingCustomers(created.id)]);
      }

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

    const [{ error: customersErr }, { error: linkErr }] = await Promise.all([
      supabase.from("tasting_customer").delete().eq("tasting_id", tasting.id),
      supabase.from("tasting_wine_vintage").delete().eq("tasting_id", tasting.id),
    ]);

    if (customersErr || linkErr) {
      error = (customersErr || linkErr)!.message;
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

  function customerCount(t: TastingRow): number {
    return t.tasting_customer?.length ?? 0;
  }
</script>

<svelte:head>
  <title>Dégustations - Gestion</title>
</svelte:head>

<ManagePageShell title="Dégustations">
  <svelte:fragment slot="actions">
    <button type="button" class="btn-primary" on:click={openCreateModal}>
      + Nouvelle dégustation
    </button>
  </svelte:fragment>

  {#if error && !showModal}
    <div class="error-message">{error}</div>
  {/if}

  {#if loading}
    <div class="loading">Chargement…</div>
  {:else if tastings.length === 0}
    <div class="empty-state">
      <p>Aucune dégustation enregistrée.</p>
      <button type="button" class="btn-primary" on:click={openCreateModal}>
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
            <th class="num">Vins</th>
            <th class="num">Clients</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each tastings as tasting (tasting.id)}
            <tr>
              <td>{formatDate(tasting.date)}</td>
              <td>
                <strong>{tasting.name || "—"}</strong>
                {#if tasting.is_private}<span class="private-badge" title="Non listée sur le site public">Privée</span>{/if}
              </td>
              <td>{tasting.location || "—"}</td>
              <td class="num">{wineCount(tasting)}</td>
              <td class="num">{customerCount(tasting)}</td>
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
                    on:click={() => downloadCards(tasting)}
                  >
                    {cardsBusyId === tasting.id ? "…" : "Fiches de table"}
                  </button>
                  <button
                    type="button"
                    class="ui-btn ui-btn--secondary ui-btn--sm"
                    on:click={() => openEditModal(tasting)}
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    class="ui-btn ui-btn--danger ui-btn--sm"
                    on:click={() => deleteTasting(tasting)}
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

<Modal open={showModal} title={editingTasting ? "Modifier la dégustation" : "Nouvelle dégustation"} on:close={closeModal}>
  <form id="tasting-form" on:submit|preventDefault={handleSubmit}>
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
        <label for="tasting-capacity">Places (inscriptions en ligne)</label>
        <input type="number" min="0" id="tasting-capacity" bind:value={formData.capacity} placeholder="Illimité" />
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
        <span class="section-title" id="tasting-wines-label">Vins (ordre de passage)</span>

      {#if modalWines.length === 0}
        <p class="empty-text">Aucun vin ajouté.</p>
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
                  on:click={() => moveWine(i, -1)}
                  aria-label="Monter"
                >
                  ↑
                </button>
                <button
                  type="button"
                  class="btn-icon"
                  title="Descendre"
                  disabled={i === modalWines.length - 1}
                  on:click={() => moveWine(i, 1)}
                  aria-label="Descendre"
                >
                  ↓
                </button>
                <button
                  type="button"
                  class="ui-remove"
                  title="Retirer"
                  on:click={() => removeWineFromList(i)}
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
        {#key modalWines.map((e) => e.wine_vintage_id).join("|")}
          <ProductVintageAutocomplete
            bind:value={selectedVintageId}
            wineVintages={wineVintages.filter((v) => !isDiscontinued(v))}
            includeTastingOption={false}
            disableWhenNoStock={false}
            isVintageAlreadyAdded={isVintageInModal}
            formatLabel={vintageLabel}
            getAvailableStock={() => 0}
            placeholder="Rechercher un millésime…"
          />
        {/key}
        <button
          type="button"
          class="ui-btn ui-btn--secondary ui-btn--sm"
          disabled={!selectedVintageId}
          on:click={addWineToTasting}
        >
          Ajouter
        </button>
      </div>
      </div>

      <div class="form-group full-width tasting-customers-block">
        <span class="section-title" id="tasting-customers-label">Clients</span>

        {#if modalCustomers.length === 0}
          <p class="empty-text">Aucun client associé.</p>
        {:else}
          <ul class="customer-list">
            {#each modalCustomers as entry, i (entry.customer_id)}
              <li class="customer-list-item">
                <span>{customerDisplayLabel(entry.customer)}</span>
                <button
                  type="button"
                  class="ui-remove"
                  title="Retirer"
                  on:click={() => removeCustomerFromList(i)}
                  aria-label="Retirer"
                >
                  ×
                </button>
              </li>
            {/each}
          </ul>
        {/if}

        <div class="add-customer-row">
          {#key modalCustomers.map((e) => e.customer_id).join("|")}
            <CustomerAutocomplete
              bind:value={selectedCustomerId}
              {customers}
              isCustomerAlreadyAdded={isCustomerInModal}
              placeholder="Rechercher un client…"
            />
          {/key}
          <button
            type="button"
            class="ui-btn ui-btn--secondary ui-btn--sm"
            disabled={!selectedCustomerId}
            on:click={addCustomerToTasting}
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
  </form>
  <svelte:fragment slot="footer">
    <Button variant="ghost" on:click={closeModal} disabled={saving}>Annuler</Button>
    <Button variant="primary" type="submit" form="tasting-form" disabled={saving}>{saving ? "Enregistrement…" : editingTasting ? "Mettre à jour" : "Créer"}</Button>
  </svelte:fragment>
</Modal>

<style>
  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

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
