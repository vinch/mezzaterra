<script lang="ts">
  import { onMount } from "svelte";
  import { errorMessage } from "$lib/async";
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
  import { vintageLabel } from "$lib/wine";
  import StyleDot from "$lib/ui/StyleDot.svelte";
  import StockBadge from "$lib/ui/StockBadge.svelte";
  import Spinner from "$lib/ui/Spinner.svelte";
  import DataTable from "$lib/ui/DataTable.svelte";
  import SortHeader from "$lib/ui/SortHeader.svelte";
  import { sortedBy, type SortState } from "$lib/sort";
  import KpiCard from "$lib/ui/KpiCard.svelte";
  import Tabs from "$lib/ui/Tabs.svelte";
  import { IconBox, IconChart, IconEuro, IconSignal } from "$lib/ui/icons";
  import { formatDate, formatEUR, toNumberOrNull } from "$lib/format";

  let loading = $state(true);
  let error = $state("");
  let stats = $state.raw<VintageStats[]>([]);
  let roi = $state<TastingRoi[]>([]);
  type Tab = "margins" | "rotation" | "tastings";
  const TABS: { key: Tab; label: string }[] = [
    { key: "margins", label: "Marges par produit" },
    { key: "rotation", label: "Rotation du stock" },
    { key: "tastings", label: "Rentabilité des dégustations" },
  ];
  let tab = $state<Tab>("margins");
  const MARGIN_SORT = {
    product: (s: VintageStats) => vintageLabel(s.vintage),
    purchase: (s: VintageStats) => toNumberOrNull(s.vintage.purchase_price),
    price: (s: VintageStats) => toNumberOrNull(s.vintage.price),
    unitMarginPct: (s: VintageStats) => s.unitMarginPct,
    sold: (s: VintageStats) => s.sold,
    revenue: (s: VintageStats) => s.revenue,
    margin: (s: VintageStats) => s.margin,
    stock: (s: VintageStats) => s.stock,
  };
  type RotationRow = VintageStats & { value: number; monthsLeft: number | null };
  const ROTATION_SORT = {
    product: (r: RotationRow) => vintageLabel(r.vintage),
    stock: (r: RotationRow) => r.stock,
    value: (r: RotationRow) => r.value,
    /* Jamais vendu : le plus « endormi ». */
    idle: (r: RotationRow) => r.idleDays ?? Number.MAX_SAFE_INTEGER,
    monthsLeft: (r: RotationRow) => r.monthsLeft,
  };
  const ROI_SORT = {
    date: (r: TastingRoi) => r.tasting.date,
    participants: (r: TastingRoi) => r.participants,
    poured: (r: TastingRoi) => r.winesPoured,
    fees: (r: TastingRoi) => r.fees,
    evening: (r: TastingRoi) => r.eveningRevenue,
    buyers: (r: TastingRoi) => r.buyers,
    later: (r: TastingRoi) => r.laterRevenue,
    result: (r: TastingRoi) => r.result,
  };
  let marginSort = $state<SortState<keyof typeof MARGIN_SORT>>({ key: "margin", dir: "desc" });
  /* Du plus « endormi » au plus actif. */
  let rotationSort = $state<SortState<keyof typeof ROTATION_SORT>>({ key: "idle", dir: "desc" });
  let roiSort = $state<SortState<keyof typeof ROI_SORT>>({ key: "date", dir: "desc" });

  onMount(async () => {
    try {
      const ds = await loadDataset();
      const lines = revenueLines(ds);
      stats = vintageStats(ds, lines);
      roi = await tastingRoi(ds, lines);
    } catch (e) {
      error = errorMessage(e);
    } finally {
      loading = false;
    }
  });

  let sorted = $derived(sortedBy(stats, marginSort, MARGIN_SORT));
  let totals = $derived(stats.reduce(
    (t, s) => ({ revenue: t.revenue + s.revenue, cost: t.cost + s.cost, sold: t.sold + s.sold }),
    { revenue: 0, cost: 0, sold: 0 },
  ));
  let rotation = $derived(sortedBy(stats
    .filter((s) => s.stock > 0)
    .map((s): RotationRow => ({
      ...s,
      value: s.stock * Number(s.vintage.purchase_price || 0),
      /* Ventes mensuelles moyennes sur la période observée → mois de stock restants. */
      monthsLeft: s.sold > 0 && s.lastSale ? s.stock / Math.max(0.25, s.sold / 12) : null,
    })), rotationSort, ROTATION_SORT));
  let sortedRoi = $derived(sortedBy(roi, roiSort, ROI_SORT));

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

