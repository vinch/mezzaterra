<script lang="ts">
  import { onMount } from "svelte";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import {
    fetchStockDocVintages,
    sortedStockForDocuments,
    stockVintageLabel,
    type StockDocVintage,
  } from "$lib/stockDocuments";

  let loading = $state(true);
  let error = $state("");
  let stockInHandList = $state<StockDocVintage[]>([]);

  onMount(() => loadStockInHand());

  function bottleLabel(n: number): string {
    return n === 1 ? "1 bouteille" : `${n} bouteilles`;
  }

  /** Même lecture que la page Documents : millésimes en stock, triés vignoble → nom → millésime ↓. */
  async function loadStockInHand() {
    loading = true;
    error = "";
    const res = await fetchStockDocVintages();
    error = res.error ?? "";
    stockInHandList = sortedStockForDocuments(res.data);
    loading = false;
  }
</script>

<svelte:head>
  <title>Stock - Gestion</title>
</svelte:head>

<ManagePageShell title="Stock">
  {#snippet actions()}
      <button
        type="button"
        class="btn-secondary"
        onclick={loadStockInHand}
        disabled={loading}
      >
        Actualiser
      </button>
  {/snippet}

  {#if error}
    <div class="error-message">{error}</div>
  {/if}

  {#if loading}
    <p class="stock-loading">Chargement…</p>
  {:else if stockInHandList.length === 0}
    <p class="empty-text">Aucun vin avec du stock disponible.</p>
  {:else}
    <div class="stock-table-wrap">
      <table class="stock-table">
        <thead>
          <tr>
            <th>Vignoble</th>
            <th>Nom</th>
            <th>Millésime</th>
            <th>En stock</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each stockInHandList as row}
            <tr>
              <td>{row.wineryName}</td>
              <td><strong>{row.wineName}</strong></td>
              <td>{stockVintageLabel(row)}</td>
              <td class="stock-qty">
                {bottleLabel(row.quantity_on_hand)}
              </td>
              <td>
                <a
                  href="/manage/wines/{row.wine_id}/stock/{row.id}"
                  class="ui-btn ui-btn--secondary ui-btn--sm"
                >
                  Détail
                </a>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</ManagePageShell>

<style>
  .stock-loading {
    margin: 0;
    padding: 0.5rem 0;
    color: var(--ink-2);
  }

  .empty-text {
    color: var(--ink-2);
    margin: 0;
  }

  .stock-table-wrap {
    margin-top: 0;
    max-height: none;
    overflow: visible;
    border: 1px solid var(--border-soft);
    border-radius: 6px;
    background: white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  }

  .stock-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }

  .stock-table th,
  .stock-table td {
    padding: 0.65rem 0.75rem;
    border-bottom: 1px solid var(--border-soft);
    text-align: left;
    vertical-align: middle;
  }

  .stock-table thead th {
    background: var(--table-head);
    font-weight: 600;
  }

  .stock-table .stock-qty {
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

</style>
