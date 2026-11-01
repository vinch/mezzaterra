<script lang="ts">
  import { onMount } from "svelte";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import Button from "$lib/ui/Button.svelte";
  import DataTable from "$lib/ui/DataTable.svelte";
  import SortHeader from "$lib/ui/SortHeader.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import { IconBox } from "$lib/ui/icons";
  import Spinner from "$lib/ui/Spinner.svelte";
  import {
    fetchStockDocLots,
    sortedStockForDocuments,
    stockLotLabel,
    stockSortValues,
    type StockDocLot,
    type StockSortKey,
  } from "$lib/stockDocuments";
  import { sortedBy, type SortState } from "$lib/sort";

  let loading = $state(true);
  let error = $state("");
  let stockInHandList = $state<StockDocLot[]>([]);
  /* Par défaut, par producteur ; à égalité, l'ordre du chargement. */
  let sort = $state<SortState<StockSortKey>>({ key: "producer", dir: "asc" });
  const sortValues = stockSortValues();
  let sortedStock = $derived(sortedBy(stockInHandList, sort, sortValues));

  onMount(() => loadStockInHand());

  function bottleLabel(n: number): string {
    return n === 1 ? "1 bouteille" : `${n} bouteilles`;
  }

  /** Même lecture que la page Documents : lots en stock, triés producteur → nom → année ↓. */
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
          <SortHeader column="producer" label="Domaine" bind:sort />
          <SortHeader column="name" label="Nom" bind:sort />
          <SortHeader column="year" label="Millésime ou lot" firstDir="desc" bind:sort />
          <SortHeader column="stock" label="En stock" num bind:sort />
          <th scope="col" class="col-actions"><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {#each sortedStock as row (row.id)}
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
