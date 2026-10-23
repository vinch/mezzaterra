<script lang="ts">
  import { onMount } from "svelte";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import {
    BOTTLES_PER_TASTED_WINE,
    loadDataset,
    revenueLines,
    tastingRoi,
    vintageStats,
    type TastingRoi,
    type VintageStats,
  } from "$lib/analytics";
  import { vintageLabel, wineStyle } from "$lib/wine";
  import { formatDate, formatEUR } from "$lib/format";

  let loading = true;
  let error = "";
  let stats: VintageStats[] = [];
  let roi: TastingRoi[] = [];
  let tab: "margins" | "rotation" | "tastings" = "margins";
  let sortKey: "margin" | "unitMarginPct" | "revenue" | "sold" | "stock" = "margin";

  onMount(async () => {
    try {
      const ds = await loadDataset();
      const lines = revenueLines(ds);
      stats = vintageStats(ds, lines);
      roi = await tastingRoi(ds, lines);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  });

  $: sorted = [...stats].sort((a, b) => ((b[sortKey] as number) ?? -Infinity) - ((a[sortKey] as number) ?? -Infinity));
  $: totals = stats.reduce(
    (t, s) => ({ revenue: t.revenue + s.revenue, cost: t.cost + s.cost, sold: t.sold + s.sold }),
    { revenue: 0, cost: 0, sold: 0 },
  );
  $: rotation = stats
    .filter((s) => s.stock > 0)
    .map((s) => ({
      ...s,
      value: s.stock * Number(s.vintage.purchase_price || 0),
      /* Ventes mensuelles moyennes sur la période observée → mois de stock restants. */
      monthsLeft: s.sold > 0 && s.lastSale ? s.stock / Math.max(0.25, s.sold / 12) : null,
    }))
    .sort((a, b) => (b.idleDays ?? 9999) - (a.idleDays ?? 9999));

  function pct(n: number | null): string {
    return n == null ? "—" : `${Math.round(n)} %`;
  }

  function marginClass(p: number | null): string {
    if (p == null) return "";
    if (p < 25) return "bad";
    if (p < 40) return "mid";
    return "good";
  }
</script>

<svelte:head>
  <title>Analyses - Gestion</title>
</svelte:head>

<ManagePageShell title="Analyses">
  {#if loading}
    <div class="loading">Calcul en cours…</div>
  {:else if error}
    <div class="error-message">{error}</div>
  {:else}
    <div class="kpis">
      <div class="kpi"><span class="kpi-value">{formatEUR(totals.revenue, true)}</span><span class="kpi-label">CA vins encaissé</span></div>
      <div class="kpi"><span class="kpi-value">{formatEUR(totals.revenue - totals.cost, true)}</span><span class="kpi-label">Marge brute</span></div>
      <div class="kpi"><span class="kpi-value">{pct(totals.revenue ? ((totals.revenue - totals.cost) / totals.revenue) * 100 : null)}</span><span class="kpi-label">Taux de marge</span></div>
      <div class="kpi"><span class="kpi-value">{totals.sold}</span><span class="kpi-label">Bouteilles vendues</span></div>
    </div>

    <div class="tabs" role="tablist">
      <button type="button" role="tab" class:active={tab === "margins"} aria-selected={tab === "margins"} on:click={() => (tab = "margins")}>Marges par vin</button>
      <button type="button" role="tab" class:active={tab === "rotation"} aria-selected={tab === "rotation"} on:click={() => (tab = "rotation")}>Rotation du stock</button>
      <button type="button" role="tab" class:active={tab === "tastings"} aria-selected={tab === "tastings"} on:click={() => (tab = "tastings")}>Rentabilité des dégustations</button>
    </div>

    {#if tab === "margins"}
      <p class="explain">
        Marge = CA encaissé (remises et ristournes incluses) − prix d’achat × bouteilles vendues.
        La marge unitaire est calculée au prix catalogue.
      </p>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Vin</th>
              <th class="num">Achat</th>
              <th class="num">Vente</th>
              <th class="num sortable" class:on={sortKey === "unitMarginPct"} on:click={() => (sortKey = "unitMarginPct")}>Marge unit.</th>
              <th class="num sortable" class:on={sortKey === "sold"} on:click={() => (sortKey = "sold")}>Vendues</th>
              <th class="num sortable" class:on={sortKey === "revenue"} on:click={() => (sortKey = "revenue")}>CA</th>
              <th class="num sortable" class:on={sortKey === "margin"} on:click={() => (sortKey = "margin")}>Marge réalisée</th>
              <th class="num sortable" class:on={sortKey === "stock"} on:click={() => (sortKey = "stock")}>Stock</th>
            </tr>
          </thead>
          <tbody>
            {#each sorted as s (s.vintage.id)}
              <tr>
                <td>
                  <span class="mz-dot" style="background: {wineStyle(s.vintage.wine?.wine_type).color}"></span>
                  <a href="/manage/wines/{s.vintage.wine_id}/stock/{s.vintage.id}">{vintageLabel(s.vintage)}</a>
                </td>
                <td class="num">{formatEUR(s.vintage.purchase_price)}</td>
                <td class="num">{formatEUR(s.vintage.price)}</td>
                <td class="num">
                  {#if s.unitMargin != null}
                    {formatEUR(s.unitMargin)} <span class="tag {marginClass(s.unitMarginPct)}">{pct(s.unitMarginPct)}</span>
                  {:else}—{/if}
                </td>
                <td class="num">{s.sold || "—"}</td>
                <td class="num">{s.revenue ? formatEUR(s.revenue, true) : "—"}</td>
                <td class="num"><strong>{s.revenue ? formatEUR(s.margin, true) : "—"}</strong></td>
                <td class="num">{s.stock}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else if tab === "rotation"}
      <p class="explain">
        Vins en stock, du plus « endormi » au plus actif. Les mois de stock sont estimés à partir du rythme
        de vente observé.
      </p>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Vin</th>
              <th class="num">Stock</th>
              <th class="num">Valeur (achat)</th>
              <th>Dernière vente</th>
              <th class="num">Mois de stock</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {#each rotation as r (r.vintage.id)}
              <tr>
                <td>{vintageLabel(r.vintage)}</td>
                <td class="num">{r.stock}</td>
                <td class="num">{formatEUR(r.value, true)}</td>
                <td>{r.lastSale ? `${formatDate(r.lastSale)} (${r.idleDays} j)` : "Jamais vendu"}</td>
                <td class="num">{r.monthsLeft != null ? Math.round(r.monthsLeft) : "—"}</td>
                <td>
                  {#if r.idleDays == null || r.idleDays >= 180}
                    <span class="tag bad">Dormant</span>
                  {:else if r.idleDays >= 90}
                    <span class="tag mid">Lent</span>
                  {:else}
                    <span class="tag good">Actif</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <p class="explain">
        Pour chaque soirée : entrées + marge sur les ventes rattachées à la dégustation − coût des
        bouteilles ouvertes ({BOTTLES_PER_TASTED_WINE} par vin servi). Les « relances » sont les achats des
        participants dans les 30 jours suivants, hors soirée.
      </p>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Dégustation</th>
              <th class="num">Participants</th>
              <th class="num">Bouteilles ouvertes</th>
              <th class="num">Entrées</th>
              <th class="num">Ventes de la soirée</th>
              <th class="num">Acheteurs</th>
              <th class="num">Relances 30 j</th>
              <th class="num">Résultat estimé</th>
            </tr>
          </thead>
          <tbody>
            {#each roi as r (r.tasting.id)}
              <tr>
                <td>
                  <strong>{r.tasting.name || "Dégustation"}</strong>
                  <small class="muted">{formatDate(r.tasting.date)}{r.tasting.location ? ` · ${r.tasting.location}` : ""}</small>
                </td>
                <td class="num">{r.participants}</td>
                <td class="num">{r.winesPoured} <small class="muted">({formatEUR(r.pouredCost, true)})</small></td>
                <td class="num">{formatEUR(r.fees, true)}</td>
                <td class="num">
                  <a href="/manage/sales?degustation={r.tasting.id}">{formatEUR(r.eveningRevenue, true)}</a>
                  <small class="muted">{r.eveningBottles} bt.</small>
                </td>
                <td class="num">
                  {r.buyers}{#if r.participants} <small class="muted">({Math.round((r.buyers / r.participants) * 100)} %)</small>{/if}
                </td>
                <td class="num">{r.laterRevenue ? formatEUR(r.laterRevenue, true) : "—"}</td>
                <td class="num"><strong class={r.result >= 0 ? "pos" : "neg"}>{formatEUR(r.result, true)}</strong></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</ManagePageShell>

<style>
  .kpis {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .kpi {
    background: white;
    border-radius: 12px;
    padding: 1.1rem 1.25rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    display: flex;
    flex-direction: column;
  }

  .kpi-value {
    font-size: 1.7rem;
    font-weight: 700;
    color: #1d2a2c;
  }

  .kpi-label {
    font-size: 0.88rem;
    color: var(--ink-2);
  }

  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 1rem;
  }

  .tabs button {
    padding: 0.5rem 1rem;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: white;
    font: inherit;
    font-size: 0.9rem;
    cursor: pointer;
  }

  .tabs button.active {
    background: var(--teal-600);
    border-color: var(--teal-600);
    color: white;
  }

  .explain {
    margin: 0 0 1rem;
    font-size: 0.88rem;
    color: var(--ink-2);
    max-width: 60rem;
  }

  .num {
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .sortable {
    cursor: pointer;
    user-select: none;
  }

  .sortable.on::after {
    content: " ↓";
  }

  td a {
    color: inherit;
    text-decoration: none;
  }

  td a:hover {
    color: var(--teal-600);
    text-decoration: underline;
  }

  td small {
    display: block;
  }

  td.num small {
    display: inline;
  }

  .muted {
    color: var(--ink-2);
  }

  .mz-dot {
    display: inline-block;
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    margin-right: 0.4rem;
  }

  .tag {
    display: inline-block;
    padding: 0.1rem 0.45rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .tag.good {
    background: #e3f2e8;
    color: #2f7a4b;
  }

  .tag.mid {
    background: #fff3d6;
    color: #8a5a00;
  }

  .tag.bad {
    background: #fbe3e1;
    color: #a3352f;
  }

  .pos {
    color: #2f7a4b;
  }

  .neg {
    color: #a3352f;
  }

  @media (max-width: 900px) {
    .kpis {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
