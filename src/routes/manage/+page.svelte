<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { getContext, onMount } from "svelte";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import ColumnChart from "$lib/components/manage/ColumnChart.svelte";
  import Icon, { type IconName } from "$lib/components/Icon.svelte";
  import {
    REVENUE_STATUSES,
    loadDataset,
    monthlyRevenue,
    revenueLines,
    vintageStats,
    type VintageStats,
  } from "$lib/analytics";
  import { addToNextSupplierOrder } from "$lib/reorder";
  import { hasTable } from "$lib/features";
  import { daysUntil, formatDateLong, todayIso } from "$lib/dates";
  import { formatEur, vintageLabel } from "$lib/wine";

  const { user: userStore } = getContext<any>("auth");

  type StatCard = {
    id: string;
    icon: IconName;
    label: string;
    value: string;
    hint?: string;
    href: string;
    tone: "blue" | "green" | "purple" | "amber" | "rose" | "slate";
  };

  let email = "";
  let error = "";
  let loading = false;
  let magicLinkSent = false;

  let statsLoading = true;
  let statsError = "";
  let statCards: StatCard[] = [];

  let months: { key: string; label: string; value: number }[] = [];
  let topWines: VintageStats[] = [];
  let lowStock: VintageStats[] = [];
  let dormant: VintageStats[] = [];
  let nextTasting: any = null;
  let nextTastingSeats: number | null = null;
  let newRequests = 0;
  let reorderBusy = "";
  let reorderMsg = "";

  /** Seuil « stock bas » (aligné sur l’ancien indicateur). */
  const LOW_STOCK = 3;
  /** Jours sans vente au-delà desquels un vin en stock est « dormant ». */
  const DORMANT_DAYS = 90;

  function formatInt(n: number): string {
    return new Intl.NumberFormat("fr-FR").format(n);
  }

  function formatEurRound(n: number): string {
    return formatEur(n, true);
  }

  function monthStartIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }

  async function loadDashboardStats() {
    statsLoading = true;
    statsError = "";

    try {
      const monthStart = monthStartIso();

      const [ds, customersRes, winesRes, vintagesRes, tastingsRes, nextRes] = await Promise.all([
        loadDataset(),
        supabase.from("customer").select("id", { count: "exact", head: true }),
        supabase.from("wine").select("id", { count: "exact", head: true }),
        supabase.from("wine_vintage").select("id", { count: "exact", head: true }),
        supabase.from("tasting").select("id", { count: "exact", head: true }),
        supabase
          .from("tasting")
          .select("*, tasting_wine_vintage ( wine_vintage_id ), tasting_customer ( customer_id )")
          .gte("date", todayIso())
          .order("date", { ascending: true })
          .limit(1),
      ]);

      const firstErr =
        customersRes.error || winesRes.error || vintagesRes.error || tastingsRes.error;
      if (firstErr) throw new Error(firstErr.message);

      const invRows = [...ds.stock.values()].filter((q) => q > 0);
      const bottlesInStock = invRows.reduce((s, q) => s + q, 0);
      const vintagesInStock = invRows.length;
      const lowStockCount = invRows.filter((q) => q <= LOW_STOCK).length;
      const stockValue = ds.vintages.reduce(
        (s, v) => s + Math.max(0, ds.stock.get(v.id) ?? 0) * Number(v.purchase_price || 0),
        0,
      );

      const revenueSales = ds.sales.filter(
        (s) => s.status !== "cancelled" && REVENUE_STATUSES.includes(s.status ?? ""),
      );
      const revenueAll = revenueSales.reduce((sum, r) => sum + Number(r.total_price ?? 0), 0);
      const revenueMonth = revenueSales
        .filter((r) => r.date >= monthStart)
        .reduce((sum, r) => sum + Number(r.total_price ?? 0), 0);

      const lines = revenueLines(ds);
      const wineLines = lines.filter((l) => !l.isTastingFee);
      const wineRevenue = wineLines.reduce((s, l) => s + l.revenue, 0);
      const wineMargin = wineLines.reduce((s, l) => s + l.revenue - l.cost, 0);
      const pendingSales = ds.sales.filter((s) => s.status === "pending").length;

      const stats = vintageStats(ds, lines);
      months = monthlyRevenue(ds);
      topWines = stats
        .filter((s) => s.sold > 0)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
      lowStock = stats
        .filter((s) => (s.stock > 0 && s.stock <= LOW_STOCK) || (s.stock <= 0 && s.sold > 0))
        .sort((a, b) => a.stock - b.stock || b.sold - a.sold)
        .slice(0, 8);
      dormant = stats
        .filter((s) => s.stock > 0 && (s.idleDays == null || s.idleDays >= DORMANT_DAYS))
        .sort((a, b) => b.stock * Number(b.vintage.purchase_price || 0) - a.stock * Number(a.vintage.purchase_price || 0))
        .slice(0, 6);

      nextTasting = (nextRes.data || [])[0] ?? null;
      nextTastingSeats = null;
      if (nextTasting && (await hasTable("tasting_registration"))) {
        const { data } = await supabase
          .from("tasting_registration")
          .select("seats")
          .eq("tasting_id", nextTasting.id)
          .eq("status", "confirmed");
        nextTastingSeats = (data || []).reduce((s, r) => s + r.seats, 0);
      }
      newRequests = 0;
      if (await hasTable("wish_request")) {
        const { count } = await supabase
          .from("wish_request")
          .select("id", { count: "exact", head: true })
          .eq("status", "new");
        newRequests = count ?? 0;
      }

      statCards = [
        {
          id: "bottles",
          icon: "bottle",
          label: "Bouteilles en stock",
          value: formatInt(bottlesInStock),
          hint:
            lowStockCount > 0
              ? `${formatInt(lowStockCount)} millésime${lowStockCount > 1 ? "s" : ""} ≤ ${LOW_STOCK} bt. · ${formatEurRound(stockValue)} au prix d’achat`
              : `${formatInt(vintagesInStock)} référence${vintagesInStock > 1 ? "s" : ""} · ${formatEurRound(stockValue)} au prix d’achat`,
          href: "/manage/stock",
          tone: "green",
        },
        {
          id: "wines",
          icon: "wine",
          label: "Vins au catalogue",
          value: formatInt(winesRes.count ?? 0),
          hint: `${formatInt(vintagesRes.count ?? 0)} millésime${(vintagesRes.count ?? 0) > 1 ? "s" : ""}`,
          href: "/manage/wines",
          tone: "purple",
        },
        {
          id: "customers",
          icon: "users",
          label: "Clients",
          value: formatInt(customersRes.count ?? 0),
          href: "/manage/customers",
          tone: "blue",
        },
        {
          id: "revenue",
          icon: "cash",
          label: "Chiffre d'affaires",
          value: formatEurRound(revenueAll),
          hint: `${formatEurRound(revenueMonth)} ce mois-ci${pendingSales ? ` · ${pendingSales} vente${pendingSales > 1 ? "s" : ""} en attente` : ""}`,
          href: "/manage/sales",
          tone: "amber",
        },
        {
          id: "margin",
          icon: "chart",
          label: "Marge brute sur les vins",
          value: formatEurRound(wineMargin),
          hint: wineRevenue > 0 ? `${Math.round((wineMargin / wineRevenue) * 100)} % du CA vin` : "Aucune vente encaissée",
          href: "/manage/insights",
          tone: "rose",
        },
        {
          id: "tastings",
          icon: "glasses",
          label: "Dégustations",
          value: formatInt(tastingsRes.count ?? 0),
          hint: newRequests > 0 ? `${newRequests} demande${newRequests > 1 ? "s" : ""} « J’en veux » à traiter` : undefined,
          href: newRequests > 0 ? "/manage/requests" : "/manage/tastings",
          tone: "purple",
        },
      ];
    } catch (e) {
      statsError =
        e instanceof Error ? e.message : "Impossible de charger les statistiques";
      statCards = [];
    } finally {
      statsLoading = false;
    }
  }

  async function reorder(s: VintageStats) {
    const raw = prompt(`Combien de bouteilles de « ${vintageLabel(s.vintage)} » ajouter à la commande fournisseur ?`, "12");
    if (raw == null) return;
    const qty = parseInt(raw, 10);
    if (!Number.isFinite(qty) || qty < 1) return;
    reorderBusy = s.vintage.id;
    reorderMsg = "";
    try {
      const res = await addToNextSupplierOrder(s.vintage.id, qty, Number(s.vintage.purchase_price || 0));
      reorderMsg = `${qty} bt. ajoutées à ${res.created ? "une nouvelle commande" : "la commande en attente"} chez ${res.supplierName}.`;
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
</script>

<svelte:head>
  <title>Gestion</title>
</svelte:head>

{#if !$userStore}
  <div class="login-container">
    <div class="login-form">
      <h1>Accès gestion</h1>

      {#if !magicLinkSent}
        <div class="input-group">
          <input
            type="email"
            bind:value={email}
            placeholder="Votre email"
            on:keydown={handleKeydown}
          />
          <button on:click={handleMagicLink} disabled={loading}>
            {loading ? "Envoi..." : "Envoyer le lien de connexion"}
          </button>
        </div>
        {#if error}
          <p class="error">{error}</p>
        {/if}
      {:else}
        <div class="magic-link-sent">
          <p>✅ Un lien de connexion a été envoyé à <strong>{email}</strong></p>
          <p>
            Vérifiez votre boîte mail et cliquez sur le lien pour vous
            connecter.
          </p>
          <button class="resend-btn" on:click={() => (magicLinkSent = false)}>
            Envoyer un nouveau lien
          </button>
        </div>
      {/if}
    </div>
  </div>
{:else}
  <ManagePageShell title="Tableau de bord">
    {#if statsError}
      <div class="error-message">{statsError}</div>
    {/if}

    {#if statsLoading}
      <div class="loading">Chargement des indicateurs…</div>
    {:else}
      <div class="stats-grid">
        {#each statCards as card (card.id)}
          <a href={card.href} class="stat-card stat-card--{card.tone}">
            <span class="stat-icon" aria-hidden="true"><Icon name={card.icon} size="1.6rem" /></span>
            <div class="stat-body">
              <span class="stat-value">{card.value}</span>
              <span class="stat-label">{card.label}</span>
              {#if card.hint}
                <span class="stat-hint">{card.hint}</span>
              {/if}
            </div>
          </a>
        {/each}
      </div>

      <div class="dash-grid">
        <section class="panel panel--wide">
          <ColumnChart
            data={months}
            title="Chiffre d’affaires encaissé — 12 derniers mois"
            format={(n) => formatEur(n, true)}
            highlightKey={months[months.length - 1]?.key ?? null}
          />
        </section>

        <section class="panel next-tasting">
          <h2 class="panel-title-sm"><Icon name="glasses" /> Prochaine dégustation</h2>
          {#if nextTasting}
            <p class="next-name">{nextTasting.name || "Dégustation"}</p>
            <p class="muted">
              {formatDateLong(nextTasting.date)}{nextTasting.location ? ` · ${nextTasting.location}` : ""}
            </p>
            <p class="countdown">
              {daysUntil(nextTasting.date) === 0 ? "C’est aujourd’hui !" : `J−${daysUntil(nextTasting.date)}`}
            </p>
            <ul class="next-facts">
              <li><strong>{nextTasting.tasting_wine_vintage?.length ?? 0}</strong> vins</li>
              <li><strong>{nextTasting.tasting_customer?.length ?? 0}</strong> participants</li>
              {#if nextTastingSeats != null}
                <li>
                  <strong>{nextTastingSeats}</strong>{nextTasting.capacity ? ` / ${nextTasting.capacity}` : ""} places réservées en ligne
                </li>
              {/if}
            </ul>
            <div class="row-actions">
              <a class="btn-primary btn-sm" href="/manage/tastings/{nextTasting.id}/live">Piloter</a>
              <a class="btn-secondary btn-sm" href="/manage/tasting-flyer">Visuel</a>
              <a class="btn-secondary btn-sm" href="/manage/campaigns">Inviter</a>
            </div>
          {:else}
            <p class="muted">Aucune date planifiée.</p>
            <a class="btn-primary btn-sm" href="/manage/tastings">Planifier une dégustation</a>
          {/if}
        </section>

        <section class="panel">
          <h2 class="panel-title-sm"><Icon name="sparkle" /> Top 5 des vins (CA)</h2>
          {#if topWines.length === 0}
            <p class="empty-text">Pas encore de ventes encaissées.</p>
          {:else}
            <ol class="rank">
              {#each topWines as w}
                <li>
                  <span class="rank-name">{vintageLabel(w.vintage)}</span>
                  <span class="rank-bar" aria-hidden="true">
                    <span style="width: {(w.revenue / topWines[0].revenue) * 100}%"></span>
                  </span>
                  <span class="rank-value">{formatEur(w.revenue, true)}<small>{w.sold} bt.</small></span>
                </li>
              {/each}
            </ol>
          {/if}
        </section>

        <section class="panel">
          <h2 class="panel-title-sm"><Icon name="alert" /> Stock bas & ruptures</h2>
          {#if reorderMsg}<p class="reorder-msg" role="status">{reorderMsg}</p>{/if}
          {#if lowStock.length === 0}
            <p class="empty-text">Rien à signaler 👌</p>
          {:else}
            <ul class="alerts">
              {#each lowStock as s}
                <li>
                  <span class="alert-name">
                    {vintageLabel(s.vintage)}
                    <small class:out={s.stock <= 0}>{s.stock <= 0 ? "Rupture" : `${s.stock} bt. restante${s.stock > 1 ? "s" : ""}`} · {s.sold} vendue{s.sold > 1 ? "s" : ""}</small>
                  </span>
                  <button type="button" class="btn-secondary btn-sm" disabled={reorderBusy === s.vintage.id} on:click={() => reorder(s)}>
                    {reorderBusy === s.vintage.id ? "…" : "Réassort"}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </section>

        <section class="panel">
          <h2 class="panel-title-sm"><Icon name="box" /> Stock dormant (&gt; {DORMANT_DAYS} j sans vente)</h2>
          {#if dormant.length === 0}
            <p class="empty-text">Tout tourne bien.</p>
          {:else}
            <ul class="alerts">
              {#each dormant as s}
                <li>
                  <span class="alert-name">
                    {vintageLabel(s.vintage)}
                    <small>{s.stock} bt. · {s.lastSale ? `dernière vente il y a ${s.idleDays} j` : "jamais vendu"}</small>
                  </span>
                  <span class="muted small">{formatEur(s.stock * Number(s.vintage.purchase_price || 0), true)}</span>
                </li>
              {/each}
            </ul>
            <p class="small muted">Idée : mettez-les à l’honneur lors de la prochaine dégustation.</p>
          {/if}
        </section>
      </div>
    {/if}
  </ManagePageShell>
{/if}

<style>
  .login-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f5f5;
  }

  .login-form {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 400px;
  }

  .login-form h1 {
    margin: 0 0 1.5rem 0;
    text-align: center;
    color: #333;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .input-group input {
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
  }

  .input-group button {
    padding: 0.75rem 1.5rem;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
  }

  .input-group button:hover {
    background: #0056b3;
  }

  .input-group button:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }

  .magic-link-sent {
    text-align: center;
  }

  .magic-link-sent p {
    margin: 0.5rem 0;
    color: #666;
  }

  .magic-link-sent p:first-child {
    color: #28a745;
    font-weight: 500;
  }

  .resend-btn {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    background: #6c757d;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .resend-btn:hover {
    background: #5a6268;
  }

  .error {
    color: #dc3545;
    text-align: center;
    margin: 0;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
  }

  @media (max-width: 960px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 560px) {
    .stats-grid {
      grid-template-columns: 1fr;
    }
  }

  .stat-card {
    display: flex;
    align-items: flex-start;
    gap: 1.25rem;
    padding: 1.75rem 2rem;
    min-height: 7.5rem;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    text-decoration: none;
    color: inherit;
    border-left: 5px solid #ced4da;
    transition:
      transform 0.15s ease,
      box-shadow 0.15s ease;
  }

  .stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
  }

  .stat-card--green {
    border-left-color: #28a745;
  }
  .stat-card--blue {
    border-left-color: #007bff;
  }
  .stat-card--purple {
    border-left-color: #6f42c1;
  }
  .stat-card--amber {
    border-left-color: #e0a800;
  }
  .stat-card--rose {
    border-left-color: #e83e8c;
  }
  .stat-card--slate {
    border-left-color: #6c757d;
  }

  .stat-icon {
    display: grid;
    place-items: center;
    width: 3rem;
    height: 3rem;
    border-radius: 12px;
    background: #f3f1ec;
    color: #256169;
    flex-shrink: 0;
  }

  .dash-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.5rem;
    margin-top: 1.5rem;
  }

  .panel {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    padding: 1.4rem 1.6rem;
    min-width: 0;
  }

  .panel--wide {
    grid-column: 1 / -1;
  }

  .panel-title-sm {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 0 1rem;
    font-size: 0.95rem;
    font-weight: 600;
    color: #2c3e50;
  }

  .muted {
    color: #6c757d;
  }

  .small {
    font-size: 0.85rem;
  }

  .next-name {
    margin: 0;
    font-family: var(--mz-font-display);
    font-size: 1.6rem;
    color: #256169;
  }

  .next-tasting p {
    margin: 0.2rem 0;
  }

  .countdown {
    font-weight: 700;
    color: #7a1f2e;
  }

  .next-facts {
    list-style: none;
    padding: 0;
    margin: 0.75rem 0 1rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.25rem;
    color: #3d4f51;
  }

  .row-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .row-actions a,
  .next-tasting a {
    text-decoration: none;
    display: inline-block;
  }

  .rank {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .rank li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 6.5rem;
    grid-template-areas: "name value" "bar value";
    column-gap: 1rem;
    row-gap: 0.3rem;
    align-items: center;
  }

  .rank-name {
    grid-area: name;
    font-size: 0.9rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rank-bar {
    grid-area: bar;
    height: 6px;
    border-radius: 999px;
    background: #eef4f4;
    overflow: hidden;
  }

  .rank-bar span {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: #256169;
  }

  .rank-value {
    grid-area: value;
    text-align: right;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    display: flex;
    flex-direction: column;
  }

  .rank-value small {
    font-weight: 400;
    color: #6c757d;
  }

  .alerts {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .alerts li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 0.55rem 0;
    border-bottom: 1px solid #f1f1f1;
  }

  .alert-name {
    display: flex;
    flex-direction: column;
    font-size: 0.9rem;
    min-width: 0;
  }

  .alert-name small {
    color: #a86b12;
  }

  .alert-name small.out {
    color: #c0392b;
    font-weight: 600;
  }

  .reorder-msg {
    margin: 0 0 0.75rem;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    background: #eef4f4;
    color: #1a474d;
    font-size: 0.88rem;
  }

  @media (max-width: 1100px) {
    .dash-grid {
      grid-template-columns: 1fr;
    }
  }

  .stat-body {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 0;
  }

  .stat-value {
    font-size: 2.1rem;
    font-weight: 700;
    color: #212529;
    line-height: 1.15;
    font-variant-numeric: tabular-nums;
  }

  .stat-label {
    font-size: 1rem;
    font-weight: 600;
    color: #444;
  }

  .stat-hint {
    font-size: 0.9rem;
    color: #6c757d;
    line-height: 1.35;
  }
</style>
