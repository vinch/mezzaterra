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
  import WineDot from "$lib/ui/WineDot.svelte";
  import StockBadge from "$lib/ui/StockBadge.svelte";
  import Spinner from "$lib/ui/Spinner.svelte";
  import DataTable from "$lib/ui/DataTable.svelte";
  import SortHeader, { compareValues, type SortState } from "$lib/ui/SortHeader.svelte";
  import KpiCard from "$lib/ui/KpiCard.svelte";
  import Tabs from "$lib/ui/Tabs.svelte";
  import { IconBox, IconChart, IconEuro, IconSignal } from "$lib/ui/icons";
  import { formatDate, formatEUR } from "$lib/format";

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
  let sort = $state<SortState<"margin" | "unitMarginPct" | "revenue" | "sold" | "stock">>({ key: "margin", dir: "desc" });

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

  let sorted = $derived([...stats].sort((a, b) => compareValues(a[sort.key], b[sort.key], sort.dir)));
  let totals = $derived(stats.reduce(
    (t, s) => ({ revenue: t.revenue + s.revenue, cost: t.cost + s.cost, sold: t.sold + s.sold }),
    { revenue: 0, cost: 0, sold: 0 },
  ));
  let rotation = $derived(stats
    .filter((s) => s.stock > 0)
    .map((s) => ({
      ...s,
      value: s.stock * Number(s.vintage.purchase_price || 0),
      /* Ventes mensuelles moyennes sur la période observée → mois de stock restants. */
      monthsLeft: s.sold > 0 && s.lastSale ? s.stock / Math.max(0.25, s.sold / 12) : null,
    }))
    .sort((a, b) => (b.idleDays ?? 9999) - (a.idleDays ?? 9999)));

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
              <th scope="col">Produit</th>
              <th scope="col" class="num">Achat</th>
              <th scope="col" class="num">Vente</th>
              <SortHeader column="unitMarginPct" label="Marge unit." num firstDir="desc" bind:sort />
              <SortHeader column="sold" label="Vendues" num firstDir="desc" bind:sort />
              <SortHeader column="revenue" label="CA" num firstDir="desc" bind:sort />
              <SortHeader column="margin" label="Marge réalisée" num firstDir="desc" bind:sort />
              <SortHeader column="stock" label="Stock" num firstDir="desc" bind:sort />
            </tr>
          </thead>
          <tbody>
            {#each sorted as s (s.vintage.id)}
              <tr>
                <td>
                  <span class="wine-cell"><WineDot type={s.vintage.wine?.wine_type} />
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
              <th scope="col">Produit</th>
              <th scope="col" class="num">Stock</th>
              <th scope="col" class="num">Valeur (achat)</th>
              <th scope="col">Dernière vente</th>
              <th scope="col" class="num">Mois de stock</th>
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
              <th scope="col">Dégustation</th>
              <th scope="col" class="num">Participants</th>
              <th scope="col" class="num">Bouteilles ouvertes</th>
              <th scope="col" class="num">Entrées</th>
              <th scope="col" class="num">Ventes de la soirée</th>
              <th scope="col" class="num">Acheteurs</th>
              <th scope="col" class="num">Relances 30 j</th>
              <th scope="col" class="num">Résultat estimé</th>
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