{#snippet analysisTabs()}
  <Tabs label="Analyse affichée" items={TABS} bind:value={tab} />
{/snippet}

<!-- Pas de barre d'onglets pendant le chargement ni en cas d'erreur. -->
<ManagePageShell title="Analyses" tabs={loading || error ? undefined : analysisTabs}>

  {#if loading}
    <Spinner />
  {:else if error}
    <div class="error-message" role="alert">{error}</div>
  {:else}
    <div class="kpis">
      <KpiCard label="CA produits encaissé" value={formatEUR(totals.revenue, true)} icon={IconEuro} />
      <KpiCard label="Marge brute" value={formatEUR(totals.revenue - totals.cost, true)} icon={IconChart} />
      <KpiCard label="Taux de marge" value={pct(totals.revenue ? ((totals.revenue - totals.cost) / totals.revenue) * 100 : null)} icon={IconSignal} />
      <KpiCard label="Bouteilles vendues" value={String(totals.sold)} icon={IconBox} />
    </div>

    {#if tab === "margins"}
      <p class="explain">
        Marge = CA encaissé (remises et ristournes incluses) − prix d’achat × bouteilles vendues.
        La marge unitaire est calculée au prix catalogue.
      </p>
      <DataTable caption="Marges par produit">
          <thead>
            <tr>
              <SortHeader column="product" label="Produit" bind:sort={marginSort} />
              <SortHeader column="purchase" label="Achat" num firstDir="asc" bind:sort={marginSort} />
              <SortHeader column="price" label="Vente" num firstDir="asc" bind:sort={marginSort} />
              <SortHeader column="unitMarginPct" label="Marge unit." num bind:sort={marginSort} />
              <SortHeader column="sold" label="Vendues" num bind:sort={marginSort} />
              <SortHeader column="revenue" label="CA" num bind:sort={marginSort} />
              <SortHeader column="margin" label="Marge réalisée" num bind:sort={marginSort} />
              <SortHeader column="stock" label="Stock" num bind:sort={marginSort} />
            </tr>
          </thead>
          <tbody>
            {#each sorted as s (s.vintage.id)}
              <tr>
                <td>
                  <span class="wine-cell"><StyleDot type={s.vintage.wine?.wine_type} />
                  <a class="row-link" href="/manage/products/{s.vintage.wine_id}/stock/{s.vintage.id}">{vintageLabel(s.vintage)}</a></span>
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
      </DataTable>
    {:else if tab === "rotation"}
      <p class="explain">
        Produits en stock, du plus « endormi » au plus actif. Les mois de stock sont estimés à partir du rythme
        de vente observé.
      </p>
      <DataTable caption="Rotation du stock">
          <thead>
            <tr>
              <SortHeader column="product" label="Produit" bind:sort={rotationSort} />
              <SortHeader column="stock" label="Stock" num bind:sort={rotationSort} />
              <SortHeader column="value" label="Valeur (achat)" num bind:sort={rotationSort} />
              <SortHeader column="idle" label="Dernière vente" firstDir="desc" bind:sort={rotationSort} />
              <SortHeader column="monthsLeft" label="Mois de stock" num bind:sort={rotationSort} />
              <th scope="col">Statut</th>
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
                    <StockBadge kind="dormant" />
                  {:else if r.idleDays >= 90}
                    <span class="tag mid">Lent</span>
                  {:else}
                    <span class="tag good">Actif</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
      </DataTable>
    {:else}
      <p class="explain">
        Pour chaque soirée : entrées + marge sur les ventes rattachées à la dégustation − coût des
        bouteilles ouvertes ({BOTTLES_PER_TASTED_WINE} par vin servi). Les « relances » sont les achats des
        participants dans les 30 jours suivants, hors soirée.
      </p>
      <DataTable caption="Rentabilité des dégustations">
          <thead>
            <tr>
              <SortHeader column="date" label="Dégustation" firstDir="desc" bind:sort={roiSort} />
              <SortHeader column="participants" label="Participants" num bind:sort={roiSort} />
              <SortHeader column="poured" label="Bouteilles ouvertes" num bind:sort={roiSort} />
              <SortHeader column="fees" label="Entrées" num bind:sort={roiSort} />
              <SortHeader column="evening" label="Ventes de la soirée" num bind:sort={roiSort} />
              <SortHeader column="buyers" label="Acheteurs" num bind:sort={roiSort} />
              <SortHeader column="later" label="Relances 30 j" num bind:sort={roiSort} />
              <SortHeader column="result" label="Résultat estimé" num bind:sort={roiSort} />
            </tr>
          </thead>
          <tbody>
            {#each sortedRoi as r (r.tasting.id)}
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
      </DataTable>
    {/if}
  {/if}
</ManagePageShell>

<style>
  .wine-cell {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .kpis {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }

  .explain {
    margin: 0 0 1rem;
    font-size: 0.88rem;
    color: var(--ink-2);
    max-width: 60rem;
  }

  td a:not(.row-link) {
    color: inherit;
    text-decoration: none;
  }

  td a:not(.row-link):hover {
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

  .tag {
    display: inline-block;
    padding: 0.1rem 0.45rem;
    border-radius: var(--r-pill);
    font-size: 0.75rem;
    font-weight: 600;
  }

  /* Tons d'alerte, pas ceux des statuts de vente : bon, à surveiller, faible. */
  .tag.good {
    background: var(--mist);
    color: var(--teal-700);
  }

  .tag.mid {
    background: var(--warn-bg);
    color: var(--warn);
  }

  .tag.bad {
    background: var(--danger-bg);
    color: var(--danger);
  }

  .pos {
    color: var(--mz-success);
  }

  .neg {
    color: var(--mz-danger);
  }

  @media (max-width: 900px) {
    .kpis {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
