<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import type { Winery, WineType } from "$lib/types";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import {
    fetchStockDocVintages,
    sortedStockForDocuments,
    downloadPricesPdf,
    downloadNotesPdf,
    wineTypeLabelFr,
    type StockDocVintage,
  } from "$lib/manageDocumentPdfs";

  let rows: StockDocVintage[] = [];
  let loading = true;
  let error = "";
  let wineries: Winery[] = [];
  let wineTypes: WineType[] = [];

  let filterWineryId = "";
  let filterWineTypeId = "";
  let searchText = "";

  let selectedVintageIds: string[] = [];
  let docError = "";
  /** Case « tout » dans l’en-tête du tableau (état indeterminé géré en JS). */
  let headerSelectAllEl: HTMLInputElement | null = null;

  let showNotesModal = false;
  let notesModalRows: StockDocVintage[] = [];
  let notesTastingDate = "";
  let notesPdfGenerating = false;

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
    const { data, error: fetchError } = await fetchStockDocVintages(supabase);
    if (fetchError) {
      error = fetchError;
      rows = [];
    } else {
      rows = data;
    }
    loading = false;
  }

  $: filteredRows = rows.filter((r) => {
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
  });

  $: sortedVisible = sortedStockForDocuments(filteredRows);

  $: allVisibleSelected =
    sortedVisible.length > 0 &&
    sortedVisible.every((r) => selectedVintageIds.includes(r.id));
  $: someVisibleSelected = sortedVisible.some((r) =>
    selectedVintageIds.includes(r.id),
  );

  $: if (headerSelectAllEl) {
    headerSelectAllEl.indeterminate =
      someVisibleSelected && !allVisibleSelected;
  }

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
      await downloadPricesPdf(rows, new Set(selectedVintageIds));
    } catch (e) {
      docError = e instanceof Error ? e.message : "Erreur PDF";
    }
  }

  function todayIsoDate(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
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
    notesTastingDate = todayIsoDate();
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
      await downloadNotesPdf(notesModalRows, {
        tastingDate: notesTastingDate || todayIsoDate(),
      });
      closeNotesModal();
    } catch (e) {
      docError = e instanceof Error ? e.message : "Erreur PDF";
      notesPdfGenerating = false;
    }
  }

  function vintageLabel(r: StockDocVintage): string {
    if (r.year != null && r.year !== r.production_year) {
      return `${r.year} (${r.production_year})`;
    }
    return String(r.production_year);
  }
</script>

<svelte:head>
  <title>Documents - Gestion</title>
</svelte:head>

<ManagePageShell title="Documents">
  <svelte:fragment slot="actions">
    <button type="button" class="btn-secondary" on:click={loadStockRows} disabled={loading}>
      Actualiser
    </button>
  </svelte:fragment>

    {#if error}
      <div class="error-message">{error}</div>
    {/if}
    {#if docError}
      <div class="error-message">{docError}</div>
    {/if}

    {#if loading}
      <div class="loading">Chargement du stock…</div>
    {:else if rows.length === 0}
      <div class="empty-state">
        <p>Aucun vin en stock pour générer des documents.</p>
      </div>
    {:else}
      <div class="filters-container doc-top-panel">
        <h2 class="panel-title">Génération PDF</h2>
        <div class="actions-bar">
          <button type="button" class="btn-primary" on:click={handlePricesPdf}>
            Télécharger la liste de prix (PDF)
          </button>
          <button type="button" class="btn-primary" on:click={openNotesModal}>
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
              placeholder="Vignoble, nom, type, appellation…"
              bind:value={searchText}
            />
          </div>
          <div class="filter-group">
            <label for="doc-winery">Vignoble</label>
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
                <option value={t.id}>{t.name}</option>
              {/each}
            </select>
          </div>
          <div class="filter-group filter-actions">
            <button type="button" class="btn-secondary" on:click={clearFilters}>Réinitialiser</button>
          </div>
        </div>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th class="col-check" scope="col">
                <input
                  bind:this={headerSelectAllEl}
                  id="doc-select-all-visible"
                  type="checkbox"
                  checked={allVisibleSelected}
                  disabled={sortedVisible.length === 0}
                  on:change={onHeaderSelectAllChange}
                  aria-label="Tout sélectionner ou tout désélectionner dans la liste affichée"
                />
              </th>
              <th>Vignoble</th>
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
                <td>{wineTypeLabelFr(r.wineTypeName)}</td>
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

<Modal
  show={showNotesModal}
  title="Notes de dégustation"
  modalId="notes-modal-title"
  wide
  on:close={closeNotesModal}
>
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
              >{wineTypeLabelFr(row.wineTypeName)} · {vintageLabel(row)}</span
            >
          </div>
          <div class="notes-order-actions">
            <button
              type="button"
              class="btn-icon"
              title="Monter"
              disabled={i === 0}
              on:click={() => moveNoteWine(i, -1)}
              aria-label="Monter {row.wineName}"
            >
              ↑
            </button>
            <button
              type="button"
              class="btn-icon"
              title="Descendre"
              disabled={i === notesModalRows.length - 1}
              on:click={() => moveNoteWine(i, 1)}
              aria-label="Descendre {row.wineName}"
            >
              ↓
            </button>
          </div>
        </li>
      {/each}
    </ol>
  </div>

  <div class="modal-footer notes-modal-footer">
    <button
      type="button"
      class="btn-secondary"
      on:click={closeNotesModal}
      disabled={notesPdfGenerating}
    >
      Annuler
    </button>
    <button
      type="button"
      class="btn-primary"
      on:click={confirmNotesPdf}
      disabled={notesPdfGenerating || notesModalRows.length === 0}
    >
      {notesPdfGenerating ? "Génération…" : "Télécharger le PDF"}
    </button>
  </div>
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
    border-top: 1px solid #e9ecef;
    font-size: 0.9rem;
  }

  .selection-count {
    font-weight: 600;
    color: #333;
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
    accent-color: #007bff;
  }

  .num {
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .row-selected {
    background: rgba(255, 235, 120, 0.38);
  }

  tbody tr.row-selected:hover {
    background: rgba(255, 220, 90, 0.45);
  }

  .empty-filter {
    margin-top: 1rem;
    color: #666;
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

  .notes-modal-body {
    padding: 1.25rem 1.5rem 0.5rem;
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
    color: #333;
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
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 6px;
  }

  .notes-order-num {
    flex-shrink: 0;
    width: 1.75rem;
    height: 1.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #2c3e50;
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
    color: #333;
  }

  .notes-order-meta {
    font-size: 0.8rem;
    color: #666;
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
    border: 1px solid #ced4da;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    color: #333;
  }

  .btn-icon:hover:not(:disabled) {
    background: #e9ecef;
    border-color: #adb5bd;
  }

  .btn-icon:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .notes-modal-footer {
    padding: 1rem 1.5rem 1.25rem;
  }
</style>
