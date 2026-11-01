<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { errorMessage } from "$lib/async";
  import { getContext, onMount } from "svelte";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import ColumnChart from "$lib/components/manage/ColumnChart.svelte";
  import Button from "$lib/ui/Button.svelte";
  import Card from "$lib/ui/Card.svelte";
  import KpiCard from "$lib/ui/KpiCard.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import StockBadge from "$lib/ui/StockBadge.svelte";
  import StyleDot from "$lib/ui/StyleDot.svelte";
  import Spinner from "$lib/ui/Spinner.svelte";
  import {
    IconBox,
    IconCalendar,
    IconChart,
    IconEuro,
    IconGlasses,
    IconInbox,
    IconLightbulb,
    IconPlus,
    IconProduct,
    IconReceipt,
    IconUsers,
  } from "$lib/ui/icons";
  import {
    REVENUE_STATUSES,
    loadDataset,
    monthlyRevenue,
    revenueLines,
    lotStats,
    type LotStats,
  } from "$lib/analytics";
  import { promptReorder } from "$lib/reorder";
  import { countNewRequests } from "$lib/wishes";
  import { fetchSeats, onlineSeats, type SeatInfo } from "$lib/publicData";
  import { isDiscontinued, lotShortLabel } from "$lib/products";
  import { daysAwayLabel, daysUntil, formatDateLong, todayIso } from "$lib/dates";
  import { formatDate, formatEUR } from "$lib/format";

  const { user: userStore } = getContext<any>("auth");

  let email = $state("");
  let error = $state("");
  let loading = $state(false);
  let magicLinkSent = $state(false);

  let statsLoading = $state(true);
  let statsError = $state("");

  /** Seuil « stock bas » (aligné sur l'ancien indicateur). */
  const LOW_STOCK = 3;
  /** Jours sans vente au-delà desquels un lot en stock est « dormant ». */
  const DORMANT_DAYS = 90;

  let kpi = $state({
    revenueAll: 0,
    revenueMonth: 0,
    pendingSales: 0,
    productMargin: 0,
    marginPct: null as number | null,
    bottles: 0,
    stockValue: 0,
    lowCount: 0,
    products: 0,
    lots: 0,
    customers: 0,
    tastings: 0,
  });
  let months = $state<{ key: string; label: string; value: number }[]>([]);
  let topLots = $state<LotStats[]>([]);
  let outOfStock = $state<LotStats[]>([]);
  let lowStock = $state<LotStats[]>([]);
  let dormant = $state<LotStats[]>([]);
  let nextTasting = $state<any>(null);
  let lastTasting = $state<any>(null);
  let nextTastingSeats = $state<SeatInfo | null>(null);
  let nextTastingOnline = $state(0);
  let newRequests = $state({ wishes: 0, messages: 0 });
  let reorderBusy = $state("");
  let reorderMsg = $state("");

  const today = formatDateLong(todayIso());

  async function loadDashboardStats() {
    statsLoading = true;
    statsError = "";

    try {
      const monthStart = todayIso().slice(0, 8) + "01";
      /* Promise.resolve : la requête ne part qu'une fois, lue deux fois (dégustation, puis ses places). */
      const nextQuery = Promise.resolve(
        supabase
          .from("tasting")
          .select("*, tasting_lot ( lot_id ), tasting_registration ( seats, status )")
          .gte("date", todayIso())
          .order("date", { ascending: true })
          .limit(1),
      );
      const [ds, customersRes, productsRes, tastingsRes, nextRes, lastRes, requestsRes, seatsRes] = await Promise.all([
        loadDataset(),
        supabase.from("customer").select("id", { count: "exact", head: true }),
        supabase.from("product").select("id", { count: "exact", head: true }),
        supabase.from("tasting").select("id", { count: "exact", head: true }),
        nextQuery,
        supabase.from("tasting").select("id, name, date, location").lt("date", todayIso()).order("date", { ascending: false }).limit(1),
        countNewRequests(),
        /* Places de la prochaine dégustation, pendant que le reste charge. */
        nextQuery.then((r) => (r.data?.[0] ? fetchSeats(r.data[0].id) : null)),
      ]);

      const firstErr = customersRes.error || productsRes.error || tastingsRes.error;
      if (firstErr) throw new Error(firstErr.message);

      const inStock = [...ds.stock.values()].filter((q) => q > 0);
      const revenueSales = ds.sales.filter((s) => REVENUE_STATUSES.includes(s.status ?? ""));
      const lines = revenueLines(ds);
      const productLines = lines.filter((l) => !l.isTastingFee);
      const productRevenue = productLines.reduce((s, l) => s + l.revenue, 0);
      const productMargin = productLines.reduce((s, l) => s + l.revenue - l.cost, 0);

      kpi = {
        revenueAll: revenueSales.reduce((sum, r) => sum + Number(r.total_price ?? 0), 0),
        revenueMonth: revenueSales.filter((r) => r.date >= monthStart).reduce((sum, r) => sum + Number(r.total_price ?? 0), 0),
        pendingSales: ds.sales.filter((s) => s.status === "pending").length,
        productMargin,
        marginPct: productRevenue > 0 ? Math.round((productMargin / productRevenue) * 100) : null,
        bottles: inStock.reduce((s, q) => s + q, 0),
        stockValue: ds.lots.reduce((s, v) => s + Math.max(0, ds.stock.get(v.id) ?? 0) * Number(v.purchase_price || 0), 0),
        lowCount: inStock.filter((q) => q <= LOW_STOCK).length,
        products: productsRes.count ?? 0,
        lots: ds.lots.length,
        customers: customersRes.count ?? 0,
        tastings: tastingsRes.count ?? 0,
      };

      const stats = lotStats(ds, lines);
      months = monthlyRevenue(ds);
      topLots = stats.filter((s) => s.sold > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
      /* Réassort : jamais pour un lot « plus jamais disponible ». */
      const reorderable = stats.filter((s) => !isDiscontinued(s.lot));
      outOfStock = reorderable.filter((s) => s.stock <= 0 && s.sold > 0).sort((a, b) => b.sold - a.sold);
      lowStock = reorderable.filter((s) => s.stock > 0 && s.stock <= LOW_STOCK).sort((a, b) => a.stock - b.stock || b.sold - a.sold);
      dormant = stats
        .filter((s) => s.stock > 0 && (s.idleDays == null || s.idleDays >= DORMANT_DAYS))
        .sort((a, b) => b.stock * Number(b.lot.purchase_price || 0) - a.stock * Number(a.lot.purchase_price || 0));

      nextTasting = (nextRes.data || [])[0] ?? null;
      lastTasting = (lastRes.data || [])[0] ?? null;
      nextTastingSeats = seatsRes;
      nextTastingOnline = onlineSeats(nextTasting?.tasting_registration || []);
      newRequests = requestsRes;
    } catch (e) {
      statsError = errorMessage(e);
    } finally {
      statsLoading = false;
    }
  }

  async function reorder(s: LotStats) {
    reorderBusy = s.lot.id;
    try {
      reorderMsg = (await promptReorder(lotShortLabel(s.lot), s.lot)) ?? reorderMsg;
    } catch (e) {
      reorderMsg = errorMessage(e);
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

  let stockAlerts = $derived([...outOfStock, ...lowStock]);
  let chartLabel = $derived(`Chiffre d'affaires encaissé par mois sur les 12 derniers mois. ${months
    .map((m) => `${m.label} : ${formatEUR(m.value)}`)
    .join(", ")}.`);
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
          onkeydown={handleKeydown}
        />
        <Button variant="primary" block disabled={loading} onclick={handleMagicLink}>
          {loading ? "Envoi…" : "Envoyer le lien de connexion"}
        </Button>
        {#if error}
          <p class="t-danger login-error" role="alert">{error}</p>
        {/if}
      {:else}
        <p role="status">Un lien de connexion a été envoyé à <strong>{email}</strong>.</p>
        <p class="t-muted">Vérifiez votre boîte mail et cliquez sur le lien pour vous connecter.</p>
        <Button onclick={() => (magicLinkSent = false)}>Envoyer un nouveau lien</Button>
      {/if}
    </div>
  </div>
{:else}
  <ManagePageShell title="Tableau de bord" subtitle={today}>
    {#snippet actions()}
        <Button href="/manage/tastings">Planifier une dégustation</Button>
        <Button variant="primary" href="/manage/sales?nouvelle=1"><IconPlus size={18} strokeWidth={1.75} /> Nouvelle vente</Button>
      {/snippet}

    {#if statsError}
      <div class="error-message" role="alert">{statsError}</div>
    {/if}

    {#if statsLoading}
      <Spinner />
    {:else}
      {#if kpi.pendingSales || outOfStock.length || lowStock.length || dormant.length || newRequests.wishes || newRequests.messages}
        <nav class="todo" aria-label="À traiter">
          <span class="todo-title"><IconInbox size={16} strokeWidth={1.75} aria-hidden="true" /> À traiter</span>
          {#if kpi.pendingSales}
            <a href="/manage/sales?statut=pending">{kpi.pendingSales} vente{kpi.pendingSales > 1 ? "s" : ""} en attente de paiement</a>
          {/if}
          {#if newRequests.messages}
            <a href="/manage/requests">{newRequests.messages} message{newRequests.messages > 1 ? "s" : ""} du site</a>
          {/if}
          {#if newRequests.wishes}
            <a href="/manage/requests">{newRequests.wishes} demande{newRequests.wishes > 1 ? "s" : ""} « J’en veux »</a>
          {/if}
          {#if outOfStock.length}
            <a class="danger" href="#stock-alerts">{outOfStock.length} lot{outOfStock.length > 1 ? "s" : ""} en rupture</a>
          {/if}
          {#if lowStock.length}
            <a class="warn" href="#stock-alerts">{lowStock.length} lot{lowStock.length > 1 ? "s" : ""} presque épuisé{lowStock.length > 1 ? "s" : ""}</a>
          {/if}
          {#if dormant.length}
            <a href="#stock-dormant">{dormant.length} produit{dormant.length > 1 ? "s" : ""} dormant{dormant.length > 1 ? "s" : ""}</a>
          {/if}
        </nav>
      {/if}

      <div class="kpis">
        <KpiCard label="Chiffre d’affaires" value={formatEUR(kpi.revenueAll)} icon={IconEuro} href="/manage/sales">
          {formatEUR(kpi.revenueMonth)} ce mois-ci · {kpi.pendingSales} vente{kpi.pendingSales > 1 ? "s" : ""} en attente
        </KpiCard>
        <KpiCard label="Marge brute sur les produits" value={formatEUR(kpi.productMargin)} icon={IconChart} href="/manage/insights">
          {kpi.marginPct != null ? `${kpi.marginPct} % du CA produits` : "Aucune vente encaissée"}
        </KpiCard>
        <KpiCard label="Bouteilles en stock" value={String(kpi.bottles)} icon={IconBox} href="/manage/stock">
          {formatEUR(kpi.stockValue)} au prix d’achat
          {#if kpi.lowCount}<br /><span class="t-warn">{kpi.lowCount} lot{kpi.lowCount > 1 ? "s" : ""} ≤ {LOW_STOCK} bt.</span>{/if}
        </KpiCard>
        <KpiCard label="Produits au catalogue" value={String(kpi.products)} icon={IconProduct} href="/manage/products">
          {kpi.lots} lot{kpi.lots > 1 ? "s" : ""}
        </KpiCard>
        <KpiCard label="Clients" value={String(kpi.customers)} icon={IconUsers} href="/manage/customers" />
        <KpiCard label="Dégustations" value={String(kpi.tastings)} icon={IconGlasses} href="/manage/tastings" />
      </div>

      <Card title="Chiffre d’affaires encaissé" id="ca-card">
        {#snippet actions()}
                <span class="t-caption">12 derniers mois</span>
              {/snippet}
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
            {@const delta = daysUntil(nextTasting.date)}
            <p class="countdown">{delta === 0 ? "C’est aujourd’hui !" : daysAwayLabel(delta)}</p>
            <ul class="next-facts">
              <li><strong>{nextTasting.tasting_lot?.length ?? 0}</strong> au programme</li>
              {#if nextTastingSeats}
                <li>
                  <a href="/manage/tastings?id={nextTasting.id}">
                    <strong>{nextTastingSeats.seats_taken}</strong>{nextTastingSeats.capacity != null ? ` / ${nextTastingSeats.capacity}` : ""} places prises{nextTastingOnline ? `, dont ${nextTastingOnline} réservées en ligne` : ""}
                  </a>
                </li>
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

        <Card title="Top 5 des produits" id="top-lots">
          {#snippet actions()}
                    <span class="t-caption">par chiffre d’affaires</span>
                  {/snippet}
          {#if topLots.length === 0}
            <EmptyState icon={IconReceipt} title="Pas encore de ventes encaissées" compact />
          {:else}
            <ol class="rank">
              {#each topLots as w}
                <li>
                  <span class="rank-name">
                    <StyleDot type={w.lot.product?.product_type} />
                    <span><strong>{lotShortLabel(w.lot)}</strong><span class="t-muted">&nbsp;· {w.lot.product?.producer?.name ?? ""}</span></span>
                  </span>
                  <span class="rank-value"><strong>{formatEUR(w.revenue)}</strong><span class="t-muted">{w.sold} bt.</span></span>
                  <span class="rank-bar" aria-hidden="true"><span style="width: {(w.revenue / topLots[0].revenue) * 100}%"></span></span>
                </li>
              {/each}
            </ol>
          {/if}
        </Card>

        <Card title="Stock bas et ruptures" id="stock-alerts">
          {#snippet actions()}
                    <Button size="sm" href="/manage/orders">Préparer une commande</Button>
                  {/snippet}
          {#if reorderMsg}<p class="notice" role="status">{reorderMsg}</p>{/if}
          {#if stockAlerts.length === 0}
            <EmptyState icon={IconBox} title="Rien à signaler" text="Aucun lot en rupture ni presque épuisé." compact />
          {:else}
            <ul class="list">
              {#each stockAlerts.slice(0, 8) as s}
                <li>
                  <StyleDot type={s.lot.product?.product_type} />
                  <span class="list-main">
                    <span><strong>{lotShortLabel(s.lot)}</strong><span class="t-muted">&nbsp;· {s.lot.product?.producer?.name ?? ""}</span></span>
                    <span class="t-caption">{s.sold ? `${s.sold} vendue${s.sold > 1 ? "s" : ""}` : "aucune vente"}</span>
                  </span>
                  {#if s.stock <= 0}
                    <StockBadge kind="out" />
                  {:else}
                    <StockBadge kind="low" label="{s.stock} bt." />
                  {/if}
                  <Button size="sm" variant="ghost" disabled={reorderBusy === s.lot.id} onclick={() => reorder(s)}>
                    {reorderBusy === s.lot.id ? "…" : "Réassort"}
                  </Button>
                </li>
              {/each}
            </ul>
          {/if}
        </Card>

        <Card title="Stock dormant" id="stock-dormant">
          {#snippet actions()}
                    <span class="t-caption">plus de {DORMANT_DAYS} j sans vente</span>
                  {/snippet}
          {#if dormant.length === 0}
            <EmptyState icon={IconBox} title="Tout tourne bien" compact />
          {:else}
            <ul class="list">
              {#each dormant.slice(0, 6) as s}
                <li>
                  <StyleDot type={s.lot.product?.product_type} />
                  <span class="list-main">
                    <span><strong>{lotShortLabel(s.lot)}</strong><span class="t-muted">&nbsp;· {s.lot.product?.producer?.name ?? ""}</span></span>
                    <span class="t-caption">
                      {s.stock} bt. · {#if s.lastSale}dernière vente il y a <strong class="t-warn">{s.idleDays} j</strong>{:else}<strong class="t-warn">jamais vendu</strong>{/if}
                    </span>
                  </span>
                  <span class="value">{formatEUR(s.stock * Number(s.lot.purchase_price || 0))}</span>
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
    background: var(--warn-bg);
    border: 1px solid var(--warn-border);
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

  .next-facts a {
    color: inherit;
    text-decoration: underline;
    text-decoration-color: var(--border);
    text-underline-offset: 3px;
  }

  .next-facts a:hover {
    text-decoration-color: currentColor;
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
