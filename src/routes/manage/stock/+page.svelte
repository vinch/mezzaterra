<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";

  let loading = true;
  let error = "";
  let stockInHandList: {
    quantity_on_hand: number;
    wine_vintage: {
      id: string;
      production_year: number;
      year: number | null;
      wine: {
        id: string;
        name: string | null;
        winery: { name: string } | null;
        appelation: {
          name: string | null;
          label: { name: string | null } | null;
        } | null;
        wine_type: { name: string } | null;
      } | null;
    };
  }[] = [];

  onMount(() => loadStockInHand());

  function bottleLabel(n: number): string {
    return n === 1 ? "1 bouteille" : `${n} bouteilles`;
  }

  function vintageDisplayLabel(v: {
    production_year: number;
    year: number | null;
  }): string {
    if (v.year != null && v.year !== v.production_year) {
      return `${v.year} (${v.production_year})`;
    }
    return String(v.production_year);
  }

  async function loadStockInHand() {
    loading = true;
    error = "";

    const { data: invRows, error: invErr } = await supabase
      .from("inventory")
      .select("wine_vintage_id, quantity_on_hand")
      .gt("quantity_on_hand", 0);

    if (invErr) {
      error = invErr.message;
      loading = false;
      return;
    }

    const rows = (invRows || []).filter(
      (r): r is { wine_vintage_id: string; quantity_on_hand: number } =>
        r.wine_vintage_id != null && (r.quantity_on_hand ?? 0) > 0,
    );

    if (rows.length === 0) {
      stockInHandList = [];
      loading = false;
      return;
    }

    const ids = [...new Set(rows.map((r) => r.wine_vintage_id))];
    const { data: vintages, error: vErr } = await supabase
      .from("wine_vintage")
      .select(
        `
        id,
        production_year,
        year,
        wine (
          id,
          name,
          winery (name),
          appelation (name, label (name)),
          wine_type (name)
        )
      `,
      )
      .in("id", ids);

    if (vErr) {
      error = vErr.message;
      loading = false;
      return;
    }

    const vintageMap = new Map((vintages || []).map((v) => [v.id, v]));

    const merged: typeof stockInHandList = [];
    for (const r of rows) {
      const v = vintageMap.get(r.wine_vintage_id);
      if (!v?.wine) continue;
      merged.push({
        quantity_on_hand: r.quantity_on_hand,
        wine_vintage: {
          id: v.id,
          production_year: v.production_year,
          year: v.year ?? null,
          wine: v.wine,
        },
      });
    }

    stockInHandList = merged.sort((a, b) => {
      const wA = a.wine_vintage.wine;
      const wB = b.wine_vintage.wine;
      const wineryA = wA?.winery?.name?.toLowerCase() || "";
      const wineryB = wB?.winery?.name?.toLowerCase() || "";
      if (wineryA !== wineryB) return wineryA.localeCompare(wineryB);
      const nameA =
        wA?.name?.toLowerCase() || wA?.appelation?.name?.toLowerCase() || "";
      const nameB =
        wB?.name?.toLowerCase() || wB?.appelation?.name?.toLowerCase() || "";
      if (nameA !== nameB) return nameA.localeCompare(nameB);
      return b.wine_vintage.production_year - a.wine_vintage.production_year;
    });

    loading = false;
  }
</script>

<svelte:head>
  <title>Stock - Gestion</title>
</svelte:head>

<ManagePageShell title="Stock">
  <svelte:fragment slot="actions">
    <button
      type="button"
      class="btn-secondary"
      on:click={loadStockInHand}
      disabled={loading}
    >
      Actualiser
    </button>
  </svelte:fragment>

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
            {@const w = row.wine_vintage.wine}
            <tr>
              <td>{w?.winery?.name || "—"}</td>
              <td><strong>{w?.name || "—"}</strong></td>
              <td>{vintageDisplayLabel(row.wine_vintage)}</td>
              <td class="stock-qty">
                {bottleLabel(row.quantity_on_hand)}
              </td>
              <td>
                <a
                  href="/manage/wines/{w?.id}/stock/{row.wine_vintage.id}"
                  class="btn-stock-link"
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
    color: #666;
  }

  .empty-text {
    color: #666;
    margin: 0;
  }

  .stock-table-wrap {
    margin-top: 0;
    max-height: none;
    overflow: visible;
    border: 1px solid #e9ecef;
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
    border-bottom: 1px solid #e9ecef;
    text-align: left;
    vertical-align: middle;
  }

  .stock-table thead th {
    background: #f8f9fa;
    font-weight: 600;
  }

  .stock-table .stock-qty {
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .btn-stock-link {
    padding: 0.35rem 0.65rem;
    background: #28a745;
    color: white;
    border-radius: 4px;
    font-size: 0.8rem;
    text-decoration: none;
    display: inline-block;
  }

  .btn-stock-link:hover {
    background: #218838;
    color: white;
  }
</style>
