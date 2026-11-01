<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import type { Producer, ProductType } from "$lib/types";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import Modal from "$lib/ui/Modal.svelte";
  import Button from "$lib/ui/Button.svelte";
  import MoveButtons from "$lib/ui/MoveButtons.svelte";
  import Spinner from "$lib/ui/Spinner.svelte";
  import SortHeader from "$lib/ui/SortHeader.svelte";
  import {
    fetchStockDocLots,
    sortedStockForDocuments,
    stockLotLabel as lotLabel,
    stockSortValues,
    type StockDocLot,
    type StockSortKey,
  } from "$lib/stockDocuments";
  import { sortedBy, type SortState } from "$lib/sort";
  import { todayIso } from "$lib/dates";
  import { productTypeLabel, robeRanks } from "$lib/products";
  import { fetchProductTypes } from "$lib/manageData";
  import { errorMessage } from "$lib/async";
  import { formatEUR } from "$lib/format";

  let rows = $state.raw<StockDocLot[]>([]);
  let loading = $state(true);
  let error = $state("");
  let producers = $state<Producer[]>([]);
  let productTypes = $state<ProductType[]>([]);

  let filterProducerId = $state("");
  let filterProductTypeId = $state("");
  let searchText = $state("");

  let selectedLotIds = $state<string[]>([]);
  let docError = $state("");

  let showNotesModal = $state(false);
  let notesModalRows = $state<StockDocLot[]>([]);
  let notesTastingDate = $state("");
  let notesPdfGenerating = $state(false);

  onMount(async () => {
    await Promise.all([loadStockRows(), loadProducers(), loadProductTypes()]);
  });

  async function loadProducers() {
    const { data } = await supabase
      .from("producer")
      .select("id, name")
      .order("name");
    if (data) producers = data as Producer[];
  }

  async function loadProductTypes() {
    productTypes = await fetchProductTypes();
  }

  async function loadStockRows() {
    loading = true;
    error = "";
    const { data, error: fetchError } = await fetchStockDocLots();
    if (fetchError) {
      error = fetchError;
      rows = [];
    } else {
      rows = sortedStockForDocuments(data);
    }
    loading = false;
  }

  let filteredRows = $derived(rows.filter((r) => {
    if (filterProductTypeId && r.product_type_id !== filterProductTypeId) {
      return false;
    }
    if (filterProducerId && r.producer_id !== filterProducerId) {
      return false;
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      const blob = `${r.producerName} ${r.productName} ${r.productTypeName} ${r.appellationLine}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  }));

  /* Par défaut, par producteur ; à égalité, l'ordre du chargement (nom, puis année ↓). */
  let sort = $state<SortState<StockSortKey>>({ key: "producer", dir: "asc" });
  let sortValues = $derived(stockSortValues(robeRanks(productTypes)));
  let sortedVisible = $derived(sortedBy(filteredRows, sort, sortValues));

  let allVisibleSelected =
    $derived(sortedVisible.length > 0 &&
    sortedVisible.every((r) => selectedLotIds.includes(r.id)));
  let someVisibleSelected = $derived(sortedVisible.some((r) =>
    selectedLotIds.includes(r.id),
  ));

  function clearFilters() {
    filterProducerId = "";
    filterProductTypeId = "";
    searchText = "";
  }

  function isSelected(id: string): boolean {
    return selectedLotIds.includes(id);
  }

  function onHeaderSelectAllChange(ev: Event) {
    const checked = (ev.currentTarget as HTMLInputElement).checked;
    const visibleIds = sortedVisible.map((r) => r.id);
    if (checked) {
      selectedLotIds = [...new Set([...selectedLotIds, ...visibleIds])];
    } else {
      const vis = new Set(visibleIds);
      selectedLotIds = selectedLotIds.filter((id) => !vis.has(id));
    }
  }

  async function handlePricesPdf() {
    docError = "";
    if (rows.length === 0) {
      docError = "Aucun produit en stock.";
      return;
    }
    try {
      /* jsPDF n'est chargé qu'au moment de générer un document. */
      const { downloadPricesPdf } = await import("$lib/pdf/stockDocumentsPdf");
      await downloadPricesPdf(rows, new Set(selectedLotIds));
    } catch (e) {
      docError = errorMessage(e);
    }
  }

  function openNotesModal() {
    docError = "";
    /* Dans l'ordre habituel (producteur, nom, année ↓), quel que soit le tri du tableau. */
    const picked = filteredRows.filter((r) =>
      selectedLotIds.includes(r.id),
    );
    if (picked.length === 0) {
      docError = "Cochez au moins un produit pour la feuille de notes.";
      return;
    }
    notesModalRows = [...picked];
    notesTastingDate = todayIso();
    showNotesModal = true;
  }

  function closeNotesModal() {
    showNotesModal = false;
    notesPdfGenerating = false;
  }

  async function confirmNotesPdf() {
    docError = "";
    if (notesModalRows.length === 0) {
      docError = "Ajoutez au moins un produit à la feuille de notes.";
      return;
    }
    notesPdfGenerating = true;
    try {
      const { downloadNotesPdf } = await import("$lib/pdf/stockDocumentsPdf");
      await downloadNotesPdf(notesModalRows, {
        tastingDate: notesTastingDate || todayIso(),
      });
      closeNotesModal();
    } catch (e) {
      docError = errorMessage(e);
      notesPdfGenerating = false;
    }
  }

</script>

<svelte:head>
  <title>Documents - Gestion</title>
</svelte:head>

<ManagePageShell title="Documents">
  {#snippet actions()}
      <button type="button" class="btn-secondary" onclick={loadStockRows} disabled={loading}>
        Actualiser
      </button>
  {/snippet}

    {#if error}
      <div class="error-message">{error}</div>
    {/if}
    {#if docError}
      <div class="error-message">{docError}</div>
    {/if}

    {#if loading}
      <Spinner />
    {:else if rows.length === 0}
      <div class="empty-state">
        <p>Aucun produit en stock pour générer des documents.</p>
      </div>
    {:else}
      <div class="filters-container doc-top-panel">
        <h2 class="panel-title">Génération PDF</h2>
        <div class="actions-bar">
          <button type="button" class="btn-primary" onclick={handlePricesPdf}>
            Télécharger la liste de prix (PDF)
          </button>
          <button type="button" class="btn-primary" onclick={openNotesModal}>
            Préparer les notes de dégustation (PDF)
          </button>
        </div>
        <div class="selection-toolbar">
          <span class="selection-count">{selectedLotIds.length} lot(s) coché(s)</span>
        </div>
      </div>

      <div class="filters-container">
        <div class="filters doc-filters">
          <div class="filter-group filter-group--search">
            <label for="doc-search">Recherche</label>
            <input
              type="text"
              id="doc-search"
              placeholder="Domaine, nom, type, appellation…"
              bind:value={searchText}
            />
          </div>
          <div class="filter-group">
            <label for="doc-producer">Domaine</label>
            <select id="doc-producer" bind:value={filterProducerId}>
              <option value="">Tous</option>
              {#each producers as w}
                <option value={w.id}>{w.name}</option>
              {/each}
            </select>
          </div>
          <div class="filter-group">
            <label for="doc-type">Type</label>
            <select id="doc-type" bind:value={filterProductTypeId}>
              <option value="">Tous</option>
              {#each productTypes as t}
                <option value={t.id}>{t.name}</option>
              {/each}
            </select>
          </div>
          <div class="filter-group filter-actions">
            <button type="button" class="btn-secondary" onclick={clearFilters}>Réinitialiser</button>
          </div>
        </div>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th class="col-check" scope="col">
                <input
                  indeterminate={someVisibleSelected && !allVisibleSelected}
                  id="doc-select-all-visible"
                  type="checkbox"
                  checked={allVisibleSelected}
                  disabled={sortedVisible.length === 0}
                  onchange={onHeaderSelectAllChange}
                  aria-label="Tout sélectionner ou tout désélectionner dans la liste affichée"
                />
              </th>
              <SortHeader column="producer" label="Domaine" bind:sort />
              <SortHeader column="name" label="Nom" bind:sort />
              <SortHeader column="type" label="Type" bind:sort />
              <SortHeader column="year" label="Mill." firstDir="desc" bind:sort />
              <SortHeader column="price" label="Prix" num firstDir="asc" bind:sort />
              <SortHeader column="stock" label="Stock" num bind:sort />
            </tr>
          </thead>
          <tbody>
            {#each sortedVisible as r (r.id)}
              <tr class:row-selected={isSelected(r.id)}>
                <td class="col-check">
                  <input
                    type="checkbox"
                    bind:group={selectedLotIds}
                    value={r.id}
                    aria-label="Sélectionner {r.producerName} {r.productName} {lotLabel(r)}"
                  />
                </td>
                <td>{r.producerName}</td>
                <td><strong>{r.productName}</strong></td>
                <td>{productTypeLabel({ name: r.productTypeName, kind: r.kind })}</td>
                <td>{lotLabel(r)}</td>
                <td class="num">
                  {formatEUR(r.price)}
                </td>
                <td class="num">{r.quantity_on_hand}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      {#if filteredRows.length === 0}
        <p class="empty-filter">Aucune ligne ne correspond aux filtres.</p>
      {/if}
    {/if}
</ManagePageShell>

<Modal open={showNotesModal} title="Notes de dégustation" maxWidth={820} onclose={closeNotesModal}>
  <div class="notes-modal-body">
    <p class="notes-modal-hint">
      Choisissez la date de la dégustation et l’ordre de passage des produits (du premier au
      dernier servi).
    </p>

    <div class="notes-date-row">
      <label for="notes-tasting-date">Date de la dégustation</label>
      <input
        type="date"
        id="notes-tasting-date"
        bind:value={notesTastingDate}
        required
      />
    </div>

    <ol class="notes-order-list">
      {#each notesModalRows as row, i (row.id)}
        <li class="notes-order-item">
          <span class="notes-order-num" aria-hidden="true">{i + 1}</span>
          <div class="notes-order-info">
            <strong>{row.producerName}</strong>
            <span class="notes-order-product">{row.productName}</span>
            <span class="notes-order-meta"
              >{productTypeLabel({ name: row.productTypeName, kind: row.kind })} · {lotLabel(row)}</span
            >
          </div>
          <div class="notes-order-actions">
            <MoveButtons bind:list={notesModalRows} index={i} label={row.productName} />
          </div>
        </li>
      {/each}
    </ol>
  </div>

  {#snippet footer()}
      <Button variant="ghost" onclick={closeNotesModal} disabled={notesPdfGenerating}>Annuler</Button>
      <Button variant="primary" onclick={confirmNotesPdf} disabled={notesPdfGenerating || notesModalRows.length === 0}>
        {notesPdfGenerating ? "Génération…" : "Télécharger le PDF"}
      </Button>
  {/snippet}
</Modal>

<style>
  .doc-top-panel .panel-title {
    margin-bottom: 0.75rem;
  }

  .actions-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
  }

  .selection-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-soft);
    font-size: 0.9rem;
  }

  .selection-count {
    font-weight: 600;
    color: var(--ink);
  }

  .col-check {
    width: 2.75rem;
    text-align: center;
    vertical-align: middle;
  }

  thead .col-check {
    padding-top: 0.85rem;
    padding-bottom: 0.85rem;
  }

  .col-check input {
    width: 1.05rem;
    height: 1.05rem;
    cursor: pointer;
    accent-color: var(--teal-600);
  }

  .row-selected {
    background: rgba(255, 235, 120, 0.38);
  }

  tbody tr.row-selected:hover {
    background: rgba(255, 220, 90, 0.45);
  }

  .empty-filter {
    margin-top: 1rem;
    color: var(--ink-2);
    padding: 0 0.25rem;
  }

  .filters.doc-filters {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 1.25rem;
    grid-template-columns: unset;
  }

  .doc-filters .filter-group {
    flex: 1 1 10rem;
    min-width: 0;
  }

  .doc-filters .filter-group--search {
    flex: 1.75 1 12rem;
  }

  .doc-filters .filter-actions {
    flex: 0 0 auto;
  }

  .notes-modal-hint {
    margin: 0 0 1.25rem;
    color: var(--ink-2);
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .notes-date-row {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-bottom: 1.25rem;
    max-width: 16rem;
  }

  .notes-date-row label {
    font-weight: 500;
    font-size: 0.9rem;
    color: var(--ink);
  }

  .notes-order-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: min(50vh, 420px);
    overflow-y: auto;
  }

  .notes-order-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 0.75rem;
    background: var(--table-head);
    border: 1px solid var(--border-soft);
    border-radius: var(--r-sm);
  }

  .notes-order-num {
    flex-shrink: 0;
    width: 1.75rem;
    height: 1.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--ink);
    color: white;
    font-weight: 700;
    font-size: 0.85rem;
    border-radius: 50%;
  }

  .notes-order-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .notes-order-product {
    color: var(--ink);
  }

  .notes-order-meta {
    font-size: 0.8rem;
    color: var(--ink-2);
  }

  .notes-order-actions {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex-shrink: 0;
  }
</style>
