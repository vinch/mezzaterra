<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { getContext, onMount } from "svelte";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import ColumnChart from "$lib/components/manage/ColumnChart.svelte";
  import Button from "$lib/ui/Button.svelte";
  import Card from "$lib/ui/Card.svelte";
  import KpiCard from "$lib/ui/KpiCard.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import StockBadge from "$lib/ui/StockBadge.svelte";
  import WineDot from "$lib/ui/WineDot.svelte";
  import {
    IconBox,
    IconCalendar,
    IconChart,
    IconEuro,
    IconGlasses,
    IconInbox,
    IconLightbulb,
    IconPlus,
    IconUsers,
    IconWine,
  } from "$lib/ui/icons";
  import {
    REVENUE_STATUSES,
    loadDataset,
    monthlyRevenue,
    revenueLines,
    vintageStats,
    type VintageStats,
  } from "$lib/analytics";
  import { promptReorder } from "$lib/reorder";
  import { isDiscontinued, vintageShortLabel } from "$lib/wine";
  import { daysUntil, formatDateLong, todayIso } from "$lib/dates";
  import { formatDate, formatEUR } from "$lib/format";

  const { user: userStore } = getContext<any>("auth");

  let email = "";
  let error = "";
  let loading = false;
  let magicLinkSent = false;

  let statsLoading = true;
  let statsError = "";

  /** Seuil « stock bas » (aligné sur l'ancien indicateur). */
  const LOW_STOCK = 3;
  /** Jours sans vente au-delà desquels un vin en stock est « dormant ». */
  const DORMANT_DAYS = 90;

  let kpi = {
    revenueAll: 0,
    revenueMonth: 0,
    pendingSales: 0,
    wineMargin: 0,
    marginPct: null as number | null,
    bottles: 0,
    stockValue: 0,
    lowCount: 0,
    wines: 0,
    vintages: 0,
    customers: 0,
    tastings: 0,
  };
  let months: { key: string; label: string; value: number }[] = [];
  let topWines: VintageStats[] = [];
  let outOfStock: VintageStats[] = [];
  let lowStock: VintageStats[] = [];
  let dormant: VintageStats[] = [];
  let nextTasting: any = null;
  let lastTasting: any = null;
  let nextTastingSeats: number | null = null;
  let newRequests = 0;
  let reorderBusy = "";
  let reorderMsg = "";

  const today = formatDateLong(todayIso());

  async function loadDashboardStats() {
    statsLoading = true;
    statsError = "";

    try {
      const monthStart = todayIso().slice(0, 8) + "01";
      const [ds, customersRes, winesRes, tastingsRes, nextRes, lastRes, requestsRes] = await Promise.all([
        loadDataset(),
        supabase.from("customer").select("id", { count: "exact", head: true }),
        supabase.from("wine").select("id", { count: "exact", head: true }),
        supabase.from("tasting").select("id", { count: "exact", head: true }),
        supabase
          .from("tasting")
          .select(
            "*, tasting_wine_vintage ( wine_vintage_id ), tasting_customer ( customer_id ), tasting_registration ( seats, status )",
          )
          .gte("date", todayIso())
          .order("date", { ascending: true })
          .limit(1),
        supabase.from("tasting").select("id, name, date, location").lt("date", todayIso()).order("date", { ascending: false }).limit(1),
        supabase.from("wish_request").select("id", { count: "exact", head: true }).eq("status", "new"),
      ]);

      const firstErr = customersRes.error || winesRes.error || tastingsRes.error;
      if (firstErr) throw new Error(firstErr.message);

      const inStock = [...ds.stock.values()].filter((q) => q > 0);
      const revenueSales = ds.sales.filter((s) => REVENUE_STATUSES.includes(s.status ?? ""));
      const lines = revenueLines(ds);
      const wineLines = lines.filter((l) => !l.isTastingFee);
      const wineRevenue = wineLines.reduce((s, l) => s + l.revenue, 0);
      const wineMargin = wineLines.reduce((s, l) => s + l.revenue - l.cost, 0);

      kpi = {
        revenueAll: revenueSales.reduce((sum, r) => sum + Number(r.total_price ?? 0), 0),
        revenueMonth: revenueSales.filter((r) => r.date >= monthStart).reduce((sum, r) => sum + Number(r.total_price ?? 0), 0),
        pendingSales: ds.sales.filter((s) => s.status === "pending").length,
        wineMargin,
        marginPct: wineRevenue > 0 ? Math.round((wineMargin / wineRevenue) * 100) : null,
        bottles: inStock.reduce((s, q) => s + q, 0),
        stockValue: ds.vintages.reduce((s, v) => s + Math.max(0, ds.stock.get(v.id) ?? 0) * Number(v.purchase_price || 0), 0),
        lowCount: inStock.filter((q) => q <= LOW_STOCK).length,
        wines: winesRes.count ?? 0,
        vintages: ds.vintages.length,
        customers: customersRes.count ?? 0,
        tastings: tastingsRes.count ?? 0,
      };

      const stats = vintageStats(ds, lines);
      months = monthlyRevenue(ds);
      topWines = stats.filter((s) => s.sold > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
      /* Réassort : jamais pour un millésime « plus jamais disponible ». */
      const reorderable = stats.filter((s) => !isDiscontinued(s.vintage));
      outOfStock = reorderable.filter((s) => s.stock <= 0 && s.sold > 0).sort((a, b) => b.sold - a.sold);
      lowStock = reorderable.filter((s) => s.stock > 0 && s.stock <= LOW_STOCK).sort((a, b) => a.stock - b.stock || b.sold - a.sold);
      dormant = stats
        .filter((s) => s.stock > 0 && (s.idleDays == null || s.idleDays >= DORMANT_DAYS))
        .sort((a, b) => b.stock * Number(b.vintage.purchase_price || 0) - a.stock * Number(a.vintage.purchase_price || 0));

      nextTasting = (nextRes.data || [])[0] ?? null;
      lastTasting = (lastRes.data || [])[0] ?? null;
      nextTastingSeats = nextTasting
        ? (nextTasting.tasting_registration || [])
            .filter((r: any) => r.status === "confirmed")
            .reduce((s: number, r: any) => s + r.seats, 0)
        : null;
      newRequests = requestsRes.count ?? 0;
    } catch (e) {
      statsError = e instanceof Error ? e.message : "Impossible de charger les statistiques";
    } finally {
      statsLoading = false;
    }
  }

  async function reorder(s: VintageStats) {
    reorderBusy = s.vintage.id;
    try {
      reorderMsg = (await promptReorder(vintageShortLabel(s.vintage), s.vintage)) ?? reorderMsg;
    } catch (e) {
      reorderMsg = e instanceof Error ? e.message : String(e);
    } finally {
      reorderBusy = "";
    }
  }

  onMount(() => {
    const unsub = userStore.subscribe((u: unknown) => {
      if (u) void loadDashboardStats();
    });
    return unsub;
  });

  async function handleMagicLink() {
    if (!email) {
      error = "Veuillez entrer votre email";
      return;
    }

    loading = true;
    error = "";

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/manage`,
      },
    });

    if (signInError) {
      error = signInError.message;
    } else {
      magicLinkSent = true;
    }

    loading = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      handleMagicLink();
    }
  }

  $: stockAlerts = [...outOfStock, ...lowStock];
  $: chartLabel = `Chiffre d'affaires encaissé par mois sur les 12 derniers mois. ${months
    .map((m) => `${m.label} : ${formatEUR(m.value)}`)
    .join(", ")}.`;
</script>

<svelte:head>
  <title>Gestion</title>
</svelte:head>

{#if !$userStore}
  <div class="login">
    <div class="login-card">
      <p class="login-brand"><span>Mezza</span><small>TERRA</small></p>
      <h1 class="t-card-title">Accès gestion</h1>

      {#if !magicLinkSent}
        <label class="t-label" for="login-email">Email</label>
        <input
          id="login-email"
          class="ui-control"
          type="email"
          autocomplete="email"
          bind:value={email}
          placeholder="vous@exemple.be"
          on:keydown={handleKeydown}
        />
        <Button variant="primary" block disabled={loading} on:click={handleMagicLink}>
          {loading ? "Envoi…" : "Envoyer le lien de connexion"}
        </Button>
        {#if error}
          <p class="t-danger login-error" role="alert">{error}</p>
        {/if}
      {:else}
        <p role="status">Un lien de connexion a été envoyé à <strong>{email}</strong>.</p>
        <p class="t-muted">Vérifiez votre boîte mail et cliquez sur le lien pour vous connecter.</p>
        <Button on:click={() => (magicLinkSent = false)}>Envoyer un nouveau lien</Button>
      {/if}
    </div>
  </div>
{:else}
  <ManagePageShell title="Tableau de bord" subtitle={today}>
    <svelte:fragment slot="actions">
      <Button href="/manage/tastings">Planifier une dégustation</Button>
      <Button variant="primary" href="/manage/sales?nouvelle=1"><IconPlus size={18} strokeWidth={1.75} /> Nouvelle vente</Button>
    </svelte:fragment>

    {#if statsError}
      <div class="error-message" role="alert">{statsError}</div>
    {/if}

    {#if statsLoading}
      <div class="loading">Chargement des indicateurs…</div>
    {:else}
      {#if kpi.pendingSales || outOfStock.length || lowStock.length || dormant.length || newRequests}
        <nav class="todo" aria-label="À traiter">
          <span class="todo-title"><IconInbox size={16} strokeWidth={1.75} aria-hidden="true" /> À traiter</span>
          {#if kpi.pendingSales}
            <a href="/manage/sales?statut=pending">{kpi.pendingSales} vente{kpi.pendingSales > 1 ? "s" : ""} en attente de paiement</a>
          {/if}
          {#if newRequests}
            <a href="/manage/requests">{newRequests} demande{newRequests > 1 ? "s" : ""} « J’en veux »</a>
          {/if}
          {#if outOfStock.length}
            <a class="danger" href="#stock-alerts">{outOfStock.length} millésime{outOfStock.length > 1 ? "s" : ""} en rupture</a>
          {/if}
          {#if lowStock.length}
            <a class="warn" href="#stock-alerts">{lowStock.length} millésime{lowStock.length > 1 ? "s" : ""} presque épuisé{lowStock.length > 1 ? "s" : ""}</a>
          {/if}
          {#if dormant.length}
            <a href="#stock-dormant">{dormant.length} vin{dormant.length > 1 ? "s" : ""} dormant{dormant.length > 1 ? "s" : ""}</a>
          {/if}
        </nav>
      {/if}

      <div class="kpis">
        <KpiCard label="Chiffre d’affaires" value={formatEUR(kpi.revenueAll)} icon={IconEuro} href="/manage/sales">
          {formatEUR(kpi.revenueMonth)} ce mois-ci · {kpi.pendingSales} vente{kpi.pendingSales > 1 ? "s" : ""} en attente
        </KpiCard>
        <KpiCard label="Marge brute sur les vins" value={formatEUR(kpi.wineMargin)} icon={IconChart} href="/manage/insights">
          {kpi.marginPct != null ? `${kpi.marginPct} % du CA vin` : "Aucune vente encaissée"}
        </KpiCard>
        <KpiCard label="Bouteilles en stock" value={String(kpi.bottles)} icon={IconBox} href="/manage/stock">
          {formatEUR(kpi.stockValue)} au prix d’achat
          {#if kpi.lowCount}<br /><span class="t-warn">{kpi.lowCount} millésime{kpi.lowCount > 1 ? "s" : ""} ≤ {LOW_STOCK} bt.</span>{/if}
        </KpiCard>
        <KpiCard label="Vins au catalogue" value={String(kpi.wines)} icon={IconWine} href="/manage/wines">
          {kpi.vintages} millésime{kpi.vintages > 1 ? "s" : ""}
        </KpiCard>
        <KpiCard label="Clients" value={String(kpi.customers)} icon={IconUsers} href="/manage/customers" />
        <KpiCard label="Dégustations" value={String(kpi.tastings)} icon={IconGlasses} href="/manage/tastings" />
      </div>

      <Card title="Chiffre d’affaires encaissé" id="ca-card">
        <span slot="actions" class="t-caption">12 derniers mois</span>
        <ColumnChart
          data={months}
          ariaLabel={chartLabel}
          format={(n) => formatEUR(n)}
          tickFormat={(n) => formatEUR(n).replace(/,00/, "")}
          highlightKey={months[months.length - 1]?.key ?? null}
        />
      </Card>

      <div class="grid-2">
        <Card title="Prochaine dégustation" id="next-tasting">
          {#if nextTasting}
            <p class="next-name">{nextTasting.name || "Dégustation"}</p>
            <p class="t-muted">{formatDateLong(nextTasting.date)}{nextTasting.location ? ` · ${nextTasting.location}` : ""}</p>
            <p class="countdown">{daysUntil(nextTasting.date) === 0 ? "C’est aujourd’hui !" : `Dans ${daysUntil(nextTasting.date)} jours`}</p>
            <ul class="next-facts">
              <li><strong>{nextTasting.tasting_wine_vintage?.length ?? 0}</strong> vins</li>
              <li><strong>{nextTasting.tasting_customer?.length ?? 0}</strong> participants</li>
              {#if nextTastingSeats != null}
                <li><strong>{nextTastingSeats}</strong>{nextTasting.capacity ? ` / ${nextTasting.capacity}` : ""} places réservées en ligne</li>
              {/if}
            </ul>
            <div class="row-actions">
              <Button size="sm" href="/manage/tasting-flyer">Visuel</Button>
              <Button size="sm" href="/manage/campaigns">Inviter</Button>
              <Button size="sm" variant="primary" href="/manage/tastings/{nextTasting.id}/live">Piloter</Button>
            </div>
          {:else}
            <EmptyState
              icon={IconCalendar}
              title="Aucune date planifiée"
              text={lastTasting ? `La dernière a eu lieu le ${formatDate(lastTasting.date)}${lastTasting.location ? ` (${lastTasting.location})` : ""}.` : ""}
            >
              <Button size="sm" href="/manage/tastings">Planifier une dégustation</Button>
            </EmptyState>
          {/if}
        </Card>

        <Card title="Top 5 des vins" id="top-wines">
          <span slot="actions" class="t-caption">par chiffre d’affaires</span>
          {#if topWines.length === 0}
            <EmptyState icon={IconWine} title="Pas encore de ventes encaissées" compact />
          {:else}
            <ol class="rank">
              {#each topWines as w}
                <li>
                  <span class="rank-name">
                    <WineDot type={w.vintage.wine?.wine_type} />
                    <span><strong>{vintageShortLabel(w.vintage)}</strong><span class="t-muted">&nbsp;· {w.vintage.wine?.winery?.name ?? ""}</span></span>
                  </span>
                  <span class="rank-value"><strong>{formatEUR(w.revenue)}</strong><span class="t-muted">{w.sold} bt.</span></span>
                  <span class="rank-bar" aria-hidden="true"><span style="width: {(w.revenue / topWines[0].revenue) * 100}%"></span></span>
                </li>
              {/each}
            </ol>
          {/if}
        </Card>

        <Card title="Stock bas et ruptures" id="stock-alerts">
          <svelte:fragment slot="actions"><Button size="sm" href="/manage/orders">Préparer une commande</Button></svelte:fragment>
          {#if reorderMsg}<p class="notice" role="status">{reorderMsg}</p>{/if}
          {#if stockAlerts.length === 0}
            <EmptyState icon={IconBox} title="Rien à signaler" text="Aucun millésime en rupture ni presque épuisé." compact />
          {:else}
            <ul class="list">
              {#each stockAlerts.slice(0, 8) as s}
                <li>
                  <WineDot type={s.vintage.wine?.wine_type} />
                  <span class="list-main">
                    <span><strong>{vintageShortLabel(s.vintage)}</strong><span class="t-muted">&nbsp;· {s.vintage.wine?.winery?.name ?? ""}</span></span>
                    <span class="t-caption">{s.sold ? `${s.sold} vendue${s.sold > 1 ? "s" : ""}` : "aucune vente"}</span>
                  </span>
                  {#if s.stock <= 0}
                    <StockBadge kind="out" />
                  {:else}
                    <StockBadge kind="low" label="{s.stock} bt." />
                  {/if}
                  <Button size="sm" variant="ghost" disabled={reorderBusy === s.vintage.id} on:click={() => reorder(s)}>
                    {reorderBusy === s.vintage.id ? "…" : "Réassort"}
                  </Button>
                </li>
              {/each}
            </ul>
          {/if}
        </Card>

        <Card title="Stock dormant" id="stock-dormant">
          <span slot="actions" class="t-caption">plus de {DORMANT_DAYS} j sans vente</span>
          {#if dormant.length === 0}
            <EmptyState icon={IconBox} title="Tout tourne bien" compact />
          {:else}
            <ul class="list">
              {#each dormant.slice(0, 6) as s}
                <li>
                  <WineDot type={s.vintage.wine?.wine_type} />
                  <span class="list-main">
                    <span><strong>{vintageShortLabel(s.vintage)}</strong><span class="t-muted">&nbsp;· {s.vintage.wine?.winery?.name ?? ""}</span></span>
                    <span class="t-caption">
                      {s.stock} bt. · {#if s.lastSale}dernière vente il y a <strong class="t-warn">{s.idleDays} j</strong>{:else}<strong class="t-warn">jamais vendu</strong>{/if}
                    </span>
                  </span>
                  <span class="value">{formatEUR(s.stock * Number(s.vintage.purchase_price || 0))}</span>
                </li>
              {/each}
            </ul>
            <div class="idea">
              <IconLightbulb size={18} strokeWidth={1.75} aria-hidden="true" />
              <p>Idée : mettez-les à l’honneur lors de la prochaine dégustation.</p>
              <Button size="sm" variant="ghost" href="/manage/tastings">Ouvrir les dégustations</Button>
            </div>
          {/if}
        </Card>
      </div>
    {/if}
  </ManagePageShell>
{/if}

<style>
  /* ——— Connexion ——— */
  .login {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 16px;
    background: var(--paper);
  }

  .login-card {
    width: min(100%, 380px);
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 32px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
  }

  .login-brand {
    display: flex;
    flex-direction: column;
    margin: 0 0 8px;
    color: var(--teal-600);
    font-family: var(--font-serif);
    font-weight: 600;
    line-height: 1;
  }

  .login-brand span {
    font-style: italic;
    font-size: 30px;
  }

  .login-brand small {
    font-size: 11px;
    letter-spacing: 0.32em;
    padding-left: 18px;
    margin-top: 4px;
  }

  .login-card p {
    margin: 0;
  }

  .login-error {
    font-size: 13px;
  }

  /* ——— Tableau de bord ——— */
  .todo {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 24px;
    padding: 12px 16px;
    margin-bottom: 16px;
    background: #f7efd7;
    border: 1px solid #ead9a8;
    border-radius: var(--r-md);
  }

  .todo-title {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
  }

  .todo a {
    color: var(--teal-700);
    font-weight: 500;
  }

  .todo a.danger {
    color: var(--danger);
  }

  .todo a.warn {
    color: var(--warn);
  }

  .kpis {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 16px;
  }

  .grid-2 {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    margin-top: 16px;
  }

  .next-name {
    margin: 0;
    font-family: var(--font-serif);
    font-weight: 600;
    font-size: 22px;
    color: var(--title);
  }

  .countdown {
    margin: 4px 0 0;
    font-weight: 600;
    color: var(--teal-700);
  }

  .next-facts {
    list-style: none;
    margin: 12px 0 16px;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 20px;
  }

  .row-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .rank {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .rank li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 6px 12px;
    align-items: center;
  }

  .rank-name {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .rank-value {
    display: flex;
    gap: 10px;
    align-items: baseline;
    white-space: nowrap;
  }

  .rank-bar {
    grid-column: 1 / -1;
    height: 4px;
    margin-left: 20px;
    border-radius: 999px;
    background: var(--border-soft);
    overflow: hidden;
  }

  .rank-bar span {
    display: block;
    height: 100%;
    background: var(--teal-600);
    border-radius: inherit;
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .list li {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 56px;
    padding: 8px 0;
    border-bottom: 1px solid var(--border-soft);
  }

  .list li:last-child {
    border-bottom: none;
  }

  .list-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    line-height: 18px;
  }

  .value {
    font-weight: 600;
    white-space: nowrap;
  }

  .notice {
    margin: 0 0 12px;
    padding: 8px 12px;
    border-radius: var(--r-sm);
    background: var(--mist);
    color: var(--teal-700);
    font-size: 13px;
  }

  .idea {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 16px;
    padding: 12px 14px;
    border-radius: var(--r-md);
    background: var(--mist);
    color: var(--teal-700);
  }

  .idea p {
    flex: 1;
    margin: 0;
    color: var(--ink);
  }

  @media (max-width: 1100px) {
    .grid-2 {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 767px) {
    .kpis {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .idea {
      flex-wrap: wrap;
    }
  }
</style>
