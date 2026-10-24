<script lang="ts">
  import { preventDefault, self } from "$lib/ui/events";
  import { onDestroy, onMount } from "svelte";
  import { fade, fly } from "svelte/transition";
  import type { RealtimeChannel } from "@supabase/supabase-js";
  import { supabase } from "$lib/supabase";
  import WineBottle from "$lib/components/site/WineBottle.svelte";
  import GlassProgress from "$lib/components/site/GlassProgress.svelte";
  import StarRating from "$lib/components/site/StarRating.svelte";
  import { tastingTitle } from "$lib/publicData";
  import { daysUntil, formatDateLong, winesRevealed } from "$lib/dates";
  import {
    grapesText,
    vintageNotes,
    winePairings,
    wineStyle,
    wineSubtitle,
    wineTitle,
  } from "$lib/wine";
  import { formatEUR } from "$lib/format";
  import {
    getCart,
    getGuestId,
    getProfile,
    getRatings,
    getServed,
    joinLiveChannel,
    pushFeedback,
    requestSync,
    saveCart,
    saveProfile,
    saveRatings,
    saveServed,
    type GuestProfile,
    type LocalRating,
  } from "$lib/live";

  let { data } = $props();

  let tasting = $derived(data.tasting as any);
  let wines = $derived(data.wineVintages as any[]);
  let total = $derived(wines.length);

  /* ——— Position ——— */
  let index = $state(0);
  let hostPosition = $state<number | null>(null);
  /** Dernier vin servi par l'animateur : les invités ne voient rien au-delà. */
  let maxServed = $state(0);
  let follow = $state(true);
  let direction = $state(1);
  let connected = $state(false);
  let channel: RealtimeChannel | null = null;

  /* ——— État invité ——— */
  let profile = $state<GuestProfile>({ firstName: "", lastName: "", email: "", phone: "" });
  let ratings = $state<Record<string, LocalRating>>({});
  let cart = $state<Record<string, number>>({});
  let showWelcome = $state(false);
  let showCart = $state(false);
  let showNotes = $state(false);
  let showRecap = $state(false);
  let commentTimer: ReturnType<typeof setTimeout> | null = null;
  let savedFlash = $state(false);

  /* ——— Envoi de la demande ——— */
  let sending = $state(false);
  let sendResult = $state<"ok" | "offline" | null>(null);
  let sendError = $state("");
  let message = $state("");

  onMount(() => {
    if (!tasting) return;
    profile = getProfile();
    ratings = getRatings(tasting.id);
    cart = getCart(tasting.id);
    getGuestId();
    showWelcome = !profile.firstName;

    maxServed = getServed(tasting.id);
    if (typeof tasting.live_position === "number") {
      hostPosition = clamp(tasting.live_position);
      markServed(hostPosition);
      index = hostPosition;
    }
    if (finished) index = 0;

    channel = joinLiveChannel(tasting.id, {
      onPosition: (p) => {
        hostPosition = clamp(p);
        markServed(hostPosition);
        if (follow) goTo(hostPosition, false);
      },
      onStatus: (ok) => {
        connected = ok;
        if (ok && channel) void requestSync(channel);
      },
    });
  });

  onDestroy(() => {
    if (channel) void supabase.removeChannel(channel);
    if (commentTimer) clearTimeout(commentTimer);
  });

  function clamp(p: number): number {
    return Math.max(0, Math.min(Math.max(0, total - 1), Math.round(p)));
  }

  function markServed(p: number) {
    if (p <= maxServed) return;
    maxServed = p;
    saveServed(tasting.id, p);
  }

  /* Avant la soirée : rien. Pendant : jusqu'au vin servi. Après : tout. */
  let upcoming = $derived(tasting ? daysUntil(tasting.date) > 0 : false);
  let finished = $derived(tasting ? winesRevealed(tasting.date) : false);
  let unlocked = $derived(finished ? Math.max(0, total - 1) : Math.min(maxServed, Math.max(0, total - 1)));

  function goTo(i: number, manual = true) {
    const next = Math.min(clamp(i), manual ? unlocked : clamp(i));
    if (next === index) return;
    direction = next > index ? 1 : -1;
    index = next;
    showNotes = false;
    if (manual) follow = hostPosition == null || next === hostPosition;
  }

  function backToHost() {
    if (hostPosition == null) return;
    follow = true;
    goTo(hostPosition, false);
  }

  let current = $derived(wines[index]);
  let style = $derived(wineStyle(current?.wine?.wine_type));
  let currentRating = $derived(current ? ratings[current.id] : undefined);
  let notes = $derived(vintageNotes(current?.note));
  let pairings = $derived(winePairings(current?.wine));
  let cartLines = $derived(wines.filter((w) => (cart[w.id] ?? 0) > 0).map((w) => ({ wine: w, qty: cart[w.id] })));
  let cartCount = $derived(cartLines.reduce((s, l) => s + l.qty, 0));
  let cartTotal = $derived(cartLines.reduce((s, l) => s + l.qty * Number(l.wine.price ?? 0), 0));
  let ratedCount = $derived(wines.filter((w) => ratings[w.id]?.rating).length);

  function persistRating(vintage: any, patch: Partial<LocalRating>) {
    const prev = ratings[vintage.id] ?? { rating: null, comment: "", updatedAt: "" };
    const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
    ratings = { ...ratings, [vintage.id]: next };
    saveRatings(tasting.id, ratings);
    return next;
  }

  async function sync(vintage: any, r: LocalRating) {
    const ok = await pushFeedback({
      tastingId: tasting.id,
      vintageId: vintage.id,
      rating: r.rating,
      comment: r.comment,
      profile,
    });
    if (ok) {
      savedFlash = true;
      setTimeout(() => (savedFlash = false), 1400);
    }
  }

  function rate(n: number) {
    if (!current) return;
    const r = persistRating(current, { rating: n });
    void sync(current, r);
    if (navigator.vibrate) navigator.vibrate(12);
  }

  function onComment(e: Event) {
    if (!current) return;
    const vintage = current;
    const r = persistRating(vintage, { comment: (e.target as HTMLTextAreaElement).value });
    if (commentTimer) clearTimeout(commentTimer);
    commentTimer = setTimeout(() => void sync(vintage, r), 1200);
  }

  function setQty(vintageId: string, qty: number) {
    const q = Math.max(0, Math.min(60, qty));
    const next = { ...cart };
    if (q === 0) delete next[vintageId];
    else next[vintageId] = q;
    cart = next;
    saveCart(tasting.id, cart);
  }

  function saveWelcome() {
    saveProfile(profile);
    showWelcome = false;
  }

  async function sendRequest() {
    sendError = "";
    if (!profile.firstName.trim()) {
      sendError = "Merci d’indiquer votre prénom.";
      return;
    }
    if (!profile.email.trim() && !profile.phone.trim()) {
      sendError = "Laissez-nous un email ou un téléphone pour vous recontacter.";
      return;
    }
    saveProfile(profile);
    sending = true;
    const { error } = await supabase.from("wish_request").insert({
      tasting_id: tasting.id,
      source: "live",
      guest_id: getGuestId(),
      first_name: profile.firstName.trim(),
      last_name: profile.lastName.trim() || null,
      email: profile.email.trim().toLowerCase() || null,
      phone: profile.phone.trim() || null,
      items: cartLines.map((l) => ({ wine_vintage_id: l.wine.id, quantity: l.qty })),
      message: message.trim() || null,
    });
    sending = false;
    if (error) {
      /* Table absente ou réseau capricieux : la sélection reste sur le téléphone. */
      sendResult = "offline";
      return;
    }
    sendResult = "ok";
    cart = {};
    saveCart(tasting.id, cart);
  }

  /* ——— Swipe ——— */
  let touchX: number | null = null;
  let touchY: number | null = null;
  function onTouchStart(e: TouchEvent) {
    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
  }
  function onTouchEnd(e: TouchEvent) {
    if (touchX == null || touchY == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    const dy = e.changedTouches[0].clientY - touchY;
    touchX = touchY = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) goTo(index + (dx < 0 ? 1 : -1));
  }

  function onKey(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "ArrowRight") goTo(index + 1);
    if (e.key === "ArrowLeft") goTo(index - 1);
  }
