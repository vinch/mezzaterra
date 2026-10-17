<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { supabase } from "$lib/supabase";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import StarRating from "$lib/components/site/StarRating.svelte";
  import { customerDisplayLabel } from "$lib/customerDisplay";
  import { REVENUE_STATUSES, lineTotal, type SaleItemRow } from "$lib/analytics";
  import { hasTable } from "$lib/features";
  import { formatDateShort } from "$lib/dates";
  import { formatEur, vintageLabel, wineStyle } from "$lib/wine";

  const customerId = $page.params.id ?? "";

  let loading = true;
  let error = "";
  let customer: any = null;
  let sales: any[] = [];
  let tastings: any[] = [];
  let feedback: any[] = [];
  let vintages: any[] = [];
  let stock = new Map<string, number>();

  const STATUS_LABELS: Record<string, string> = {
    pending: "En attente",
    paid: "Payée",
    delivered: "Livrée",
    closed: "Clôturée",
    cancelled: "Annulée",
  };

  onMount(async () => {
    try {
      const [cRes, sRes, tRes, vRes, iRes] = await Promise.all([
        supabase.from("customer").select("*, country ( name, flag )").eq("id", customerId).maybeSingle(),
        supabase
          .from("sale")
          .select("id, date, status, total_price, invoice_number, note, sale_item ( * )")
          .eq("customer_id", customerId)
          .order("date", { ascending: false }),
        supabase
          .from("tasting_customer")
          .select("tasting ( id, name, date, location )")
          .eq("customer_id", customerId),
        supabase
          .from("wine_vintage")
          .select(
            "id, wine_id, year, production_year, price, purchase_price, wine ( id, name, winery ( name ), appelation ( name, label ( name ) ), wine_type ( name, category ) )",
          ),
        supabase.from("inventory").select("wine_vintage_id, quantity_on_hand"),
      ]);
      if (cRes.error) throw new Error(cRes.error.message);
      customer = cRes.data;
      sales = sRes.data || [];
      tastings = ((tRes.data || []) as any[])
        .map((r) => r.tasting)
        .filter(Boolean)
        .sort((a, b) => b.date.localeCompare(a.date));
      vintages = vRes.data || [];
      stock = new Map((iRes.data || []).map((r: any) => [r.wine_vintage_id, r.quantity_on_hand ?? 0]));

      if (customer?.email && (await hasTable("tasting_feedback"))) {
        const { data } = await supabase
          .from("tasting_feedback")
          .select("*")
          .ilike("guest_email", customer.email.replace(/[\\%_]/g, "\\$&"))
          .order("created_at", { ascending: true });
        const latest = new Map<string, any>();
        for (const f of data || []) latest.set(`${f.tasting_id}:${f.wine_vintage_id}`, f);
        feedback = [...latest.values()].filter((f) => f.rating || f.comment);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  });

  $: vintageById = new Map(vintages.map((v) => [v.id, v]));
  $: paidSales = sales.filter((s) => REVENUE_STATUSES.includes(s.status));
  $: revenue = paidSales.reduce((s, x) => s + Number(x.total_price || 0), 0);
  $: avgBasket = paidSales.length ? revenue / paidSales.length : 0;
  $: lastSale = sales.find((s) => s.status !== "cancelled") ?? null;

  /* Vins achetés (agrégés par millésime, ventes non annulées). */
  $: bought = (() => {
    const map = new Map<string, { vintage: any; qty: number; spent: number; last: string }>();
    for (const s of sales) {
      if (s.status === "cancelled") continue;
      for (const it of (s.sale_item || []) as SaleItemRow[]) {
        if (!it.wine_vintage_id) continue;
        const v = vintageById.get(it.wine_vintage_id);
        if (!v) continue;
        const cur = map.get(v.id) ?? { vintage: v, qty: 0, spent: 0, last: s.date };
        cur.qty += Number(it.quantity) || 0;
        cur.spent += lineTotal(it);
        if (s.date > cur.last) cur.last = s.date;
        map.set(v.id, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty);
  })();

  $: totalBottles = bought.reduce((s, b) => s + b.qty, 0);

  /* Préférences : répartition par couleur et par domaine. */
  $: styleShare = (() => {
    const map = new Map<string, { style: ReturnType<typeof wineStyle>; qty: number }>();
    for (const b of bought) {
      const st = wineStyle(b.vintage.wine?.wine_type);
      const cur = map.get(st.key) ?? { style: st, qty: 0 };
      cur.qty += b.qty;
      map.set(st.key, cur);
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty);
  })();

  $: favoriteWineries = (() => {
    const map = new Map<string, number>();
    for (const b of bought) {
      const n = b.vintage.wine?.winery?.name || "—";
      map.set(n, (map.get(n) ?? 0) + b.qty);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  })();

  /* Suggestions de relance. */
  $: suggestions = (() => {
    const boughtIds = new Set(bought.map((b) => b.vintage.id));
    const out: { vintage: any; reason: string }[] = [];
    const seen = new Set<string>();
    const push = (v: any, reason: string) => {
      if (!v || seen.has(v.id) || boughtIds.has(v.id) || (stock.get(v.id) ?? 0) <= 0) return;
      seen.add(v.id);
      out.push({ vintage: v, reason });
    };

    for (const b of bought) {
      const year = b.vintage.year ?? b.vintage.production_year;
      for (const v of vintages) {
        if (v.wine_id === b.vintage.wine_id && (v.year ?? v.production_year) > year) {
          push(v, `Nouveau millésime d’un vin acheté (${b.qty} bt.)`);
        }
      }
    }
    for (const f of feedback) {
      if ((f.rating ?? 0) >= 4) push(vintageById.get(f.wine_vintage_id), `Noté ${f.rating}★ en dégustation`);
    }
    const fav = styleShare[0]?.style.key;
    if (fav) {
      for (const v of vintages) {
        if (out.length >= 6) break;
        if (wineStyle(v.wine?.wine_type).key === fav) push(v, `Dans ses goûts (${styleShare[0].style.label.toLowerCase()})`);
      }
    }
    return out.slice(0, 6);
  })();

  function mailto(): string {
    if (!customer?.email) return "";
    const lines = suggestions.map((s) => `- ${vintageLabel(s.vintage)}${s.vintage.price ? ` (${formatEur(s.vintage.price)})` : ""}`);
    const body = `Bonjour ${customer.first_name},\n\nJ’ai pensé à vous :\n${lines.join("\n")}\n\nÀ bientôt,\nMezzaterra`;
    return `mailto:${customer.email}?subject=${encodeURIComponent("Quelques vins pour vous")}&body=${encodeURIComponent(body)}`;
  }
</script>

<svelte:head>
  <title>{customer ? customerDisplayLabel(customer) : "Client"} - Gestion</title>
</svelte:head>

<ManagePageShell title={customer ? customerDisplayLabel(customer) : "Client"}>
  <svelte:fragment slot="actions">
    <a href="/manage/customers" class="btn-secondary">← Clients</a>
    {#if customer?.email && suggestions.length}
      <a href={mailto()} class="btn-primary">Envoyer des suggestions</a>
    {/if}
  </svelte:fragment>

  {#if loading}
    <div class="loading">Chargement…</div>
  {:else if error}
    <div class="error-message">{error}</div>
  {:else if !customer}
    <div class="empty-state"><p>Client introuvable.</p></div>
  {:else}
    <div class="top">
      <section class="card identity">
        <h2>Coordonnées</h2>
        <dl>
          {#if customer.email}<dt>Email</dt><dd><a href="mailto:{customer.email}">{customer.email}</a></dd>{/if}
          {#if customer.phone_number}<dt>Téléphone</dt><dd><a href="tel:{customer.phone_number}">{customer.phone_number}</a></dd>{/if}
          {#if customer.company_name}<dt>Société</dt><dd>{customer.company_name}{customer.vat ? ` · TVA ${customer.vat}` : ""}</dd>{/if}
          {#if customer.city || customer.address_line_1}
            <dt>Adresse</dt>
            <dd>
              {[customer.address_line_1, customer.address_line_2].filter(Boolean).join(", ")}<br />
              {[customer.zip_code, customer.city].filter(Boolean).join(" ")} {customer.country?.flag || ""}
            </dd>
          {/if}
          <dt>Client depuis</dt><dd>{formatDateShort(customer.created_at)}</dd>
        </dl>
      </section>

      <div class="kpis">
        <div class="kpi"><span class="v">{formatEur(revenue, true)}</span><span class="l">CA encaissé</span></div>
        <div class="kpi"><span class="v">{paidSales.length}</span><span class="l">Achat{paidSales.length > 1 ? "s" : ""}</span></div>
        <div class="kpi"><span class="v">{formatEur(avgBasket, true)}</span><span class="l">Panier moyen</span></div>
        <div class="kpi"><span class="v">{totalBottles}</span><span class="l">Bouteilles</span></div>
        <div class="kpi"><span class="v">{tastings.length}</span><span class="l">Dégustation{tastings.length > 1 ? "s" : ""}</span></div>
        <div class="kpi"><span class="v">{lastSale ? formatDateShort(lastSale.date) : "—"}</span><span class="l">Dernier achat</span></div>
      </div>
    </div>

    <div class="grid">
      <section class="card">
        <h2>Ses goûts</h2>
        {#if styleShare.length === 0}
          <p class="empty-text">Pas encore d’achat de vin.</p>
        {:else}
          <div class="share-bar" role="img" aria-label="Répartition des achats par couleur">
            {#each styleShare as s}
              <span style="flex: {s.qty}; background: {s.style.color}" title="{s.style.label} : {s.qty} bt."></span>
            {/each}
          </div>
          <ul class="legend">
            {#each styleShare as s}
              <li><span class="mz-dot" style="background: {s.style.color}"></span>{s.style.label} — {Math.round((s.qty / totalBottles) * 100)} %</li>
            {/each}
          </ul>
          {#if favoriteWineries.length}
            <p class="muted small">Domaines préférés : {favoriteWineries.map(([n, q]) => `${n} (${q})`).join(", ")}</p>
          {/if}
        {/if}
      </section>

      <section class="card">
        <h2>À lui proposer</h2>
        {#if suggestions.length === 0}
          <p class="empty-text">Pas de suggestion pour l’instant.</p>
        {:else}
          <ul class="list">
            {#each suggestions as s}
              <li>
                <span class="mz-dot" style="background: {wineStyle(s.vintage.wine?.wine_type).color}"></span>
                <span class="grow">{vintageLabel(s.vintage)}<small>{s.reason}</small></span>
                <span class="muted">{formatEur(s.vintage.price)}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <section class="card">
        <h2>Vins achetés</h2>
        {#if bought.length === 0}
          <p class="empty-text">Aucun.</p>
        {:else}
          <ul class="list">
            {#each bought as b}
              <li>
                <span class="mz-dot" style="background: {wineStyle(b.vintage.wine?.wine_type).color}"></span>
                <span class="grow">{vintageLabel(b.vintage)}<small>dernier achat le {formatDateShort(b.last)}</small></span>
                <strong>{b.qty} bt.</strong>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <section class="card">
        <h2>Dégustations</h2>
        {#if tastings.length === 0}
          <p class="empty-text">Aucune dégustation associée.</p>
        {:else}
          <ul class="list">
            {#each tastings as t}
              <li>
                <span class="grow">{t.name || "Dégustation"}<small>{formatDateShort(t.date)}{t.location ? ` · ${t.location}` : ""}</small></span>
                <a href="/manage/tastings/{t.id}/live" class="small">Ouvrir</a>
              </li>
            {/each}
          </ul>
        {/if}
        {#if feedback.length}
          <h3>Ses notes en direct</h3>
          <ul class="list">
            {#each feedback as f}
              <li>
                <span class="grow">
                  {vintageLabel(vintageById.get(f.wine_vintage_id))}
                  {#if f.comment}<small>« {f.comment} »</small>{/if}
                </span>
                {#if f.rating}<StarRating value={f.rating} readonly size="0.9rem" />{/if}
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <section class="card wide">
        <h2>Historique des ventes</h2>
        {#if sales.length === 0}
          <p class="empty-text">Aucune vente.</p>
        {:else}
          <table>
            <thead><tr><th>Date</th><th>Facture</th><th>Statut</th><th>Articles</th><th class="num">Total</th></tr></thead>
            <tbody>
              {#each sales as s (s.id)}
                <tr class:cancelled={s.status === "cancelled"}>
                  <td>{formatDateShort(s.date)}</td>
                  <td>{s.invoice_number || "—"}</td>
                  <td><span class="status status-{s.status}">{STATUS_LABELS[s.status] ?? s.status}</span></td>
                  <td class="items">
                    {(s.sale_item || [])
                      .map((it: any) => `${it.quantity} × ${it.wine_vintage_id ? vintageLabel(vintageById.get(it.wine_vintage_id)) : it.note || "Dégustation"}`)
                      .join(" · ")}
                  </td>
                  <td class="num">{formatEur(s.total_price)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </section>
    </div>
  {/if}
</ManagePageShell>

<style>
  .top {
    display: grid;
    grid-template-columns: minmax(260px, 1fr) 2fr;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    padding: 1.25rem 1.4rem;
    min-width: 0;
  }

  .card h2 {
    margin: 0 0 0.9rem;
    font-size: 1rem;
    color: #2c3e50;
  }

  .card h3 {
    margin: 1.2rem 0 0.5rem;
    font-size: 0.9rem;
    color: #2c3e50;
  }

  dl {
    margin: 0;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.4rem 1rem;
    font-size: 0.92rem;
  }

  dt {
    color: #868e96;
  }

  dd {
    margin: 0;
  }

  dd a {
    color: var(--mz-teal, #256169);
  }

  .kpis {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
  }

  .kpi {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    padding: 1rem 1.2rem;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .kpi .v {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1d2a2c;
  }

  .kpi .l {
    font-size: 0.85rem;
    color: #6c757d;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.5rem;
  }

  .wide {
    grid-column: 1 / -1;
  }

  .share-bar {
    display: flex;
    gap: 2px;
    height: 12px;
    border-radius: 999px;
    overflow: hidden;
  }

  .legend {
    list-style: none;
    padding: 0;
    margin: 0.75rem 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.25rem;
    font-size: 0.9rem;
  }

  .legend li {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .mz-dot {
    display: inline-block;
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .list li {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid #f3f3f3;
    font-size: 0.92rem;
  }

  .grow {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .grow small {
    color: #868e96;
  }

  .muted {
    color: #868e96;
  }

  .small {
    font-size: 0.85rem;
  }

  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .items {
    font-size: 0.85rem;
    color: #3d4f51;
  }

  tr.cancelled {
    opacity: 0.5;
  }

  .status {
    display: inline-block;
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 600;
    background: #f1f3f5;
  }

  .status-paid,
  .status-delivered,
  .status-closed {
    background: #e3f2e8;
    color: #2f7a4b;
  }

  .status-pending {
    background: #fff3d6;
    color: #8a5a00;
  }

  @media (max-width: 1000px) {
    .top,
    .grid {
      grid-template-columns: 1fr;
    }

    .kpis {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
