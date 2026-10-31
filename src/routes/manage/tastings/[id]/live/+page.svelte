<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { errorMessage } from "$lib/async";
  import { fade } from "svelte/transition";
  import { page } from "$app/stores";
  import type { RealtimeChannel } from "@supabase/supabase-js";
  import { supabase } from "$lib/supabase";
  import { fetchStockMap } from "$lib/manageData";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import Button from "$lib/ui/Button.svelte";
  import IconButton from "$lib/ui/IconButton.svelte";
  import Card from "$lib/ui/Card.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import WineDot from "$lib/ui/WineDot.svelte";
  import {
    IconArrowLeft,
    IconArrowRight,
    IconCheck,
    IconCopy,
    IconExternal,
    IconInbox,
    IconMonitor,
    IconPlay,
    IconUsers,
  } from "$lib/ui/icons";
  import { formatDate, formatEUR } from "$lib/format";
  import { formatTime, isLiveNow, winesRevealed } from "$lib/dates";
  import WineBottle from "$lib/components/site/WineBottle.svelte";
  import Spinner from "$lib/ui/Spinner.svelte";
  import { fetchSeats, fetchTastingWithWines, isParticipantRegistration, onlineSeats, onlineSeatsByCustomer, participantOrigin, placesLabel, tastingTitle, type SeatInfo } from "$lib/publicData";
  import { compareCustomersByLabel, customerDisplayLabel } from "$lib/customerDisplay";
  import { broadcastPosition, joinLiveChannel } from "$lib/live";
  import { qrDataUrl } from "$lib/qr";
  import { swatchStyle, vintageShortLabel, wineRobe, wineStyle, wineSubtitle, wineTitle, wineTypeLabel } from "$lib/wine";
  import { kindInfo } from "$lib/productKinds";
  import {
    confirmRegistration,
    createSaleFromWish,
    setWishStatus,
    wishItems,
    wishTotal,
    type WishRequest,
  } from "$lib/wishes";

  const tastingId = $page.params.id ?? "";

  let tasting = $state<any>(null);
  let wines = $state<any[]>([]);
  let loading = $state(true);
  let error = $state("");
  let actionError = $state("");

  let position = $state(0);
  let channel: RealtimeChannel | null = null;
  let connected = $state(false);
  let guestCount = $state(0);

  let guestUrl = "";
  let qr = $state("");
  let projecting = $state(false);
  let copied = $state(false);

  let feedback = $state.raw<any[]>([]);
  let wishes = $state.raw<WishRequest[]>([]);
  /** Pré-commandes des invités, pas encore confirmées : ni comptées ni transformables en vente. */
  let preorders = $state.raw<any[]>([]);
  let registrations = $state.raw<any[]>([]);
  /** Participants (tasting_customer), triés par nom, avec leurs places hors réservation en ligne. */
  let participants = $state.raw<any[]>([]);
  let busyId = $state("");
  let poll: ReturnType<typeof setInterval> | null = null;
  /* onDestroy peut passer pendant les await d'onMount : on ne crée alors ni canal ni polling. */
  let destroyed = false;

  onMount(async () => {
    const res = await fetchTastingWithWines(tastingId);
    if (destroyed) return;
    tasting = res.tasting;
    wines = res.wineVintages;
    error = res.error || (!tasting ? "Dégustation introuvable." : "");
    loading = false;
    if (!tasting) return;

    /* Soirée terminée : plus de vin « en cours », on parcourt le déroulé sans rien diffuser. */
    position = !finished && typeof tasting.live_position === "number" ? clamp(tasting.live_position) : 0;
    guestUrl = `${window.location.origin}/tastings/${tastingId}/live`;
    qr = await qrDataUrl(guestUrl, { size: 640 });
    if (destroyed) return;

    if (!finished) channel = joinLiveChannel(
      tastingId,
      {
        onStatus: (ok) => {
          connected = ok;
          if (ok && channel) void broadcastPosition(channel, position);
        },
        onSyncRequest: () => channel && void broadcastPosition(channel, position),
        onGuestCount: (n) => (guestCount = n),
      },
      "host",
    );

    await refresh();
    if (destroyed) return;
    /* Pas de rafraîchissement quand l’onglet est caché ; une fois la soirée terminée, rien ne presse. */
    poll = setInterval(() => document.hidden || refresh(), finished ? 60_000 : 8000);
  });

  onDestroy(() => {
    destroyed = true;
    if (channel) void supabase.removeChannel(channel);
    if (poll) clearInterval(poll);
  });

  function clamp(p: number): number {
    return Math.max(0, Math.min(Math.max(0, wines.length - 1), p));
  }

  async function setPosition(p: number) {
    const next = clamp(p);
    if (next === position) return;
    position = next;
    if (finished) return;
    if (channel) void broadcastPosition(channel, position);
    const { error: e } = await supabase.from("tasting").update({ live_position: position }).eq("id", tastingId);
    if (e) console.warn("live_position non enregistrée :", e.message);
  }

  /** Places prises (participants et réservations en ligne, comptés par la base). */
  let seats = $state<SeatInfo | null>(null);
  /** null : stock illisible (affiché « indisponible » plutôt qu'en rupture). */
  let stockMap = $state.raw<Map<string, number> | null>(new Map());
  /** Ventes rattachées à cette dégustation (sale.tasting_id). */
  let eveningSales = $state.raw<any[]>([]);

  async function refresh() {
    await Promise.all([
      (async () => {
        const { data } = await supabase
          .from("sale")
          .select("id, status, total_price, customer_id, sale_item ( wine_vintage_id, quantity )")
          .eq("tasting_id", tastingId);
        eveningSales = ((data || []) as any[]).filter((x) => x.status !== "cancelled");
      })(),
      (async () => {
        seats = await fetchSeats(tastingId);
      })(),
      (async () => {
        const ids = wines.map((w) => w.id);
        if (!ids.length) return;
        stockMap = await fetchStockMap(ids).catch(() => null);
      })(),
      (async () => {
        const { data } = await supabase
          .from("tasting_feedback")
          .select("*")
          .eq("tasting_id", tastingId)
          .order("created_at", { ascending: true });
        feedback = data || [];
      })(),
      (async () => {
        const { data } = await supabase
          .from("wish_request")
          .select("*")
          .eq("tasting_id", tastingId)
          .order("created_at", { ascending: false });
        wishes = (data || []) as unknown as WishRequest[];
      })(),
      (async () => {
        const { data, error: e } = await supabase
          .from("live_preorder")
          .select("*")
          .eq("tasting_id", tastingId)
          .order("updated_at", { ascending: false });
        if (e) return;
        preorders = data;
      })(),
      (async () => {
        const { data, error: e } = await supabase
          .from("tasting_registration")
          .select("*")
          .eq("tasting_id", tastingId)
          .order("created_at", { ascending: true });
        /* Un relevé raté ne fait pas passer les inscrits du site pour des ajouts à la main. */
        if (e) return;
        registrations = data;
      })(),
      (async () => {
        const { data, error: e } = await supabase
          .from("tasting_customer")
          .select("seats, customer ( id, first_name, last_name, company_name, email, phone_number )")
          .eq("tasting_id", tastingId);
        /* Un relevé raté garde la liste précédente plutôt que d'afficher « Aucun participant ». */
        if (e) return;
        participants = data
          .filter((r) => r.customer)
          .map((r) => ({ ...r.customer!, seats: r.seats }))
          .sort(compareCustomersByLabel);
      })(),
    ]);
  }

  /* Dernière note par (invité, vin). */
  let latest = $derived((() => {
    const map = new Map<string, any>();
    for (const f of feedback) map.set(`${f.guest_id}:${f.wine_vintage_id}`, f);
    return [...map.values()];
  })());

  /* Bouteilles demandées par vin (demandes non écartées). */
  let wantedByWine = $derived((() => {
    const m = new Map<string, number>();
    for (const w of wishes) {
      if (w.status === "dismissed") continue;
      for (const i of wishItems(w.items)) m.set(i.wine_vintage_id, (m.get(i.wine_vintage_id) ?? 0) + i.quantity);
    }
    return m;
  })());

  let stats = $derived(new Map(
    wines.map((w) => {
      const rated = latest.filter((f) => f.wine_vintage_id === w.id && f.rating);
      const avg = rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : null;
      return [w.id, { avg, count: rated.length, wanted: wantedByWine.get(w.id) ?? 0 }];
    }),
  ));

  let comments = $derived(latest
    .filter((f) => f.comment)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 12));

  let prices = $derived(new Map(wines.map((w) => [w.id, Number(w.price ?? 0)])));
  let wineById = $derived(new Map(wines.map((w) => [w.id, w])));
  let seatsOnline = $derived(onlineSeats(registrations));
  let seatsByCustomer = $derived(onlineSeatsByCustomer(registrations));
  /* Les réservations confirmées et rattachées à un participant figurent déjà dans sa carte. */
  let participantIds = $derived(new Set(participants.map((c) => c.id)));
  let pendingRegistrations = $derived(
    registrations.filter((r) => !isParticipantRegistration(r) || !participantIds.has(r.customer_id)),
  );

  let current = $derived(wines[position]);
  let style = $derived(wineStyle(current?.wine?.wine_type));
  /** « Vin 3 », « Huile d’olive 4 » : le produit servi. */
  let currentLabel = $derived(kindInfo(current?.wine).label);

  async function makeSale(w: WishRequest) {
    actionError = "";
    busyId = w.id;
    try {
      await createSaleFromWish(w, prices, tastingTitle(tasting));
      await refresh();
    } catch (e) {
      actionError = errorMessage(e);
    } finally {
      busyId = "";
    }
  }

  async function dismiss(w: WishRequest) {
    busyId = w.id;
    try {
      await setWishStatus(w.id, "dismissed");
      await refresh();
    } catch (e) {
      actionError = errorMessage(e);
    } finally {
      busyId = "";
    }
  }

  async function confirmRow(r: any) {
    actionError = "";
    busyId = r.id;
    try {
      await confirmRegistration(r.id);
      await refresh();
    } catch (e) {
      actionError = errorMessage(e);
    } finally {
      busyId = "";
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(guestUrl);
    copied = true;
    setTimeout(() => (copied = false), 1500);
  }

  function onKey(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    /* Soirée terminée : plus de service à faire avancer, l’espace refait défiler la page. */
    if (finished) return;
    if (e.key === "ArrowRight" || e.key === " ") {
      e.preventDefault();
      void setPosition(position + 1);
    }
    if (e.key === "ArrowLeft") void setPosition(position - 1);
    if (e.key === "Escape") projecting = false;
  }

  /* ——— Interface (refonte) ——— */
  let activeWishes = $derived(wishes.filter((w) => w.status !== "dismissed"));
  let soldBottles = $derived(eveningSales.reduce(
    (n, x) => n + (x.sale_item || []).filter((i: any) => i.wine_vintage_id).reduce((m: number, i: any) => m + (i.quantity || 0), 0),
    0,
  ));
  let soldAmount = $derived(eveningSales.reduce((n, x) => n + Number(x.total_price || 0), 0));
  let soldByWine = $derived((() => {
    const m = new Map<string, number>();
    for (const x of eveningSales) for (const i of x.sale_item || []) if (i.wine_vintage_id) m.set(i.wine_vintage_id, (m.get(i.wine_vintage_id) ?? 0) + (i.quantity || 0));
    return m;
  })());
  let orderedBottles = $derived(activeWishes.flatMap((w) => wishItems(w.items)).reduce((n, i) => n + i.quantity, 0));
  let currentOrdered = $derived(current ? (stats.get(current.id)?.wanted ?? 0) : 0);
  /* Absent de la vue : aucun mouvement, donc 0 bouteille (et non « inconnu »). */
  let currentStock = $derived(current && stockMap ? (stockMap.get(current.id) ?? 0) : null);
  let isLiveDay = $derived(tasting ? isLiveNow(tasting.date) : false);
  /** Lendemain 6 h passé : la soirée n'est plus pilotée (cf. vue invité). */
  let finished = $derived(tasting ? winesRevealed(tasting.date) : false);
  let headerSubtitle = $derived(tasting
    ? [formatDate(tasting.date), tasting.location, tasting.start_time ? `${isLiveDay ? "depuis" : "à"} ${formatTime(tasting.start_time)}` : ""].filter(Boolean).join(" · ")
    : "");
  function wishFor(w: { items: unknown }, vintageId: string): number {
    return wishItems(w.items).filter((i) => i.wine_vintage_id === vintageId).reduce((n, i) => n + i.quantity, 0);
  }
  function wishBottles(w: { items: unknown }): number {
    return wishItems(w.items).reduce((n, i) => n + i.quantity, 0);
  }
</script>

<svelte:window onkeydown={onKey} />

<svelte:head>
  <title>Piloter la dégustation - Gestion</title>
</svelte:head>

<!-- Visible aussi sans produit au programme : les réservations arrivent bien avant la soirée. -->
{#snippet peopleCards()}
  <Card title="Participants">
    {#snippet actions()}
      <a class="edit-link" href="/manage/tastings?id={tastingId}">Modifier</a>
    {/snippet}
    {#if participants.length === 0}
      <EmptyState icon={IconUsers} title="Aucun participant" text="Les réservations faites sur le site s’ajoutent ici toutes seules." compact />
    {:else}
      <ul class="list">
        {#each participants as c (c.id)}
          {@const contact = [c.email, c.phone_number].filter(Boolean).join(" · ")}
          <li>
            <span class="list-main">
              <strong>{customerDisplayLabel(c)}</strong>
              {#if contact}<span class="t-caption">{contact}</span>{/if}
            </span>
            <span class="t-caption">{participantOrigin(seatsByCustomer.get(c.id), c.seats)}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </Card>
  {#if pendingRegistrations.length}
    <Card title="Réservations en ligne" id="registrations">
      <ul class="list">
        {#each pendingRegistrations as r (r.id)}
          <li>
            <span class="list-main">
              <strong>{r.first_name} {r.last_name || ""}</strong>
              <span class="t-caption">{placesLabel(r.seats)}{r.status === "waitlist" ? " · liste d’attente" : r.status === "cancelled" ? " · annulée" : ""}</span>
            </span>
            <Button size="sm" variant="ghost" disabled={busyId === r.id} onclick={() => confirmRow(r)}>
              {r.status === "waitlist" ? "Confirmer" : r.status === "cancelled" ? "Rétablir" : "Ajouter aux participants"}
            </Button>
          </li>
        {/each}
      </ul>
    </Card>
  {/if}
{/snippet}

<div class="pilot" class:has-wines={wines.length > 0}>
  <ManagePageShell
    title={tasting ? tastingTitle(tasting) : "Piloter la dégustation"}
    subtitle={headerSubtitle}
    back={{ href: "/manage/tastings", label: "Dégustations" }}
  >
    {#snippet badge()}
        {#if tasting && isLiveDay}
          <span class="live-badge" class:off={!connected}>
            <span class="dot" aria-hidden="true"></span>{connected ? "En direct" : "Connexion…"}
          </span>
        {/if}
      {/snippet}
    {#snippet actions()}
        {#if tasting}
          <Button variant="ghost" href="/tastings/{tastingId}/live" target="_blank" rel="noopener noreferrer">
            <IconExternal size={16} strokeWidth={1.75} /> Vue invité
          </Button>
          {#if !finished}
            <Button variant="ghost" onclick={() => (projecting = true)}>
              <IconMonitor size={16} strokeWidth={1.75} /> Projeter le visuel
            </Button>
          {/if}
        {/if}
      {/snippet}

    {#if actionError}<div class="error-message" role="alert">{actionError}</div>{/if}
    {#if loading}
      <Spinner />
    {:else if error}
      <div class="error-message" role="alert">{error}</div>
    {:else if wines.length === 0}
      <div class="empty-stack">
        <Card>
          <EmptyState icon={IconPlay} title="Rien au déroulé" text="Ajoutez des produits à cette dégustation pour la piloter.">
            <Button href="/manage/tastings?id={tastingId}">Modifier la dégustation</Button>
          </EmptyState>
        </Card>
        {@render peopleCards()}
      </div>
    {:else}

      <section class="band" aria-label="La soirée en chiffres">
        <div class="band-item">
          <span class="t-caption">Places prises</span>
          <span class="band-v">{seats?.seats_taken ?? "—"}{#if seats?.capacity != null}<small> / {seats.capacity}</small>{/if}{#if seatsOnline}<small> · {seatsOnline} en ligne</small>{/if}</span>
        </div>
        <div class="band-item">
          <span class="t-caption">Bouteilles vendues</span>
          <span class="band-v">{soldBottles} bt.{#if orderedBottles}<small> · {orderedBottles} demandées</small>{/if}</span>
        </div>
        <a class="band-item band-link" href="/manage/sales?degustation={tastingId}">
          <span class="t-caption">Ventes de la soirée</span>
          <span class="band-v">{formatEUR(soldAmount)}<small> · {eveningSales.length} vente{eveningSales.length > 1 ? "s" : ""}</small></span>
        </a>
        <div class="band-item">
          <span class="t-caption">Progression</span>
          {#if finished}
            <span class="band-v">Terminée <small>· {wines.length} au déroulé</small></span>
          {:else}
            <span class="band-v">{currentLabel} {position + 1} <small>sur {wines.length}</small></span>
          {/if}
        </div>
      </section>

      <div class="layout">
        <div class="side">
          <Card title="Déroulé" id="deroule">
            {#snippet actions()}
                                <a class="edit-link" href="/manage/tastings?id={tastingId}">Modifier</a>
                              {/snippet}
            <ol class="steps">
              {#each wines as w, i (w.id)}
                {@const st = stats.get(w.id)}
                <li>
                  <button type="button" class="step" class:current={i === position} aria-current={i === position ? (finished ? "true" : "step") : undefined} onclick={() => setPosition(i)}>
                    <span class="step-num">{i + 1}</span>
                    <WineDot type={w.wine?.wine_type} />
                    <span class="step-main">
                      <strong>{vintageShortLabel(w)}</strong>
                      <span class="t-caption">
                        {w.wine?.winery?.name ?? ""}{soldByWine.get(w.id) ? ` · ${soldByWine.get(w.id)} bt. vendues` : ""}{st?.wanted ? ` · ${st.wanted} demandées` : ""}{st?.avg != null ? ` · ★ ${st.avg.toFixed(1)}` : ""}
                      </span>
                    </span>
                    <!-- Soirée terminée : ni servi ni en cours, la ligne surlignée est juste celle consultée. -->
                    {#if !finished}
                      {#if i < position}
                        <span class="step-badge done"><IconCheck size={13} strokeWidth={2} aria-hidden="true" /> Servi</span>
                      {:else if i === position}
                        <span class="step-badge is-now"><IconPlay size={12} strokeWidth={2} aria-hidden="true" /> En cours</span>
                      {/if}
                    {/if}
                  </button>
                </li>
              {/each}
            </ol>
          </Card>

          <Card title="Invités" id="invites">
            {#snippet actions()}
                                {#if !finished}<span class="t-caption"><IconUsers size={14} strokeWidth={1.75} aria-hidden="true" /> {guestCount} connecté{guestCount > 1 ? "s" : ""}</span>{/if}
                              {/snippet}
            <div class="qr-row">
              {#if qr}<img src={qr} alt="QR code vers la vue invité" class="qr" />{/if}
              <div class="qr-text">
                <p class="t-caption">Les invités scannent ce code pour suivre la soirée, noter les vins et commander.</p>
                <Button size="sm" onclick={copyLink}>
                  {#if copied}<IconCheck size={14} strokeWidth={1.75} /> Lien copié{:else}<IconCopy size={14} strokeWidth={1.75} /> Copier le lien{/if}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div class="main">
          <section class="now" aria-labelledby="now-title" aria-live="polite">
            <span class="bottle" style={swatchStyle(wineRobe(current?.wine?.wine_type))} aria-hidden="true"></span>
            <div class="now-text">
              <span class="now-eyebrow">{currentLabel} {position + 1} · {wineTypeLabel(current?.wine?.wine_type)}</span>
              <h2 id="now-title" class="now-title">{vintageShortLabel(current)}</h2>
              <p>{current.wine?.winery?.name ?? ""}{current.price ? " · " : ""}{#if current.price}<strong>{formatEUR(current.price)}</strong> la bouteille{/if}</p>
              <p class="t-caption">
                Stock : <strong>{currentStock == null ? "indisponible" : `${currentStock} bt.`}</strong> · vendues {finished ? "à la soirée" : "ce soir"} : <strong>{soldByWine.get(current.id) ?? 0} bt.</strong>{#if currentOrdered} · demandées : <strong>{currentOrdered} bt.</strong>{/if}
              </p>
            </div>
            <div class="now-actions">
              <Button size="lg" onclick={() => setPosition(position - 1)} disabled={position === 0}>
                <IconArrowLeft size={18} strokeWidth={1.75} /> Précédent
              </Button>
              <Button size="lg" variant="primary" onclick={() => setPosition(position + 1)} disabled={position === wines.length - 1}>
                Suivant <IconArrowRight size={18} strokeWidth={1.75} />
              </Button>
            </div>
          </section>

          <Card title="Commandes des participants" id="orders" padded={false}>
            {#snippet actions()}
                                {#if !finished}<span class="t-caption">Flèches ← → ou espace pour avancer</span>{/if}
                              {/snippet}
            {#if wishes.length === 0 && preorders.length === 0}
              <EmptyState icon={IconInbox} title="Aucune commande pour l’instant" text="Les invités commandent depuis leur téléphone (« J’en veux »)." compact />
            {:else}
              <div class="orders-wrap">
                <table class="ui-table">
                  <thead>
                    <tr>
                      <th scope="col">Participant</th>
                      <th scope="col" class="num">{vintageShortLabel(current)}</th>
                      <th scope="col" class="num">Total de la soirée</th>
                      <th scope="col" class="col-actions"><span class="sr-only">Action</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each wishes as w (w.id)}
                      <tr class:muted-row={w.status !== "new"}>
                        <td>
                          <strong>{w.first_name} {w.last_name || ""}</strong>
                          <span class="t-caption block">{[w.email, w.phone].filter(Boolean).join(" · ")}</span>
                          {#if w.message}<span class="t-caption block">« {w.message} »</span>{/if}
                        </td>
                        <td class="num">{wishFor(w, current.id) || "—"}</td>
                        <td class="num"><span class="t-muted">{wishBottles(w)} bt.</span> <strong>{formatEUR(wishTotal(w, prices))}</strong></td>
                        <td class="col-actions">
                          {#if w.status === "new"}
                            <span class="order-actions">
                              <Button size="sm" disabled={busyId === w.id} onclick={() => makeSale(w)}>{busyId === w.id ? "…" : "Créer la vente"}</Button>
                              <Button size="sm" variant="ghost" disabled={busyId === w.id} onclick={() => dismiss(w)}>Ignorer</Button>
                            </span>
                          {:else if w.sale_id}
                            <a href="/manage/sales?statut=pending" class="t-caption">Vente créée</a>
                          {:else}
                            <span class="t-caption">Ignorée</span>
                          {/if}
                        </td>
                      </tr>
                    {/each}
                    {#each preorders as p (p.guest_id)}
                      <tr class="muted-row">
                        <td>
                          <strong>{p.first_name || "Invité"} {p.last_name || ""}</strong>
                          <span class="t-caption block">{[p.email, p.phone].filter(Boolean).join(" · ")}</span>
                        </td>
                        <td class="num">{wishFor(p, current.id) || "—"}</td>
                        <td class="num"><span class="t-muted">{wishBottles(p)} bt.</span> <strong>{formatEUR(wishTotal(p, prices))}</strong></td>
                        <td class="col-actions"><span class="t-caption">Pré-commande, pas encore confirmée</span></td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          </Card>

          {@render peopleCards()}

          {#if comments.length}
            <Card title="Ce qu’ils en disent" id="comments">
              <ul class="list">
                {#each comments as c (c.id)}
                  <li>
                    <span class="list-main">
                      <span>« {c.comment} »</span>
                      <span class="t-caption">{c.guest_name || "Invité"} · {vintageShortLabel(wineById.get(c.wine_vintage_id))}{c.rating ? ` · ${"★".repeat(c.rating)}` : ""}</span>
                    </span>
                  </li>
                {/each}
              </ul>
            </Card>
          {/if}
        </div>
      </div>

      <!-- Barre fixe (mobile) -->
      <div class="mobile-next">
        <IconButton label="Précédent" variant="outline" disabled={position === 0} onclick={() => setPosition(position - 1)}>
          <IconArrowLeft size={20} strokeWidth={1.75} />
        </IconButton>
        <button type="button" class="next-btn" disabled={position === wines.length - 1} onclick={() => setPosition(position + 1)}>
          {position === wines.length - 1 ? "Dernier de la dégustation" : `Suivant : ${vintageShortLabel(wines[position + 1])}`}
          <IconArrowRight size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    {/if}
  </ManagePageShell>
</div>

{#if projecting && current}
  <div class="projection" style="--robe: {style.color}; --robe-light: {style.light};" transition:fade={{ duration: 200 }}>
    <button type="button" class="proj-close" onclick={() => (projecting = false)} aria-label="Quitter la projection">×</button>
    <div class="proj-qr">
      {#if qr}<img src={qr} alt="QR code" />{/if}
      <p>Scannez pour suivre la soirée,<br />noter les vins et commander.</p>
    </div>
    <div class="proj-wine">
      {#key position}
        <div class="proj-inner" in:fade={{ duration: 400 }}>
          <span class="proj-num">{currentLabel} {position + 1} <span>/ {wines.length}</span></span>
          <h1>{wineTitle(current.wine)}</h1>
          {#if wineSubtitle(current.wine)}<p class="proj-sub">{wineSubtitle(current.wine)}</p>{/if}
          <p class="proj-winery">{current.wine?.winery?.name}{current.year ? ` · ${current.year}` : ""}</p>
        </div>
      {/key}
      <WineBottle src={current.image_url} alt="" wine={style} height="58vh" />
    </div>
    <div class="proj-dots">
      {#each wines as w, i}
        <span class:active={i === position} style="--c: {wineStyle(w.wine?.wine_type).color}"></span>
      {/each}
    </div>
  </div>
{/if}

<style>
  .live-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 26px;
    padding: 0 12px;
    border-radius: var(--r-pill);
    background: var(--night);
    color: #fff;
    font-size: 12px;
    font-weight: 600;
  }

  .live-badge .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #7fd1a0;
    box-shadow: 0 0 0 0 rgba(127, 209, 160, 0.6);
    animation: live 1.8s ease-out infinite;
  }

  .live-badge.off {
    background: var(--st-closed-bg);
    color: var(--st-closed-fg);
  }

  .live-badge.off .dot {
    background: #9aa29e;
    animation: none;
  }

  @keyframes live {
    to {
      box-shadow: 0 0 0 8px rgba(127, 209, 160, 0);
    }
  }

  .band {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    margin-bottom: 16px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    overflow: hidden;
  }

  .band-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 14px 20px;
    border-right: 1px solid var(--border-soft);
  }

  .band-item:last-child {
    border-right: none;
  }

  .band-v {
    font-family: var(--font-serif);
    font-weight: 600;
    font-size: 24px;
    line-height: 30px;
  }

  .band-link {
    color: inherit;
    text-decoration: none;
  }

  .band-link:hover {
    background: var(--row-hover);
  }

  .band-v small {
    font-size: 15px;
    font-weight: 400;
    color: var(--ink-2);
  }

  .layout {
    display: grid;
    grid-template-columns: minmax(260px, 0.42fr) minmax(0, 1fr);
    gap: 16px;
    align-items: start;
  }

  .empty-stack,
  .side,
  .main {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }

  .edit-link {
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
  }

  .steps {
    list-style: none;
    margin: 0 -8px;
    padding: 0;
  }

  .step {
    display: grid;
    grid-template-columns: 20px 10px minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 56px;
    padding: 8px;
    border: 1px solid transparent;
    border-radius: var(--r-md);
    background: none;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .step:hover {
    background: var(--row-hover);
  }

  .step.current {
    background: var(--mist);
    border-color: #b9d0cd;
  }

  .step-num {
    font-family: var(--font-serif);
    font-size: 16px;
    color: var(--ink-2);
    text-align: center;
  }

  .step-main {
    display: flex;
    flex-direction: column;
    line-height: 18px;
    min-width: 0;
  }

  .step-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 24px;
    padding: 0 10px;
    border-radius: var(--r-pill);
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
  }

  .step-badge.done {
    background: var(--st-closed-bg);
    color: var(--st-closed-fg);
  }

  .step-badge.is-now {
    background: var(--night);
    color: #fff;
  }

  .qr-row {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }

  .qr {
    width: 112px;
    height: 112px;
    image-rendering: pixelated;
    border-radius: var(--r-sm);
    border: 1px solid var(--border-soft);
    background: #fff;
  }

  .qr-text {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }

  .qr-text p {
    margin: 0;
  }

  .now {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 20px;
    align-items: center;
    padding: 20px 24px;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: var(--r-md);
  }

  /* Silhouette de bouteille à la couleur de la robe. */
  .bottle {
    width: 64px;
    height: 96px;
    border-radius: 32px 32px 8px 8px;
    background: #9aa29e;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
  }

  .now-eyebrow {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-2);
  }

  .now-title {
    margin: 2px 0 4px;
    font-family: var(--font-serif);
    font-weight: 600;
    font-size: 28px;
    line-height: 34px;
    color: var(--title);
  }

  .now-text p {
    margin: 2px 0 0;
  }

  .now-actions {
    display: flex;
    gap: 10px;
  }

  .orders-wrap {
    overflow-x: auto;
    border-top: 1px solid var(--border-soft);
  }

  .block {
    display: block;
  }

  .muted-row {
    opacity: 0.6;
  }

  .order-actions {
    display: inline-flex;
    gap: 4px;
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
    min-height: 48px;
    padding: 6px 0;
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

  .mobile-next {
    display: none;
  }

  @media (max-width: 1100px) {
    .layout {
      grid-template-columns: 1fr;
    }

    .now {
      grid-template-columns: auto minmax(0, 1fr);
    }

    .now-actions {
      grid-column: 1 / -1;
    }
  }

  /* ——— Mobile : en-tête sombre, pastilles numérotées, barre fixe « Vin suivant » ——— */
  @media (max-width: 767px) {
    .pilot {
      --page-head-bg: var(--night);
      --page-head-border: none;
      --page-head-fg: #fff;
      --page-head-muted: rgba(255, 255, 255, 0.8);
    }

    /* Boutons de l'en-tête (contenu de la page, rendu par Button) : blancs, survol compris. */
    .pilot :global(.page-head .btn--ghost),
    .pilot :global(.page-head .btn--ghost:hover) {
      color: #fff;
    }

    .band {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      margin: -16px -16px 16px;
      border-radius: 0;
      border: none;
      background: var(--night);
      color: #fff;
    }

    .band-item {
      border-right: none;
      padding: 0 16px 16px;
    }

    .band-item:last-child {
      display: none;
    }

    .band-item :global(.t-caption) {
      color: rgba(255, 255, 255, 0.75);
    }

    .band-v {
      font-family: var(--font-sans);
      font-size: 18px;
      font-weight: 700;
    }

    .band-v small {
      display: none;
    }

    /* Les cartes de la colonne latérale rejoignent le flux : déroulé, vin en cours…, invités en bas. */
    .side {
      display: contents;
    }

    .side :global(#deroule) {
      order: 0;
    }

    .main {
      order: 1;
    }

    .qr-row {
      flex-wrap: wrap;
    }

    .main :global(#orders .card-actions) {
      display: none;
    }

    .layout {
      display: flex;
      flex-direction: column;
    }

    /* Déroulé → pastilles numérotées */
    .side :global(#deroule) {
      padding: 0;
      background: none;
      border: none;
    }

    .side :global(#deroule .card-head) {
      display: none;
    }

    .steps {
      display: flex;
      gap: 10px;
      margin: 0;
      overflow-x: auto;
    }

    .step {
      display: grid;
      grid-template-columns: 1fr;
      place-items: center;
      width: 44px;
      min-width: 44px;
      height: 44px;
      min-height: 44px;
      padding: 0;
      border-radius: 50%;
      border: 1px solid var(--btn-border);
      background: #fff;
    }

    .step > :global(*:not(.step-num)) {
      display: none;
    }

    .step-num {
      color: var(--ink);
    }

    .step.current {
      background: var(--teal-600);
      border-color: var(--teal-600);
    }

    .step.current .step-num {
      color: #fff;
    }

    .side :global(#invites) {
      order: 2;
    }

    .now {
      grid-template-columns: auto minmax(0, 1fr);
      padding: 14px 16px;
      gap: 14px;
    }

    .bottle {
      width: 40px;
      height: 60px;
    }

    .now-title {
      font-size: 22px;
      line-height: 28px;
    }

    .now-actions {
      display: none;
    }

    .pilot.has-wines :global(.page-content) {
      padding-bottom: 96px;
    }

    .mobile-next {
      display: flex;
      gap: 10px;
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 450;
      padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
      background: var(--card);
      border-top: 1px solid var(--border);
    }

    .next-btn {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 52px;
      padding: 0 16px;
      border: none;
      border-radius: var(--r-sm);
      background: var(--teal-600);
      color: #fff;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .next-btn:disabled {
      opacity: 0.5;
    }
  }

  /* ——— Projection (TV / vidéoprojecteur) ——— */
  .projection {
    position: fixed;
    inset: 0;
    z-index: 2000;
    display: grid;
    grid-template-columns: minmax(16rem, 0.7fr) 1.6fr;
    align-items: center;
    gap: 4vw;
    padding: 5vh 5vw;
    background:
      radial-gradient(ellipse 60% 60% at 75% 60%, color-mix(in srgb, var(--robe) 40%, transparent), transparent 70%),
      var(--mz-cave-bg);
    color: var(--mz-cave-text);
    font-family: var(--mz-font-body);
    transition: background 0.8s ease;
  }

  .proj-close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: var(--mz-cave-text);
    font-size: 1.5rem;
    cursor: pointer;
  }

  .proj-qr {
    text-align: center;
  }

  .proj-qr img {
    width: 100%;
    max-width: 22rem;
    border-radius: 18px;
    background: white;
    padding: 0.75rem;
  }

  .proj-qr p {
    font-size: 1.4rem;
    line-height: 1.4;
    color: var(--mz-cave-muted);
  }

  .proj-wine {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 3vw;
  }

  .proj-num {
    font-size: 1.6rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--mz-cave-muted);
  }

  .proj-num span {
    opacity: 0.6;
  }

  .proj-wine h1 {
    margin: 1rem 0;
    font-family: var(--mz-font-display);
    font-weight: 500;
    font-size: clamp(3rem, 6vw, 6.5rem);
    line-height: 1;
  }

  .proj-sub,
  .proj-winery {
    margin: 0.3rem 0;
    font-size: clamp(1.3rem, 2vw, 2rem);
    color: var(--mz-cave-muted);
  }

  .proj-winery {
    color: var(--mz-cave-text);
  }

  .proj-dots {
    position: absolute;
    bottom: 4vh;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 0.8rem;
  }

  .proj-dots span {
    width: 1rem;
    height: 1rem;
    border-radius: 50%;
    border: 2px solid var(--c);
    transition: all 0.3s ease;
  }

  .proj-dots span.active {
    background: var(--c);
    transform: scale(1.4);
  }

</style>
