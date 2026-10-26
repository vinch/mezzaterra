<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { escapeLike, fetchAllRows, supabase } from "$lib/supabase";
  import { errorMessage } from "$lib/async";
  import { fetchStockMap } from "$lib/manageData";
  import { goto } from "$app/navigation";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import StarRating from "$lib/components/site/StarRating.svelte";
  import { customerDisplayLabel } from "$lib/customerDisplay";
  import { REVENUE_STATUSES, lineTotal, type SaleItemRow } from "$lib/analytics";
  import { daysUntil } from "$lib/dates";
  import { styleByKey, vintageLabel, vintageShortLabel, wineRobe, type WineStyleKey } from "$lib/wine";
  import { formatDate, formatEUR } from "$lib/format";
  import Button from "$lib/ui/Button.svelte";
  import IconButton from "$lib/ui/IconButton.svelte";
  import Card from "$lib/ui/Card.svelte";
  import RowMenu from "$lib/ui/RowMenu.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import DataTable from "$lib/ui/DataTable.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import StatusBadge from "$lib/ui/StatusBadge.svelte";
  import WineDot from "$lib/ui/WineDot.svelte";
  import { IconDownload, IconGlasses, IconPencil, IconPlus, IconReceipt, IconSend, IconSparkle, IconTrash, IconWine } from "$lib/ui/icons";
  import Spinner from "$lib/ui/Spinner.svelte";

  const customerId = $page.params.id ?? "";

  let loading = $state(true);
  let error = $state("");
  let customer = $state<any>(null);
  let sales = $state<any[]>([]);
  let tastings = $state<any[]>([]);
  let feedback = $state<any[]>([]);
  let vintages = $state.raw<any[]>([]);
  /** Lectures secondaires en échec (millésimes, stock, dégustations) : fiche affichée, incomplète. */
  let warnings = $state<string[]>([]);
  /** null : stock illisible, les suggestions (vins en stock) ne peuvent pas être calculées. */
  let stock = $state<Map<string, number> | null>(new Map());

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
        fetchAllRows<any>((from, to) =>
          supabase
            .from("wine_vintage")
            .select(
              "id, wine_id, year, production_year, price, purchase_price, wine ( id, name, winery ( name ), appelation ( name, label ( name ) ), wine_type ( name, category ) )",
            )
            .order("id")
            .range(from, to),
        ).catch((e) => {
          warnings = [...warnings, `Millésimes indisponibles, achats et suggestions incomplets : ${errorMessage(e)}`];
          return [];
        }),
        /* Le stock ne sert qu'aux suggestions : sans lui, le reste de la fiche reste lisible. */
        fetchStockMap().catch((e) => {
          warnings = [...warnings, `Stock indisponible : ${errorMessage(e)}`];
          return null;
        }),
      ]);
      const failed = [cRes, sRes].find((r) => r.error);
      if (failed?.error) throw new Error(failed.error.message);
      if (tRes.error) warnings = [...warnings, `Dégustations indisponibles : ${tRes.error.message}`];
      customer = cRes.data;
      sales = sRes.data || [];
      tastings = ((tRes.data || []) as any[])
        .map((r) => r.tasting)
        .filter(Boolean)
        .sort((a, b) => b.date.localeCompare(a.date));
      vintages = vRes;
      stock = iRes;

      if (customer?.email) {
        const { data } = await supabase
          .from("tasting_feedback")
          .select("*")
          .ilike("guest_email", escapeLike(customer.email))
          .order("created_at", { ascending: true });
        const latest = new Map<string, any>();
        for (const f of data || []) latest.set(`${f.tasting_id}:${f.wine_vintage_id}`, f);
        feedback = [...latest.values()].filter((f) => f.rating || f.comment);
      }
    } catch (e) {
      error = errorMessage(e);
    } finally {
      loading = false;
    }
  });

  let vintageById = $derived(new Map(vintages.map((v) => [v.id, v])));
  let paidSales = $derived(sales.filter((s) => REVENUE_STATUSES.includes(s.status)));
  let revenue = $derived(paidSales.reduce((s, x) => s + Number(x.total_price || 0), 0));
  let avgBasket = $derived(paidSales.length ? revenue / paidSales.length : 0);
  let lastSale = $derived(sales.find((s) => s.status !== "cancelled") ?? null);

  /* Vins achetés (agrégés par millésime, ventes non annulées). */
  let bought = $derived((() => {
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
  })());

  let totalBottles = $derived(bought.reduce((s, b) => s + b.qty, 0));

  /* Préférences : répartition par robe (toujours rouge / blanc / rosé) et domaine préféré. */
  const ROBES: WineStyleKey[] = ["white", "red", "rose"];
  let robeQty = $derived((() => {
    const map: Record<WineStyleKey, number> = { red: 0, white: 0, rose: 0, orange: 0, sparkling: 0, other: 0 };
    for (const b of bought) map[wineRobe(b.vintage.wine?.wine_type).key] += b.qty;
    return map;
  })());
  let robeOrder = $derived([...ROBES].sort((a, b) => robeQty[b] - robeQty[a]));
  let favRobe = $derived(robeOrder[0] && robeQty[robeOrder[0]] > 0 ? robeOrder[0] : null);

  let favoriteWinery = $derived((() => {
    const map = new Map<string, number>();
    for (const b of bought) {
      const n = b.vintage.wine?.winery?.name || "—";
      map.set(n, (map.get(n) ?? 0) + b.qty);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  })());

  /* Suggestions de relance. */
  let suggestions = $derived((() => {
    const boughtIds = new Set(bought.map((b) => b.vintage.id));
    const out: { vintage: any; reason: string }[] = [];
    const seen = new Set<string>();
    const push = (v: any, reason: string) => {
      if (!v || seen.has(v.id) || boughtIds.has(v.id) || (stock?.get(v.id) ?? 0) <= 0) return;
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
    if (favRobe) {
      for (const v of vintages) {
        if (out.length >= 6) break;
        if (wineRobe(v.wine?.wine_type).key === favRobe) push(v, `Dans ses goûts (${styleByKey(favRobe).label.toLowerCase()})`);
      }
    }
    return out.slice(0, 6);
  })());

  /* Cases « À lui proposer » : toutes cochées par défaut. */
  let unchecked = $state(new Set<string>());
  let selectedSuggestions = $derived(suggestions.filter((sg) => !unchecked.has(sg.vintage.id)));
  function toggleSuggestion(id: string) {
    const next = new Set(unchecked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    unchecked = next;
  }

  function mailto(): string {
    if (!customer?.email) return "";
    const lines = selectedSuggestions.map((s) => `- ${vintageLabel(s.vintage)}${s.vintage.price ? ` (${formatEUR(s.vintage.price)})` : ""}`);
    const body = `Bonjour ${customer.first_name},\n\nJ’ai pensé à vous :\n${lines.join("\n")}\n\nÀ bientôt,\nMezzaterra`;
    return `mailto:${customer.email}?subject=${encodeURIComponent("Quelques vins pour vous")}&body=${encodeURIComponent(body)}`;
  }

  let lastSaleDays = $derived(lastSale ? -daysUntil(lastSale.date) : null);

  /* Suppression (même opération que dans la liste des clients). */
  let confirmOpen = $state(false);
  let deleting = $state(false);
  async function deleteCustomer() {
    deleting = true;
    const { error: delErr } = await supabase.from("customer").delete().eq("id", customerId);
    deleting = false;
    if (delErr) {
      error = delErr.message;
      confirmOpen = false;
      return;
    }
    await goto("/manage/customers");
  }

  let menuItems = $derived([
    { label: "Modifier", icon: IconPencil, href: `/manage/customers?modifier=${customerId}` },
    { label: "Supprimer…", icon: IconTrash, danger: true, separator: true, onSelect: () => (confirmOpen = true) },
  ]);
</script>

<svelte:head>
  <title>{customer ? customerDisplayLabel(customer) : "Client"} - Gestion</title>
</svelte:head>

<ManagePageShell
  title={customer ? `${customer.first_name} ${customer.last_name}`.trim() : "Client"}
  subtitle={customer ? [`Client depuis le ${formatDate(customer.created_at)}`, customer.company_name, customer.city].filter(Boolean).join(" · ") : ""}
  back={{ href: "/manage/customers", label: "Clients" }}
>
  {#snippet actions()}
      {#if customer}
        <Button href="/manage/sales?nouvelle=1&client={customerId}">Nouvelle vente</Button>
        {#if customer.email && selectedSuggestions.length}
          <Button variant="primary" href={mailto()}><IconSend size={16} strokeWidth={1.75} /> Envoyer des suggestions</Button>
        {/if}
        <RowMenu items={menuItems} label="Plus d’actions pour ce client" />
      {/if}
  {/snippet}

  {#if loading}
    <Spinner />
  {:else if error}
    <div class="error-message" role="alert">{error}</div>
  {:else if !customer}
    <EmptyState title="Client introuvable" text="Il a peut-être été supprimé." />
  {:else}
    {#each warnings as w}<div class="error-message" role="alert">{w}</div>{/each}
    <div class="top">
      <Card title="Coordonnées" id="coords">
        <dl class="coords">
          {#if customer.email}<dt>Email</dt><dd><a href="mailto:{customer.email}">{customer.email}</a></dd>{/if}
          {#if customer.phone_number}<dt>Téléphone</dt><dd><a href="tel:{customer.phone_number.replace(/\s/g, '')}">{customer.phone_number}</a></dd>{/if}
          {#if customer.company_name}<dt>Société</dt><dd>{customer.company_name}{customer.vat ? ` · TVA ${customer.vat}` : ""}</dd>{/if}
          {#if customer.city || customer.address_line_1}
            <dt>Adresse</dt>
            <dd>
              {[customer.address_line_1, customer.address_line_2].filter(Boolean).join(", ")}<br />
              {[customer.zip_code, customer.city].filter(Boolean).join(" ")}{customer.country?.name ? ` · ${customer.country.name}` : ""}
            </dd>
          {/if}
          <dt>Client depuis</dt><dd>{formatDate(customer.created_at)}</dd>
        </dl>
      </Card>

      <section class="stats" aria-label="Chiffres clés">
        <div class="stat"><span class="t-caption">CA encaissé</span><span class="stat-v">{formatEUR(revenue)}</span></div>
        <div class="stat"><span class="t-caption">Achats</span><span class="stat-v">{paidSales.length}</span></div>
        <div class="stat"><span class="t-caption">Panier moyen</span><span class="stat-v">{paidSales.length ? formatEUR(avgBasket) : "—"}</span></div>
        <div class="stat"><span class="t-caption">Bouteilles</span><span class="stat-v">{totalBottles}</span></div>
        <div class="stat"><span class="t-caption">Dégustations</span><span class="stat-v">{tastings.length}</span></div>
        <div class="stat">
          <span class="t-caption">Dernier achat</span>
          <span class="stat-v">{lastSale ? formatDate(lastSale.date) : "—"}</span>
          {#if lastSaleDays != null}<span class="t-caption t-warn">il y a {lastSaleDays} jour{lastSaleDays > 1 ? "s" : ""}</span>{/if}
        </div>
      </section>
    </div>

    <div class="grid">
      <Card title="Ses goûts" id="tastes">
        {#if totalBottles === 0}
          <EmptyState icon={IconWine} title="Pas encore d’achat de vin" compact />
        {:else}
          <div class="share-bar" role="img" aria-label="Répartition des achats par robe">
            {#each robeOrder as r}
              {#if robeQty[r]}<span class="seg" style="flex: {robeQty[r]}; background: {styleByKey(r).color}"></span>{/if}
            {/each}
          </div>
          <ul class="legend">
            {#each robeOrder as r}
              <li class:muted={!robeQty[r]}>
                <WineDot robe={r} />
                <strong>{styleByKey(r).label}</strong>
                {Math.round((robeQty[r] / totalBottles) * 100)} %
              </li>
            {/each}
          </ul>
          {#if favoriteWinery}
            <div class="fav">
              <span class="t-caption">Domaine préféré</span>
              <p><strong>{favoriteWinery[0]}</strong> · {favoriteWinery[1]} bt.</p>
            </div>
          {/if}
        {/if}
      </Card>

      <Card title="À lui proposer" id="suggest">
        {#snippet actions()}
                        <span class="t-caption">{selectedSuggestions.length} vin{selectedSuggestions.length > 1 ? "s" : ""} sélectionné{selectedSuggestions.length > 1 ? "s" : ""} pour l’envoi</span>
                      {/snippet}
        {#if suggestions.length === 0}
          <EmptyState
            icon={IconSparkle}
            title={!stock ? "Stock indisponible : suggestions impossibles" : "Pas de suggestion pour l’instant"}
            compact
          />
        {:else}
          <ul class="list">
            {#each suggestions as sg (sg.vintage.id)}
              <li>
                <label class="suggest">
                  <input type="checkbox" checked={!unchecked.has(sg.vintage.id)} onchange={() => toggleSuggestion(sg.vintage.id)} />
                  <WineDot type={sg.vintage.wine?.wine_type} />
                  <span class="list-main">
                    <span><strong>{vintageShortLabel(sg.vintage)}</strong><span class="t-muted">&nbsp;· {sg.vintage.wine?.winery?.name ?? ""}</span></span>
                    <span class="t-caption" class:t-warn={(stock?.get(sg.vintage.id) ?? 0) <= 3}>
                      {sg.reason}{(stock?.get(sg.vintage.id) ?? 0) <= 3 ? ` · plus que ${stock?.get(sg.vintage.id)} bt.` : ""}
                    </span>
                  </span>
                  <span class="price">{formatEUR(sg.vintage.price)}</span>
                </label>
              </li>
            {/each}
          </ul>
          {#if !customer.email}<p class="t-caption">Pas d’email enregistré : ajoutez-en un pour envoyer ces suggestions.</p>{/if}
        {/if}
      </Card>

      <Card title="Vins achetés" id="bought">
        {#if bought.length === 0}
          <EmptyState icon={IconWine} title="Aucun vin acheté" compact />
        {:else}
          <ul class="list">
            {#each bought as b}
              <li>
                <WineDot type={b.vintage.wine?.wine_type} />
                <span class="list-main">
                  <span><strong>{vintageShortLabel(b.vintage)}</strong><span class="t-muted">&nbsp;· {b.vintage.wine?.winery?.name ?? ""}</span></span>
                  <span class="t-caption">Dernier achat le {formatDate(b.last)}</span>
                </span>
                <strong>{b.qty} bt.</strong>
              </li>
            {/each}
          </ul>
        {/if}
      </Card>

      <Card title="Dégustations" id="tastings">
        {#if tastings.length === 0}
          <EmptyState icon={IconGlasses} title="Aucune dégustation associée" compact />
        {:else}
          <ul class="list">
            {#each tastings as t}
              <li>
                <span class="tile" aria-hidden="true"><IconGlasses size={16} strokeWidth={1.75} /></span>
                <span class="list-main">
                  <strong>{t.name || "Dégustation"}</strong>
                  <span class="t-caption">{formatDate(t.date)}{t.location ? ` · ${t.location}` : ""}</span>
                </span>
                <a href="/manage/tastings/{t.id}/live">Ouvrir</a>
              </li>
            {/each}
          </ul>
        {/if}
        {#if feedback.length}
          <h3 class="t-label sub-title">Ses notes en direct</h3>
          <ul class="list">
            {#each feedback as f}
              <li>
                <span class="list-main">
                  <strong>{vintageShortLabel(vintageById.get(f.wine_vintage_id))}</strong>
                  {#if f.comment}<span class="t-caption">« {f.comment} »</span>{/if}
                </span>
                {#if f.rating}<StarRating value={f.rating} readonly size="0.9rem" />{/if}
              </li>
            {/each}
          </ul>
        {/if}
      </Card>
    </div>

    <Card title="Historique des ventes" id="history" padded={false}>
      {#if sales.length === 0}
        <EmptyState icon={IconReceipt} title="Aucune vente" compact>
          <Button size="sm" href="/manage/sales?nouvelle=1&client={customerId}"><IconPlus size={14} strokeWidth={1.75} /> Nouvelle vente</Button>
        </EmptyState>
      {:else}
        <div class="history">
          <DataTable caption="Historique des ventes">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Facture</th>
                <th scope="col">Statut</th>
                <th scope="col">Articles</th>
                <th scope="col" class="num">Total</th>
                <th scope="col" class="col-actions"><span class="sr-only">Facture</span></th>
              </tr>
            </thead>
            <tbody>
              {#each sales as s (s.id)}
                <tr>
                  <td>{formatDate(s.date)}</td>
                  <td>
                    {#if s.invoice_number}<a href="/manage/sales?facture={s.id}">{s.invoice_number}</a>{:else}<span class="t-muted">—</span>{/if}
                  </td>
                  <td><StatusBadge status={s.status} /></td>
                  <td class="items">
                    {#each s.sale_item || [] as it, i}
                      {#if i > 0}<span class="t-muted">&nbsp;· </span>{/if}
                      {#if it.wine_vintage_id}
                        {@const v = vintageById.get(it.wine_vintage_id)}
                        <span class="item"><WineDot type={v?.wine?.wine_type} /> {it.quantity} × {vintageShortLabel(v)}<span class="t-muted">&nbsp;· {v?.wine?.winery?.name ?? ""}</span></span>
                      {:else}
                        <span class="item">{it.quantity} × {it.note || "Dégustation"}</span>
                      {/if}
                    {/each}
                  </td>
                  <td class="num">
                    {#if s.status === "cancelled"}<s class="t-muted">{formatEUR(s.total_price)}</s>{:else}<strong>{formatEUR(s.total_price)}</strong>{/if}
                  </td>
                  <td class="col-actions">
                    {#if s.status === "closed"}
                      <IconButton label="Télécharger la facture {s.invoice_number ?? ''}" href="/manage/sales?telecharger={s.id}">
                        <IconDownload size={18} strokeWidth={1.75} />
                      </IconButton>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </DataTable>
        </div>
      {/if}
    </Card>
  {/if}
</ManagePageShell>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Supprimer ce client ?"
  busy={deleting}
  message={customer
    ? `${customer.first_name} ${customer.last_name} sera supprimé de vos clients. ${sales.length ? `Il a ${sales.length} vente(s) : la suppression sera refusée par la base si elles y sont liées.` : "Aucune vente n’est liée à ce client."}`
    : ""}
  onconfirm={deleteCustomer}
/>

<style>
  .top {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 16px;
    margin-bottom: 16px;
  }

  .coords {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 10px 24px;
    margin: 0;
  }

  .coords dt {
    color: var(--ink-2);
  }

  .coords dd {
    margin: 0;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    overflow: hidden;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 16px 18px;
    border-right: 1px solid var(--border-soft);
    border-bottom: 1px solid var(--border-soft);
  }

  .stat:nth-child(3n) {
    border-right: none;
  }

  .stat:nth-child(n + 4) {
    border-bottom: none;
  }

  .stat-v {
    font-family: var(--font-serif);
    font-weight: 600;
    font-size: 24px;
    line-height: 30px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 16px;
  }

  .share-bar {
    display: flex;
    gap: 2px;
    height: 10px;
    border-radius: 999px;
    overflow: hidden;
    background: var(--border-soft);
  }

  .legend {
    list-style: none;
    margin: 12px 0 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 6px 20px;
  }

  .legend li {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .legend li.muted {
    color: var(--ink-2);
  }

  .legend li.muted strong {
    font-weight: 500;
  }

  .fav {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid var(--border-soft);
  }

  .fav p {
    margin: 2px 0 0;
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
    min-height: 52px;
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

  .suggest {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    cursor: pointer;
  }

  .suggest input {
    width: 18px;
    height: 18px;
    accent-color: var(--teal-600);
    flex-shrink: 0;
  }

  .price {
    white-space: nowrap;
  }

  .tile {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: var(--r-sm);
    background: var(--mist);
    color: var(--teal-600);
  }

  .sub-title {
    margin: 16px 0 4px;
  }

  .history {
    margin-top: -4px;
  }

  .history :global(.ui-table-wrap) {
    border: none;
    border-top: 1px solid var(--border-soft);
    border-radius: 0 0 var(--r-md) var(--r-md);
  }

  .items {
    font-size: 13px;
  }

  .item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  @media (max-width: 1000px) {
    .top,
    .grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 767px) {
    .stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .stat:nth-child(3n) {
      border-right: 1px solid var(--border-soft);
    }

    .stat:nth-child(2n) {
      border-right: none;
    }

    .stat:nth-child(n + 4) {
      border-bottom: 1px solid var(--border-soft);
    }

    .stat:nth-child(n + 5) {
      border-bottom: none;
    }
  }
</style>
