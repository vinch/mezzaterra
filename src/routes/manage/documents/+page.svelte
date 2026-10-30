<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import type { Winery, WineType } from "$lib/types";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import Modal from "$lib/ui/Modal.svelte";
  import Button from "$lib/ui/Button.svelte";
  import Spinner from "$lib/ui/Spinner.svelte";
  import {
    fetchStockDocVintages,
    sortedStockForDocuments,
    stockVintageLabel as vintageLabel,
    type StockDocVintage,
  } from "$lib/stockDocuments";
  import { todayIso } from "$lib/dates";
  import { wineTypeLabel } from "$lib/wine";

  let rows = $state.raw<StockDocVintage[]>([]);
  let loading = $state(true);
  let error = $state("");
  let wineries = $state<Winery[]>([]);
  let wineTypes = $state<WineType[]>([]);

  let filterWineryId = $state("");
  let filterWineTypeId = $state("");
  let searchText = $state("");

  let selectedVintageIds = $state<string[]>([]);
  let docError = $state("");

  let showNotesModal = $state(false);
  let notesModalRows = $state<StockDocVintage[]>([]);
  let notesTastingDate = $state("");
  let notesPdfGenerating = $state(false);

  onMount(async () => {
    await Promise.all([loadStockRows(), loadWineries(), loadWineTypes()]);
  });

  async function loadWineries() {
    const { data } = await supabase
      .from("winery")
      .select("id, name")
      .order("name");
    if (data) wineries = data as Winery[];
  }

  async function loadWineTypes() {
    const { data } = await supabase.from("wine_type").select("*").order("name");
    if (data) wineTypes = data;
  }

  async function loadStockRows() {
    loading = true;
    error = "";
    const { data, error: fetchError } = await fetchStockDocVintages();
    if (fetchError) {
      error = fetchError;
      rows = [];
    } else {
      rows = data;
    }
    loading = false;
  }

  let filteredRows = $derived(rows.filter((r) => {
    if (filterWineTypeId && r.wine_type_id !== filterWineTypeId) {
      return false;
    }
    if (filterWineryId && r.winery_id !== filterWineryId) {
      return false;
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      const blob = `${r.wineryName} ${r.wineName} ${r.wineTypeName} ${r.appellationLine}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  }));

  let sortedVisible = $derived(sortedStockForDocuments(filteredRows));

  let allVisibleSelected =
    $derived(sortedVisible.length > 0 &&
    sortedVisible.every((r) => selectedVintageIds.includes(r.id)));
  let someVisibleSelected = $derived(sortedVisible.some((r) =>
    selectedVintageIds.includes(r.id),
  ));

  function clearFilters() {
    filterWineryId = "";
    filterWineTypeId = "";
    searchText = "";
  }

  function isSelected(id: string): boolean {
    return selectedVintageIds.includes(id);
  }

  function onHeaderSelectAllChange(ev: Event) {
    const checked = (ev.currentTarget as HTMLInputElement).checked;
    const visibleIds = sortedVisible.map((r) => r.id);
    if (checked) {
      selectedVintageIds = [...new Set([...selectedVintageIds, ...visibleIds])];
    } else {
      const vis = new Set(visibleIds);
      selectedVintageIds = selectedVintageIds.filter((id) => !vis.has(id));
    }
  }

  async function handlePricesPdf() {
    docError = "";
    if (rows.length === 0) {
      docError = "Aucun millésime en stock.";
      return;
    }
    try {
      /* jsPDF n'est chargé qu'au moment de générer un document. */
      const { downloadPricesPdf } = await import("$lib/pdf/stockDocumentsPdf");
      await downloadPricesPdf(rows, new Set(selectedVintageIds));
    } catch (e) {
      docError = e instanceof Error ? e.message : "Erreur PDF";
    }
  }

  function openNotesModal() {
    docError = "";
    const picked = sortedVisible.filter((r) =>
      selectedVintageIds.includes(r.id),
    );
    if (picked.length === 0) {
      docError = "Cochez au moins un vin pour la feuille de notes.";
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

  function moveNoteWine(index: number, delta: number) {
    const j = index + delta;
    if (j < 0 || j >= notesModalRows.length) return;
    const next = [...notesModalRows];
    [next[index], next[j]] = [next[j], next[index]];
    notesModalRows = next;
  }

  async function confirmNotesPdf() {
    docError = "";
    if (notesModalRows.length === 0) {
      docError = "Ajoutez au moins un vin à la feuille de notes.";
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
      docError = e instanceof Error ? e.message : "Erreur PDF";
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
        <p>Aucun vin en stock pour générer des documents.</p>
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
          <span class="selection-count">{selectedVintageIds.length} millésime(s) coché(s)</span>
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
            <label for="doc-winery">Domaine</label>
            <select id="doc-winery" bind:value={filterWineryId}>
              <option value="">Tous</option>
              {#each wineries as w}
                <option value={w.id}>{w.name}</option>
              {/each}
            </select>
          </div>
          <div class="filter-group">
            <label for="doc-type">Type</label>
            <select id="doc-type" bind:value={filterWineTypeId}>
              <option value="">Tous</option>
              {#each wineTypes as t}
                <option value={t.id}>{wineTypeLabel(t)}</option>
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
              <th>Domaine</th>
              <th>Nom</th>
              <th>Type</th>
              <th>Mill.</th>
              <th class="num">Prix</th>
              <th class="num">Stock</th>
            </tr>
          </thead>
          <tbody>
            {#each sortedVisible as r (r.id)}
              <tr class:row-selected={isSelected(r.id)}>
                <td class="col-check">
                  <input
                    type="checkbox"
                    bind:group={selectedVintageIds}
                    value={r.id}
                    aria-label="Sélectionner {r.wineryName} {r.wineName} {vintageLabel(r)}"
                  />
                </td>
                <td>{r.wineryName}</td>
                <td><strong>{r.wineName}</strong></td>
                <td>{wineTypeLabel({ name: r.wineTypeName, kind: r.kind })}</td>
                <td>{vintageLabel(r)}</td>
                <td class="num">
                  {r.price != null ? `${r.price.toFixed(2)}` : "—"}
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
      Choisissez la date de la dégustation et l’ordre de passage des vins (du premier au
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
            <strong>{row.wineryName}</strong>
            <span class="notes-order-wine">{row.wineName}</span>
            <span class="notes-order-meta"
              >{wineTypeLabel({ name: row.wineTypeName, kind: row.kind })} · {vintageLabel(row)}</span
            >
          </div>
          <div class="notes-order-actions">
            <button
              type="button"
              class="btn-icon"
              title="Monter"
              disabled={i === 0}
              onclick={() => moveNoteWine(i, -1)}
              aria-label="Monter {row.wineName}"
            >
              ↑
            </button>
            <button
              type="button"
              class="btn-icon"
              title="Descendre"
              disabled={i === notesModalRows.length - 1}
              onclick={() => moveNoteWine(i, 1)}
              aria-label="Descendre {row.wineName}"
            >
              ↓
            </button>
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
    color: #555;
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
    border-radius: 6px;
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

  .notes-order-wine {
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

  .btn-icon {
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: 1px solid var(--input-border);
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    color: var(--ink);
  }

  .btn-icon:hover:not(:disabled) {
    background: var(--border-soft);
    border-color: #adb5bd;
  }

  .btn-icon:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
</style>
