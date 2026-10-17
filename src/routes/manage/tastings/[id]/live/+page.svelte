<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { fade } from "svelte/transition";
  import { page } from "$app/stores";
  import type { RealtimeChannel } from "@supabase/supabase-js";
  import { supabase } from "$lib/supabase";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import WineBottle from "$lib/components/site/WineBottle.svelte";
  import GlassProgress from "$lib/components/site/GlassProgress.svelte";
  import StarRating from "$lib/components/site/StarRating.svelte";
  import { fetchTastingWithWines, tastingTitle } from "$lib/publicData";
  import { broadcastPosition, joinLiveChannel } from "$lib/live";
  import { hasColumn, hasTable } from "$lib/features";
  import { qrDataUrl } from "$lib/qr";
  import { formatDateLong } from "$lib/dates";
  import { formatEur, wineStyle, wineSubtitle, wineTitle } from "$lib/wine";
  import {
    confirmRegistrationAsGuest,
    createSaleFromWish,
    setWishStatus,
    wishItems,
    type WishRequest,
  } from "$lib/wishes";

  const tastingId = $page.params.id ?? "";

  let tasting: any = null;
  let wines: any[] = [];
  let loading = true;
  let error = "";
  let actionError = "";

  let position = 0;
  let channel: RealtimeChannel | null = null;
  let connected = false;
  let guestCount = 0;
  let canPersist = false;

  let guestUrl = "";
  let qr = "";
  let projecting = false;
  let copied = false;

  /* Tables optionnelles (migration). */
  let hasFeedback = false;
  let hasWishes = false;
  let hasRegistrations = false;
  let feedback: any[] = [];
  let wishes: WishRequest[] = [];
  let registrations: any[] = [];
  let busyId = "";
  let poll: ReturnType<typeof setInterval> | null = null;

  onMount(async () => {
    const res = await fetchTastingWithWines(tastingId);
    tasting = res.tasting;
    wines = res.wineVintages;
    error = res.error || (!tasting ? "Dégustation introuvable." : "");
    loading = false;
    if (!tasting) return;

    position = typeof tasting.live_position === "number" ? clamp(tasting.live_position) : 0;
    guestUrl = `${window.location.origin}/tastings/${tastingId}/live`;
    qr = await qrDataUrl(guestUrl, { size: 640 });

    channel = joinLiveChannel(
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

    [canPersist, hasFeedback, hasWishes, hasRegistrations] = await Promise.all([
      hasColumn("tasting", "live_position"),
      hasTable("tasting_feedback"),
      hasTable("wish_request"),
      hasTable("tasting_registration"),
    ]);
    await refresh();
    poll = setInterval(refresh, 8000);
  });

  onDestroy(() => {
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
    if (channel) void broadcastPosition(channel, position);
    if (canPersist) {
      const { error: e } = await supabase.from("tasting").update({ live_position: position }).eq("id", tastingId);
      if (e) console.warn("live_position non enregistrée :", e.message);
    }
  }

  async function refresh() {
    const jobs: Promise<void>[] = [];
    if (hasFeedback) {
      jobs.push(
        (async () => {
          const { data } = await supabase
            .from("tasting_feedback")
            .select("*")
            .eq("tasting_id", tastingId)
            .order("created_at", { ascending: true });
          feedback = data || [];
        })(),
      );
    }
    if (hasWishes) {
      jobs.push(
        (async () => {
          const { data } = await supabase
            .from("wish_request")
            .select("*")
            .eq("tasting_id", tastingId)
            .order("created_at", { ascending: false });
          wishes = (data || []) as unknown as WishRequest[];
        })(),
      );
    }
    if (hasRegistrations) {
      jobs.push(
        (async () => {
          const { data } = await supabase
            .from("tasting_registration")
            .select("*")
            .eq("tasting_id", tastingId)
            .order("created_at", { ascending: true });
          registrations = data || [];
        })(),
      );
    }
    await Promise.all(jobs);
  }

  /* Dernière note par (invité, vin). */
  $: latest = (() => {
    const map = new Map<string, any>();
    for (const f of feedback) map.set(`${f.guest_id}:${f.wine_vintage_id}`, f);
    return [...map.values()];
  })();

  $: stats = new Map(
    wines.map((w) => {
      const rows = latest.filter((f) => f.wine_vintage_id === w.id);
      const rated = rows.filter((r) => r.rating);
      const avg = rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : null;
      const wanted = wishes
        .filter((x) => x.status !== "dismissed")
        .flatMap((x) => wishItems(x.items))
        .filter((i) => i.wine_vintage_id === w.id)
        .reduce((s, i) => s + i.quantity, 0);
      return [w.id, { avg, count: rated.length, wanted }];
    }),
  );

  $: comments = latest
    .filter((f) => f.comment)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 12);

  $: prices = new Map(wines.map((w) => [w.id, Number(w.price ?? 0)]));
  $: wineById = new Map(wines.map((w) => [w.id, w]));
  $: newWishes = wishes.filter((w) => w.status === "new");
  $: confirmedSeats = registrations.filter((r) => r.status === "confirmed").reduce((s, r) => s + r.seats, 0);

  $: current = wines[position];
  $: style = wineStyle(current?.wine?.wine_type);

  async function makeSale(w: WishRequest) {
    actionError = "";
    busyId = w.id;
    try {
      await createSaleFromWish(w, prices, tastingTitle(tasting));
      await refresh();
    } catch (e) {
      actionError = e instanceof Error ? e.message : String(e);
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
      actionError = e instanceof Error ? e.message : String(e);
    } finally {
      busyId = "";
    }
  }

  async function addAsGuest(r: any) {
    actionError = "";
    busyId = r.id;
    try {
      await confirmRegistrationAsGuest(r);
      await refresh();
    } catch (e) {
      actionError = e instanceof Error ? e.message : String(e);
    } finally {
      busyId = "";
    }
  }

  async function addAllRegistrations() {
    for (const r of registrations.filter((r) => r.status === "confirmed" && !r.customer_id)) {
      await addAsGuest(r);
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
    if (e.key === "ArrowRight" || e.key === " ") {
      e.preventDefault();
      void setPosition(position + 1);
    }
    if (e.key === "ArrowLeft") void setPosition(position - 1);
    if (e.key === "Escape") projecting = false;
  }

  function wishTotal(w: WishRequest): number {
    return wishItems(w.items).reduce((s, i) => s + i.quantity * (prices.get(i.wine_vintage_id) ?? 0), 0);
  }
</script>

<svelte:window on:keydown={onKey} />

<svelte:head>
  <title>Piloter la dégustation - Gestion</title>
</svelte:head>

<ManagePageShell title={tasting ? `En direct — ${tastingTitle(tasting)}` : "Piloter la dégustation"}>
  <svelte:fragment slot="actions">
    <a href="/manage/tastings" class="btn-secondary">← Dégustations</a>
    {#if tasting}
      <a href="/tastings/{tastingId}/live" class="btn-secondary" target="_blank" rel="noopener noreferrer">Vue invité ↗</a>
      <button type="button" class="btn-primary" on:click={() => (projecting = true)}>Mode projection</button>
    {/if}
  </svelte:fragment>

  {#if loading}
    <div class="loading">Chargement…</div>
  {:else if error}
    <div class="error-message">{error}</div>
  {:else if wines.length === 0}
    <div class="empty-state"><p>Ajoutez des vins à cette dégustation pour la piloter.</p></div>
  {:else}
    {#if actionError}<div class="error-message">{actionError}</div>{/if}

    <div class="status-bar">
      <span class="pill" class:ok={connected}>
        <span class="dot"></span>{connected ? "Diffusion active" : "Connexion…"}
      </span>
      <span class="pill">👥 {guestCount} invité{guestCount > 1 ? "s" : ""} connecté{guestCount > 1 ? "s" : ""}</span>
      {#if hasRegistrations && registrations.length}
        <span class="pill">🎟️ {confirmedSeats} place{confirmedSeats > 1 ? "s" : ""} réservée{confirmedSeats > 1 ? "s" : ""}</span>
      {/if}
      <span class="pill">{formatDateLong(tasting.date)}</span>
      {#if !canPersist}
        <span class="pill warn" title="Appliquez la migration pour que les retardataires arrivent directement sur le bon vin.">Position non persistée</span>
      {/if}
    </div>

    <div class="layout">
      <section class="stage" style="--robe: {style.color}; --robe-light: {style.light};">
        <div class="now">
          <WineBottle src={current.image_url} alt={wineTitle(current.wine)} wine={style} height="16rem" />
          <div class="now-text">
            <span class="now-label">Vin servi · {position + 1} / {wines.length}</span>
            <h2>{wineTitle(current.wine)}</h2>
            {#if wineSubtitle(current.wine)}<p>{wineSubtitle(current.wine)}</p>{/if}
            <p class="muted">{current.wine?.winery?.name}{current.year ? ` · ${current.year}` : ""}{current.price ? ` · ${formatEur(current.price)}` : ""}</p>
            {#if stats.get(current.id)?.count}
              <div class="now-stats">
                <StarRating value={Math.round(stats.get(current.id)?.avg ?? 0)} readonly size="1.2rem" />
                <span>{stats.get(current.id)?.avg?.toFixed(1)} · {stats.get(current.id)?.count} note{(stats.get(current.id)?.count ?? 0) > 1 ? "s" : ""}</span>
              </div>
            {/if}
          </div>
          <GlassProgress value={position + 1} total={wines.length} color={style.color} size="5rem" />
        </div>
        <div class="controls">
          <button type="button" class="ctrl" on:click={() => setPosition(position - 1)} disabled={position === 0}>← Précédent</button>
          <button type="button" class="ctrl primary" on:click={() => setPosition(position + 1)} disabled={position === wines.length - 1}>Vin suivant →</button>
        </div>
        <p class="hint">Astuce : flèches ← → ou barre d’espace pour avancer.</p>

        <ol class="wine-list">
          {#each wines as w, i (w.id)}
            {@const s = wineStyle(w.wine?.wine_type)}
            {@const st = stats.get(w.id)}
            <li>
              <button type="button" class:active={i === position} class:done={i < position} on:click={() => setPosition(i)}>
                <span class="num" style="--c: {s.color}">{i + 1}</span>
                <span class="name">{wineTitle(w.wine)}<small>{w.wine?.winery?.name}{w.year ? ` · ${w.year}` : ""}</small></span>
                <span class="metric" title="Note moyenne">{st?.avg != null ? `★ ${st.avg.toFixed(1)}` : "—"}</span>
                <span class="metric" title="Bouteilles demandées">{st?.wanted ? `🛒 ${st.wanted}` : ""}</span>
              </button>
            </li>
          {/each}
        </ol>
      </section>

      <aside class="side">
        <div class="card qr-card">
          <h3>Invités : scannez pour suivre</h3>
          {#if qr}<img src={qr} alt="QR code vers la vue invité" class="qr" />{/if}
          <div class="link-row">
            <code>{guestUrl.replace(/^https?:\/\//, "")}</code>
            <button type="button" class="btn-secondary btn-sm" on:click={copyLink}>{copied ? "Copié ✓" : "Copier"}</button>
          </div>
        </div>

        {#if hasWishes}
          <div class="card">
            <h3>Demandes « J’en veux » {#if newWishes.length}<span class="badge">{newWishes.length}</span>{/if}</h3>
            {#if wishes.length === 0}
              <p class="empty-text">Aucune demande pour l’instant.</p>
            {:else}
              <ul class="wishes">
                {#each wishes as w (w.id)}
                  <li class:muted-row={w.status !== "new"} transition:fade={{ duration: 150 }}>
                    <div class="wish-head">
                      <strong>{w.first_name} {w.last_name || ""}</strong>
                      <span class="muted">{formatEur(wishTotal(w))}</span>
                    </div>
                    <ul class="wish-items">
                      {#each wishItems(w.items) as it}
                        <li>{it.quantity} × {wineTitle(wineById.get(it.wine_vintage_id)?.wine)}</li>
                      {/each}
                    </ul>
                    {#if w.message}<p class="wish-msg">« {w.message} »</p>{/if}
                    <p class="muted small">{[w.email, w.phone].filter(Boolean).join(" · ")}</p>
                    {#if w.status === "new"}
                      <div class="actions">
                        <button type="button" class="btn-primary btn-sm" disabled={busyId === w.id} on:click={() => makeSale(w)}>
                          {busyId === w.id ? "…" : "Créer la vente"}
                        </button>
                        <button type="button" class="btn-secondary btn-sm" disabled={busyId === w.id} on:click={() => dismiss(w)}>Ignorer</button>
                      </div>
                    {:else if w.sale_id}
                      <a href="/manage/sales" class="small">✓ Vente créée (en attente)</a>
                    {:else}
                      <span class="small muted">Ignorée</span>
                    {/if}
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        {/if}

        {#if hasRegistrations}
          <div class="card">
            <h3>Inscrits</h3>
            {#if registrations.length === 0}
              <p class="empty-text">Aucune inscription en ligne.</p>
            {:else}
              <ul class="regs">
                {#each registrations as r (r.id)}
                  <li>
                    <span>
                      <strong>{r.first_name} {r.last_name || ""}</strong>
                      <small class="muted">{r.seats} pl.{r.status === "waitlist" ? " · liste d’attente" : r.status === "cancelled" ? " · annulée" : ""}</small>
                    </span>
                    {#if r.customer_id}
                      <span class="small ok">✓ participant</span>
                    {:else if r.status === "confirmed"}
                      <button type="button" class="btn-secondary btn-sm" disabled={busyId === r.id} on:click={() => addAsGuest(r)}>Ajouter</button>
                    {/if}
                  </li>
                {/each}
              </ul>
              {#if registrations.some((r) => r.status === "confirmed" && !r.customer_id)}
                <button type="button" class="btn-secondary btn-sm full" on:click={addAllRegistrations}>Ajouter tous les inscrits comme participants</button>
              {/if}
            {/if}
          </div>
        {/if}

        {#if hasFeedback && comments.length}
          <div class="card">
            <h3>Ce qu’ils en disent</h3>
            <ul class="comments">
              {#each comments as c (c.id)}
                <li>
                  <p>« {c.comment} »</p>
                  <small class="muted">{c.guest_name || "Invité"} — {wineTitle(wineById.get(c.wine_vintage_id)?.wine)}{c.rating ? ` · ${"★".repeat(c.rating)}` : ""}</small>
                </li>
              {/each}
            </ul>
          </div>
        {/if}

        {#if !hasFeedback || !hasWishes}
          <div class="card notice">
            <p>
              Les notes des invités, les demandes « J’en veux » et les inscriptions apparaîtront ici une
              fois la migration <code>20261016120000_public_experience.sql</code> appliquée.
            </p>
          </div>
        {/if}
      </aside>
    </div>
  {/if}
</ManagePageShell>

{#if projecting && current}
  <div class="projection" style="--robe: {style.color}; --robe-light: {style.light};" transition:fade={{ duration: 200 }}>
    <button type="button" class="proj-close" on:click={() => (projecting = false)} aria-label="Quitter la projection">×</button>
    <div class="proj-qr">
      {#if qr}<img src={qr} alt="QR code" />{/if}
      <p>Scannez pour suivre la soirée,<br />noter les vins et commander.</p>
    </div>
    <div class="proj-wine">
      {#key position}
        <div class="proj-inner" in:fade={{ duration: 400 }}>
          <span class="proj-num">Vin {position + 1} <span>/ {wines.length}</span></span>
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
  .status-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.8rem;
    border-radius: 999px;
    background: white;
    border: 1px solid #e3e0d8;
    font-size: 0.85rem;
    color: #3d4f51;
  }

  .pill .dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: #adb5bd;
  }

  .pill.ok .dot {
    background: #2f7a4b;
    box-shadow: 0 0 0 3px rgba(47, 122, 75, 0.2);
  }

  .pill.warn {
    background: #fff6e0;
    border-color: #f0d9a0;
    color: #8a5a00;
  }

  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1.6fr) minmax(300px, 1fr);
    gap: 1.5rem;
    align-items: start;
  }

  .stage,
  .card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  .stage {
    padding: 1.5rem;
    background:
      radial-gradient(ellipse 50% 70% at 12% 80%, color-mix(in srgb, var(--robe-light) 30%, transparent), transparent 70%),
      white;
  }

  .now {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 1.5rem;
    align-items: center;
    color: var(--mz-teal);
  }

  .now-label {
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #66787a;
  }

  .now-text h2 {
    margin: 0.3rem 0;
    font-family: var(--mz-font-display);
    font-weight: 500;
    font-size: 2.2rem;
    line-height: 1.05;
    color: var(--mz-teal);
  }

  .now-text p {
    margin: 0.15rem 0;
    color: #3d4f51;
  }

  .muted {
    color: #66787a;
  }

  .now-stats {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.6rem;
    color: #3d4f51;
    font-size: 0.9rem;
  }

  .controls {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }

  .ctrl {
    padding: 1rem;
    border-radius: 10px;
    border: 1px solid #d6d0c4;
    background: white;
    font-size: 1.05rem;
    font-weight: 600;
    color: #1d2a2c;
    cursor: pointer;
  }

  .ctrl.primary {
    background: var(--mz-teal);
    border-color: var(--mz-teal);
    color: white;
  }

  .ctrl:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .hint {
    margin: 0.5rem 0 1.25rem;
    font-size: 0.8rem;
    color: #868e96;
  }

  .wine-list {
    list-style: none;
    margin: 0;
    padding: 0;
    border-top: 1px solid #eee;
  }

  .wine-list button {
    width: 100%;
    display: grid;
    grid-template-columns: auto 1fr 4rem 3.5rem;
    gap: 0.75rem;
    align-items: center;
    padding: 0.65rem 0.5rem;
    border: none;
    border-bottom: 1px solid #f1f1f1;
    background: none;
    text-align: left;
    font: inherit;
    cursor: pointer;
  }

  .wine-list button:hover {
    background: #f8f9fa;
  }

  .wine-list button.active {
    background: var(--mz-teal-wash);
  }

  .wine-list button.done .name {
    color: #868e96;
  }

  .num {
    width: 1.8rem;
    height: 1.8rem;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--c);
    color: white;
    font-weight: 700;
    font-size: 0.85rem;
  }

  .name {
    display: flex;
    flex-direction: column;
    font-weight: 600;
  }

  .name small {
    font-weight: 400;
    color: #868e96;
  }

  .metric {
    font-size: 0.85rem;
    color: #3d4f51;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .side {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .card {
    padding: 1.1rem 1.25rem;
  }

  .card h3 {
    margin: 0 0 0.75rem;
    font-size: 1rem;
    color: #2c3e50;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .badge {
    min-width: 1.4rem;
    height: 1.4rem;
    padding: 0 0.4rem;
    border-radius: 999px;
    background: #c0392b;
    color: white;
    font-size: 0.75rem;
    display: inline-grid;
    place-items: center;
  }

  .qr-card {
    text-align: center;
  }

  .qr {
    width: min(100%, 15rem);
    image-rendering: pixelated;
  }

  .link-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    justify-content: center;
    margin-top: 0.5rem;
  }

  .link-row code {
    font-size: 0.75rem;
    color: #66787a;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .wishes,
  .regs,
  .comments,
  .wish-items {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .wishes > li {
    padding: 0.75rem 0;
    border-bottom: 1px solid #f1f1f1;
  }

  .muted-row {
    opacity: 0.55;
  }

  .wish-head {
    display: flex;
    justify-content: space-between;
  }

  .wish-items {
    margin: 0.3rem 0;
    font-size: 0.9rem;
    color: #3d4f51;
  }

  .wish-msg {
    margin: 0.25rem 0;
    font-style: italic;
    font-size: 0.88rem;
  }

  .small {
    font-size: 0.82rem;
    margin: 0.2rem 0;
  }

  .ok {
    color: #2f7a4b;
  }

  .actions {
    margin-top: 0.4rem;
  }

  .regs li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0;
    border-bottom: 1px solid #f5f5f5;
  }

  .regs small {
    display: block;
  }

  .full {
    width: 100%;
    margin-top: 0.75rem;
  }

  .comments li {
    padding: 0.5rem 0;
    border-bottom: 1px solid #f5f5f5;
  }

  .comments p {
    margin: 0 0 0.2rem;
    font-style: italic;
  }

  .notice {
    background: #fff9ec;
    font-size: 0.88rem;
    color: #6b5a2e;
  }

  .notice p {
    margin: 0;
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

  @media (max-width: 1100px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .now {
      grid-template-columns: auto 1fr;
    }

    .now :global(.glass) {
      display: none;
    }

    .now-text h2 {
      font-size: 1.6rem;
    }

    .controls {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
