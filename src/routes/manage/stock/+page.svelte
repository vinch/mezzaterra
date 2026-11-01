<script lang="ts">
  import { onMount } from "svelte";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import Button from "$lib/ui/Button.svelte";
  import DataTable from "$lib/ui/DataTable.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import { IconBox } from "$lib/ui/icons";
  import Spinner from "$lib/ui/Spinner.svelte";
  import {
    fetchStockDocLots,
    sortedStockForDocuments,
    stockLotLabel,
    type StockDocLot,
  } from "$lib/stockDocuments";

  let loading = $state(true);
  let error = $state("");
  let stockInHandList = $state<StockDocLot[]>([]);

  onMount(() => loadStockInHand());

  function bottleLabel(n: number): string {
    return n === 1 ? "1 bouteille" : `${n} bouteilles`;
  }

  /** Même lecture que la page Documents : millésimes en stock, triés domaine → nom → millésime ↓. */
  async function loadStockInHand() {
    loading = true;
    error = "";
    const res = await fetchStockDocLots();
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
    <Button onclick={loadStockInHand} disabled={loading}>Actualiser</Button>
  {/snippet}

  {#if loading}
    <Spinner />
  {:else if error}
    <div class="error-message" role="alert">{error}</div>
  {:else if stockInHandList.length === 0}
    <EmptyState icon={IconBox} title="Aucun produit avec du stock disponible" />
  {:else}
    <DataTable caption="Produits en stock">
      <thead>
        <tr>
          <th scope="col">Domaine</th>
          <th scope="col">Nom</th>
          <th scope="col">Millésime ou lot</th>
          <th scope="col" class="num">En stock</th>
          <th scope="col" class="col-actions"><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {#each stockInHandList as row (row.id)}
          <tr>
            <td>{row.producerName}</td>
            <td><strong>{row.productName}</strong></td>
            <td>{stockLotLabel(row)}</td>
            <td class="num">{bottleLabel(row.quantity_on_hand)}</td>
            <td class="col-actions">
              <Button size="sm" href="/manage/products/{row.product_id}/stock/{row.id}">Détail</Button>
            </td>
          </tr>
        {/each}
      </tbody>
    </DataTable>
  {/if}
</ManagePageShell>