</script>

<svelte:window onkeydown={onKey} />

<svelte:head>
  <title>{tasting ? `${tastingTitle(tasting)} — en direct` : "Dégustation"} — Mezzaterra</title>
  <meta name="theme-color" content="#0e1819" />
</svelte:head>

<div class="cave" class:has-cart={cartCount > 0} style="--robe: {style.color}; --robe-light: {style.light};">
  {#if tasting && upcoming}
    <div class="empty">
      <img src="/flyer/logo-text.svg" alt="Mezzaterra" class="logo" />
      <p>La dégustation commence le {formatDateLong(tasting.date).toLowerCase()}.<br />Les vins seront dévoilés un à un pendant la soirée.</p>
      <a class="ghost-btn" href="/tastings/{tasting.id}">Retour à la dégustation</a>
    </div>
  {:else if !tasting || total === 0}
    <div class="empty">
      <img src="/flyer/logo-text.svg" alt="Mezzaterra" class="logo" />
      <p>{!tasting ? "Cette dégustation est introuvable." : "Les vins de la soirée seront bientôt dévoilés…"}</p>
      <a class="ghost-btn" href="/tastings">Voir les dégustations</a>
    </div>
  {:else}
    <header class="topbar">
      <a href="/tastings/{tasting.id}" class="brand" aria-label="Retour à la dégustation">
        <img src="/flyer/logo-text.svg" alt="Mezzaterra" class="logo" />
      </a>
      <div class="progress">
        <GlassProgress value={index + 1} {total} color={style.color} size="2.6rem" />
        <div class="progress-text">
          <span class="progress-count">Vin {index + 1}<span class="muted"> / {total}</span></span>
          <span class="live-state" class:on={connected}>
            <span class="dot" aria-hidden="true"></span>
            {connected ? (follow ? "En direct" : "Navigation libre") : "Hors ligne"}
          </span>
        </div>
      </div>
      <button type="button" class="avatar" onclick={() => (showWelcome = true)} aria-label="Mon profil">
        {(profile.firstName || "?").charAt(0).toUpperCase()}
      </button>
    </header>

    {#if !follow && hostPosition != null && hostPosition !== index}
      <button type="button" class="rejoin" onclick={backToHost} transition:fly={{ y: -10, duration: 200 }}>
        Le vin {hostPosition + 1} est servi — y retourner →
      </button>
    {/if}

    <main class="stage" ontouchstart={onTouchStart} ontouchend={onTouchEnd}>
      {#key index}
        <section
          class="slide"
          in:fly={{ x: 60 * direction, duration: 380, opacity: 0 }}
          aria-live="polite"
        >
          <div class="bottle-wrap">
            <div class="halo" aria-hidden="true"></div>
            <WineBottle src={current.image_url} alt={wineTitle(current.wine)} wine={style} height="min(19rem, 38vh)" />
          </div>

          <div class="identity">
            <span class="eyebrow">
              <span class="robe-dot" aria-hidden="true"></span>{style.label}{current.year ? ` · ${current.year}` : ""}{current.organic ? " · Bio" : ""}
            </span>
            <h1>{wineTitle(current.wine)}</h1>
            {#if wineSubtitle(current.wine)}<p class="sub">{wineSubtitle(current.wine)}</p>{/if}
            {#if current.wine?.winery?.name}<p class="winery">{current.wine.winery.name}</p>{/if}
            {#if grapesText(current.wine_vintage_grape)}<p class="grapes">{grapesText(current.wine_vintage_grape, true)}</p>{/if}
          </div>

          <div class="panel rating">
            <div class="panel-head">
              <span>Votre note</span>
              {#if savedFlash}<span class="saved" transition:fade={{ duration: 150 }}>✓ enregistrée</span>{/if}
            </div>
            <StarRating value={currentRating?.rating ?? null} size="2.2rem" label="Notez ce vin" onchange={rate} />
            <textarea
              rows="2"
              placeholder="Vos impressions… (fruité, épicé, coup de cœur ?)"
              value={currentRating?.comment ?? ""}
              oninput={onComment}
              maxlength="1000"
            ></textarea>
          </div>

          {#if notes.length || pairings.length}
            <div class="panel">
              <button type="button" class="panel-toggle" onclick={() => (showNotes = !showNotes)} aria-expanded={showNotes}>
                Notes du sommelier & accords <span class="chev" class:open={showNotes}>⌄</span>
              </button>
              {#if showNotes}
                <div class="notes" transition:fade={{ duration: 150 }}>
                  {#each notes as n}
                    <p><strong>{n.label}</strong> {n.content}</p>
                  {/each}
                  {#if pairings.length}
                    <div class="pairings">
                      {#each pairings as p}<span>{p}</span>{/each}
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/if}

          <div class="panel want">
            <div>
              <span class="want-title">J’en veux !</span>
              {#if current.price}<span class="want-price">{formatEUR(current.price)} la bouteille</span>{/if}
            </div>
            <div class="stepper" role="group" aria-label="Nombre de bouteilles">
              <button type="button" onclick={() => setQty(current.id, (cart[current.id] ?? 0) - 1)} disabled={!cart[current.id]} aria-label="Une bouteille de moins">−</button>
              <output aria-live="polite">{cart[current.id] ?? 0}</output>
              <button type="button" onclick={() => setQty(current.id, (cart[current.id] ?? 0) + 1)} aria-label="Une bouteille de plus">+</button>
            </div>
          </div>
        </section>
      {/key}
    </main>

    <nav class="dots" aria-label="Vins de la soirée">
      <button type="button" class="nav-arrow" onclick={() => goTo(index - 1)} disabled={index === 0} aria-label="Vin précédent">‹</button>
      <div class="dot-row">
        {#each wines as w, i}
          {@const s = wineStyle(w.wine?.wine_type)}
          {#if i <= unlocked}
            <button
              type="button"
              class="wine-dot"
              class:active={i === index}
              class:served={hostPosition != null && i === hostPosition}
              class:rated={!!ratings[w.id]?.rating}
              style="--c: {s.color}"
              onclick={() => goTo(i)}
              aria-label="Vin {i + 1} : {wineTitle(w.wine)}"
              aria-current={i === index}
            ></button>
          {:else}
            <span class="wine-dot locked" aria-label="Vin {i + 1} : à venir" role="img"></span>
          {/if}
        {/each}
      </div>
      {#if index === total - 1}
        <button type="button" class="nav-arrow recap-btn" onclick={() => (showRecap = true)}>Récap</button>
      {:else}
        <button type="button" class="nav-arrow" onclick={() => goTo(index + 1)} disabled={index >= unlocked} aria-label={index >= unlocked ? "Le vin suivant n’est pas encore servi" : "Vin suivant"}>›</button>
      {/if}
    </nav>

    {#if cartCount > 0}
      <button type="button" class="cart-bar" onclick={() => (showCart = true)} transition:fly={{ y: 40, duration: 250 }}>
        <span>🛒 {cartCount} bouteille{cartCount > 1 ? "s" : ""}</span>
        <strong>{formatEUR(cartTotal)} →</strong>
      </button>
    {/if}
  {/if}
</div>

{#if showWelcome}
  <div class="sheet-backdrop" transition:fade={{ duration: 150 }} onclick={self(() => saveWelcome())} role="presentation">
    <div class="sheet" transition:fly={{ y: 40, duration: 250 }} role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <h2 id="welcome-title">Bienvenue 🍷</h2>
      <p class="sheet-lead">
        Suivez la soirée vin après vin, notez ce que vous goûtez et mettez de côté vos coups de cœur.
      </p>
      <form onsubmit={preventDefault(saveWelcome)} class="sheet-form">
        <label>Prénom<input bind:value={profile.firstName} autocomplete="given-name" /></label>
        <label>Email <span class="opt">(facultatif)</span>
          <input type="email" bind:value={profile.email} autocomplete="email" />
        </label>
        <button type="submit" class="solid-btn">C’est parti</button>
      </form>
    </div>
  </div>
{/if}

{#if showCart}
  <div class="sheet-backdrop" transition:fade={{ duration: 150 }} onclick={self(() => (showCart = false))} role="presentation">
    <div class="sheet" transition:fly={{ y: 40, duration: 250 }} role="dialog" aria-modal="true" aria-labelledby="cart-title">
      <button type="button" class="sheet-close" onclick={() => (showCart = false)} aria-label="Fermer">×</button>
      {#if sendResult === "ok"}
        <h2 id="cart-title">Merci {profile.firstName} !</h2>
        <p class="sheet-lead">Votre demande est bien partie. On prépare vos bouteilles et on revient vers vous très vite.</p>
        <button type="button" class="solid-btn" onclick={() => { showCart = false; sendResult = null; }}>Continuer la dégustation</button>
      {:else}
        <h2 id="cart-title">Mes coups de cœur</h2>
        <ul class="cart-lines">
          {#each cartLines as l (l.wine.id)}
            <li>
              <span class="mz-dot" style="background: {wineStyle(l.wine.wine?.wine_type).color}"></span>
              <span class="cart-name">{wineTitle(l.wine.wine)}{l.wine.year ? ` ${l.wine.year}` : ""}</span>
              <div class="stepper small">
                <button type="button" onclick={() => setQty(l.wine.id, l.qty - 1)} aria-label="Moins">−</button>
                <output>{l.qty}</output>
                <button type="button" onclick={() => setQty(l.wine.id, l.qty + 1)} aria-label="Plus">+</button>
              </div>
              <span class="cart-price">{formatEUR(l.qty * Number(l.wine.price ?? 0))}</span>
            </li>
          {/each}
        </ul>
        <p class="cart-total">Total indicatif <strong>{formatEUR(cartTotal)}</strong></p>

        {#if sendResult === "offline"}
          <p class="offline">
            Impossible d’envoyer la demande pour l’instant : votre sélection reste enregistrée sur ce téléphone.
            Montrez cet écran à l’équipe Mezzaterra, on s’en occupe !
          </p>
        {/if}

        <form onsubmit={preventDefault(sendRequest)} class="sheet-form">
          <div class="row">
            <label>Prénom *<input bind:value={profile.firstName} autocomplete="given-name" required /></label>
            <label>Nom<input bind:value={profile.lastName} autocomplete="family-name" /></label>
          </div>
          <div class="row">
            <label>Email<input type="email" bind:value={profile.email} autocomplete="email" /></label>
            <label>Téléphone<input type="tel" bind:value={profile.phone} autocomplete="tel" /></label>
          </div>
          <label>Un mot ?<textarea rows="2" bind:value={message} placeholder="Livraison, retrait à la prochaine soirée…"></textarea></label>
          {#if sendError}<p class="error" role="alert">{sendError}</p>{/if}
          <button type="submit" class="solid-btn" disabled={sending || cartCount === 0}>
            {sending ? "Envoi…" : "Envoyer ma demande"}
          </button>
          <p class="fine">Aucun paiement maintenant : nous vous recontactons pour confirmer.</p>
        </form>
      {/if}
    </div>
  </div>
{/if}

{#if showRecap}
  <div class="sheet-backdrop" transition:fade={{ duration: 150 }} onclick={self(() => (showRecap = false))} role="presentation">
    <div class="sheet" transition:fly={{ y: 40, duration: 250 }} role="dialog" aria-modal="true" aria-labelledby="recap-title">
      <button type="button" class="sheet-close" onclick={() => (showRecap = false)} aria-label="Fermer">×</button>
      <h2 id="recap-title">Votre soirée</h2>
      <p class="sheet-lead">{ratedCount} vin{ratedCount > 1 ? "s" : ""} noté{ratedCount > 1 ? "s" : ""} sur {total}.</p>
      <ol class="recap">
        {#each wines as w, i}
          {@const r = ratings[w.id]}
          <li>
            {#if i <= unlocked}
              <button type="button" onclick={() => { showRecap = false; goTo(i); }}>
                <span class="recap-num" style="--c: {wineStyle(w.wine?.wine_type).color}">{i + 1}</span>
                <span class="recap-name">{wineTitle(w.wine)}</span>
                <StarRating value={r?.rating ?? null} readonly size="0.95rem" />
              </button>
            {:else}
              <span class="recap-locked"><span class="recap-num" style="--c: rgba(236, 230, 218, 0.2)">{i + 1}</span> À venir…</span>
            {/if}
            {#if r?.comment}<p class="recap-comment">« {r.comment} »</p>{/if}
          </li>
        {/each}
      </ol>
      {#if cartCount > 0}
        <div class="recap-actions">
          <button type="button" class="solid-btn" onclick={() => { showRecap = false; showCart = true; }}>Commander mes coups de cœur</button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .cave {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    background:
      radial-gradient(ellipse 80% 45% at 50% 18%, color-mix(in srgb, var(--robe) 28%, transparent), transparent 70%),
      var(--mz-cave-bg);
    color: var(--mz-cave-text);
    font-family: var(--mz-font-body);
    transition: background 0.8s ease;
    padding-bottom: calc(5.5rem + env(safe-area-inset-bottom));
  }

  .cave.has-cart {
    padding-bottom: calc(10rem + env(safe-area-inset-bottom));
  }

  .logo {
    height: 1.7rem;
    width: auto;
    filter: brightness(0) invert(0.92);
  }

  .empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.25rem;
    padding: 2rem;
    text-align: center;
    color: var(--mz-cave-muted);
  }

  .topbar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: color-mix(in srgb, var(--mz-cave-bg) 82%, transparent);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--mz-cave-line);
  }

  .brand {
    display: flex;
  }

  .progress {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    color: var(--mz-cave-muted);
  }

  .progress-text {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }

  .progress-count {
    font-family: var(--mz-font-display);
    font-size: 1.1rem;
    color: var(--mz-cave-text);
  }

  .muted {
    color: var(--mz-cave-muted);
  }

  .live-state {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .live-state .dot {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 50%;
    background: var(--mz-cave-muted);
  }

  .live-state.on .dot {
    background: #e4566b;
    box-shadow: 0 0 0 0 rgba(228, 86, 107, 0.6);
    animation: live 1.8s ease-out infinite;
  }

  @keyframes live {
    to {
      box-shadow: 0 0 0 8px rgba(228, 86, 107, 0);
    }
  }

  .avatar {
    width: 2.2rem;
    height: 2.2rem;
    border-radius: 50%;
    border: 1px solid var(--mz-cave-line);
    background: var(--mz-cave-surface-2);
    color: var(--mz-cave-text);
    font-weight: 700;
    cursor: pointer;
  }

  .rejoin {
    position: sticky;
    top: 4.2rem;
    z-index: 9;
    align-self: center;
    margin: 0.5rem auto 0;
    padding: 0.55rem 1rem;
    border-radius: 999px;
    border: none;
    background: var(--mz-cave-text);
    color: var(--mz-cave-bg);
    font: inherit;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
  }

  .stage {
    flex: 1;
    width: 100%;
    max-width: 34rem;
    margin: 0 auto;
    padding: 1rem 1.1rem 1.5rem;
    overflow: hidden;
  }

  .slide {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .bottle-wrap {
    position: relative;
    display: flex;
    justify-content: center;
    padding-top: 0.5rem;
  }

  .halo {
    position: absolute;
    inset: 15% 20% 0;
    background: radial-gradient(circle at 50% 70%, color-mix(in srgb, var(--robe-light) 55%, transparent), transparent 65%);
    filter: blur(24px);
    opacity: 0.55;
  }

  .bottle-wrap :global(.bottle img),
  .bottle-wrap :global(.bottle svg) {
    filter: drop-shadow(0 18px 24px rgba(0, 0, 0, 0.55));
  }

  .identity {
    text-align: center;
  }

  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--mz-cave-muted);
  }

  .robe-dot {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    background: var(--robe);
    box-shadow: 0 0 10px var(--robe-light);
  }

  h1 {
    margin: 0.35rem 0 0.2rem;
    font-family: var(--mz-font-display);
    font-weight: 500;
    font-size: clamp(1.9rem, 8vw, 2.6rem);
    line-height: 1.05;
    letter-spacing: -0.01em;
  }

  .sub,
  .winery,
  .grapes {
    margin: 0.1rem 0 0;
    color: var(--mz-cave-muted);
  }

  .winery {
    color: var(--mz-cave-text);
    font-weight: 600;
  }

  .grapes {
    font-style: italic;
    font-size: 0.92rem;
  }

  .panel {
    background: var(--mz-cave-surface);
    border: 1px solid var(--mz-cave-line);
    border-radius: var(--mz-radius);
    padding: 1rem 1.1rem;
  }

  .panel-head {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--mz-cave-muted);
    margin-bottom: 0.5rem;
  }

  .saved {
    color: #8fd1a5;
    text-transform: none;
    letter-spacing: 0;
  }

  .rating {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: var(--mz-cave-text);
  }

  .rating .panel-head {
    width: 100%;
  }

  textarea,
  .sheet-form input {
    width: 100%;
    font: inherit;
    font-size: 1rem;
    color: inherit;
    background: var(--mz-cave-surface-2);
    border: 1px solid var(--mz-cave-line);
    border-radius: 10px;
    padding: 0.65rem 0.8rem;
    resize: vertical;
  }

  .rating textarea {
    margin-top: 0.75rem;
  }

  textarea:focus,
  .sheet-form input:focus {
    outline: none;
    border-color: var(--robe-light);
  }

  textarea::placeholder {
    color: var(--mz-cave-muted);
  }

  .panel-toggle {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: none;
    border: none;
    padding: 0;
    color: var(--mz-cave-text);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .chev {
    transition: transform 0.2s ease;
  }

  .chev.open {
    transform: rotate(180deg);
  }

  .notes {
    margin-top: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    color: var(--mz-cave-muted);
    line-height: 1.5;
  }

  .notes p {
    margin: 0;
  }

  .notes strong {
    color: var(--mz-cave-text);
    font-family: var(--mz-font-display);
    font-weight: 500;
    margin-right: 0.25rem;
  }

  .pairings {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.25rem;
  }

  .pairings span {
    padding: 0.25rem 0.65rem;
    border-radius: 999px;
    background: var(--mz-cave-surface-2);
    color: var(--mz-cave-text);
    font-size: 0.82rem;
  }

  .want {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    background: linear-gradient(120deg, color-mix(in srgb, var(--robe) 35%, var(--mz-cave-surface)), var(--mz-cave-surface));
  }

  .want-title {
    display: block;
    font-family: var(--mz-font-display);
    font-size: 1.3rem;
  }

  .want-price {
    font-size: 0.85rem;
    color: var(--mz-cave-muted);
  }

  .stepper {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid var(--mz-cave-line);
  }

  .stepper button {
    width: 2.6rem;
    height: 2.6rem;
    border: none;
    border-radius: 50%;
    background: none;
    color: inherit;
    font-size: 1.3rem;
    cursor: pointer;
  }

  .stepper button:disabled {
    opacity: 0.3;
  }

  .stepper output {
    min-width: 1.6rem;
    text-align: center;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .stepper.small button {
    width: 2rem;
    height: 2rem;
    font-size: 1.05rem;
  }

  .dots {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10;
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.75rem calc(0.6rem + env(safe-area-inset-bottom));
    background: color-mix(in srgb, var(--mz-cave-bg) 88%, transparent);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-top: 1px solid var(--mz-cave-line);
  }

  .nav-arrow {
    min-width: 2.8rem;
    height: 2.8rem;
    padding: 0 0.6rem;
    border-radius: 999px;
    border: 1px solid var(--mz-cave-line);
    background: var(--mz-cave-surface);
    color: var(--mz-cave-text);
    font: inherit;
    font-size: 1.5rem;
    cursor: pointer;
  }

  .nav-arrow:disabled {
    opacity: 0.3;
  }

  .recap-btn {
    font-size: 0.9rem;
    font-weight: 600;
    padding: 0 1rem;
    background: var(--mz-cave-text);
    color: var(--mz-cave-bg);
  }

  .dot-row {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.45rem;
    flex-wrap: wrap;
  }

  .wine-dot {
    position: relative;
    width: 0.85rem;
    height: 0.85rem;
    padding: 0;
    border-radius: 50%;
    border: 2px solid var(--c);
    background: transparent;
    cursor: pointer;
    transition: transform 0.25s var(--mz-ease);
  }

  .wine-dot.locked {
    border-color: rgba(236, 230, 218, 0.25);
    cursor: default;
  }

  .recap-locked {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.25rem 0;
    color: var(--mz-cave-muted);
    font-style: italic;
  }

  .wine-dot.rated {
    background: var(--c);
  }

  .wine-dot.active {
    transform: scale(1.45);
    box-shadow: 0 0 0 3px rgba(236, 230, 218, 0.25);
  }

  .wine-dot.served::after {
    content: "";
    position: absolute;
    left: 50%;
    top: -0.55rem;
    width: 0.3rem;
    height: 0.3rem;
    border-radius: 50%;
    background: #e4566b;
    transform: translateX(-50%);
  }

  .cart-bar {
    position: fixed;
    left: 50%;
    bottom: calc(4.6rem + env(safe-area-inset-bottom));
    transform: translateX(-50%);
    z-index: 11;
    width: min(32rem, calc(100% - 2rem));
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.85rem 1.2rem;
    border-radius: 999px;
    border: none;
    background: var(--mz-cave-text);
    color: var(--mz-cave-bg);
    font: inherit;
    cursor: pointer;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
  }

  /* ——— Feuilles (bottom sheets) ——— */
  .sheet-backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: rgba(0, 0, 0, 0.55);
  }

  .sheet {
    position: relative;
    width: min(34rem, 100%);
    max-height: 90dvh;
    overflow-y: auto;
    padding: 1.6rem 1.3rem calc(1.5rem + env(safe-area-inset-bottom));
    border-radius: var(--mz-radius-lg) var(--mz-radius-lg) 0 0;
    background: var(--mz-cave-surface);
    color: var(--mz-cave-text);
    font-family: var(--mz-font-body);
    border-top: 1px solid var(--mz-cave-line);
  }

  .sheet h2 {
    margin: 0 0 0.5rem;
    font-family: var(--mz-font-display);
    font-weight: 500;
    font-size: 1.8rem;
  }

  .sheet-lead {
    margin: 0 0 1.1rem;
    color: var(--mz-cave-muted);
    line-height: 1.5;
  }

  .sheet-close {
    position: absolute;
    top: 0.8rem;
    right: 0.9rem;
    width: 2.2rem;
    height: 2.2rem;
    border-radius: 50%;
    border: none;
    background: var(--mz-cave-surface-2);
    color: var(--mz-cave-text);
    font-size: 1.4rem;
    cursor: pointer;
  }

  .sheet-form {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }

  .sheet-form label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--mz-cave-muted);
  }

  .opt {
    font-weight: 400;
  }

  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .solid-btn,
  .ghost-btn {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    padding: 0.85rem 1.2rem;
    border-radius: 999px;
    font: inherit;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
  }

  .solid-btn {
    border: none;
    background: var(--mz-cave-text);
    color: var(--mz-cave-bg);
  }

  .solid-btn:disabled {
    opacity: 0.5;
  }

  .ghost-btn {
    border: 1px solid var(--mz-cave-line);
    background: transparent;
    color: var(--mz-cave-text);
  }

  .cart-lines {
    list-style: none;
    margin: 0 0 0.75rem;
    padding: 0;
  }

  .cart-lines li {
    display: grid;
    grid-template-columns: auto 1fr auto auto;
    align-items: center;
    gap: 0.6rem;
    padding: 0.55rem 0;
    border-bottom: 1px solid var(--mz-cave-line);
  }

  .cart-name {
    font-weight: 600;
  }

  .cart-price {
    min-width: 4.5rem;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .cart-total {
    display: flex;
    justify-content: space-between;
    margin: 0 0 1rem;
    color: var(--mz-cave-muted);
  }

  .cart-total strong {
    color: var(--mz-cave-text);
    font-size: 1.15rem;
  }

  .offline {
    padding: 0.8rem 1rem;
    border-radius: 10px;
    background: rgba(224, 176, 74, 0.15);
    color: #f0d08a;
    line-height: 1.45;
  }

  .error {
    margin: 0;
    color: #f19a9a;
  }

  .fine {
    margin: 0;
    font-size: 0.8rem;
    color: var(--mz-cave-muted);
    text-align: center;
  }

  .recap {
    list-style: none;
    margin: 0 0 1.25rem;
    padding: 0;
  }

  .recap li {
    border-bottom: 1px solid var(--mz-cave-line);
    padding: 0.5rem 0;
  }

  .recap button {
    width: 100%;
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.75rem;
    background: none;
    border: none;
    padding: 0.25rem 0;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .recap-num {
    width: 1.7rem;
    height: 1.7rem;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--c);
    color: #fff;
    font-size: 0.85rem;
    font-weight: 700;
  }

  .recap-name {
    font-family: var(--mz-font-display);
    font-size: 1.1rem;
  }

  .recap-comment {
    margin: 0.2rem 0 0 2.45rem;
    font-style: italic;
    color: var(--mz-cave-muted);
    font-size: 0.9rem;
  }

  .recap-actions {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  @media (min-width: 720px) {
    .sheet-backdrop {
      align-items: center;
    }

    .sheet {
      border-radius: var(--mz-radius-lg);
    }
  }
</style>
