<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import Button from "$lib/ui/Button.svelte";
  import DataTable from "$lib/ui/DataTable.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import { IconBox } from "$lib/ui/icons";
  import {
    fetchStockDocVintages,
    sortedStockForDocuments,
    stockVintageLabel,
    type StockDocVintage,
  } from "$lib/stockDocuments";

  let loading = true;
  let error = "";
  let stockInHandList: StockDocVintage[] = [];

  onMount(() => loadStockInHand());

  function bottleLabel(n: number): string {
    return n === 1 ? "1 bouteille" : `${n} bouteilles`;
  }

  /** Même lecture que la page Documents : millésimes en stock, triés vignoble → nom → millésime ↓. */
  async function loadStockInHand() {
    loading = true;
    error = "";
    const res = await fetchStockDocVintages(supabase);
    error = res.error ?? "";
    stockInHandList = sortedStockForDocuments(res.data);
    loading = false;
  }
</script>

<svelte:head>
  <title>Stock - Gestion</title>
</svelte:head>

<ManagePageShell title="Stock">
  <svelte:fragment slot="actions">
    <Button on:click={loadStockInHand} disabled={loading}>Actualiser</Button>
  </svelte:fragment>

  {#if loading}
    <div class="loading">Chargement…</div>
  {:else if error}
    <div class="error-message" role="alert">{error}</div>
  {:else if stockInHandList.length === 0}
    <EmptyState icon={IconBox} title="Aucun vin avec du stock disponible" />
  {:else}
    <DataTable caption="Vins en stock">
      <thead>
        <tr>
          <th scope="col">Vignoble</th>
          <th scope="col">Nom</th>
          <th scope="col">Millésime</th>
          <th scope="col" class="num">En stock</th>
          <th scope="col" class="col-actions"><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {#each stockInHandList as row}
          <tr>
            <td>{row.wineryName}</td>
            <td><strong>{row.wineName}</strong></td>
            <td>{stockVintageLabel(row)}</td>
            <td class="num">{bottleLabel(row.quantity_on_hand)}</td>
            <td class="col-actions">
              <Button size="sm" href="/manage/wines/{row.wine_id}/stock/{row.id}">Détail</Button>
            </td>
          </tr>
        {/each}
      </tbody>
    </DataTable>
  {/if}
</ManagePageShell>
