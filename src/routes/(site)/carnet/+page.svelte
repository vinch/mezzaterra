<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import { supabase } from "$lib/supabase";
  import StarRating from "$lib/components/site/StarRating.svelte";
  import WineBottle from "$lib/components/site/WineBottle.svelte";
  import { getGuestId, getNotebook, getProfile, saveProfile, type NotebookEntry } from "$lib/live";
  import { isMissingSchemaError } from "$lib/features";
  import { formatDateLong, formatDateShort } from "$lib/dates";
  import { VINTAGE_PUBLIC_SELECT, formatEur, wineStyle, wineTitle } from "$lib/wine";

  type Notebook = {
    email: string;
    customers: { id: string; first_name: string; last_name: string }[];
    sales: { id: string; date: string; status: string; total_price: number; items: { wine_vintage_id: string | null; quantity: number; price: number; note: string | null }[] }[];
    tastings: { id: string; name: string | null; date: string }[];
    feedback: { tasting_id: string; wine_vintage_id: string; rating: number | null; comment: string | null; created_at: string }[];
  };

  let local: NotebookEntry[] = [];
  let user: any = null;
  let ready = false;

  let email = "";
  let sendingLink = false;
  let linkSent = false;
  let linkError = "";

  let notebook: Notebook | null = null;
  let notebookUnavailable = false;
  let vintages = new Map<string, any>();

  /* Recommande */
  let reorder: Record<string, number> = {};
  let reorderSending = false;
  let reorderDone = false;
  let reorderError = "";

  onMount(() => {
    local = getNotebook().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    email = getProfile().email;

    void (async () => {
      const { data } = await supabase.auth.getUser();
      user = data.user;
      if (user) await loadNotebook();
      ready = true;
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const next = session?.user ?? null;
      if (next?.id !== user?.id) {
        user = next;
        if (user) void loadNotebook();
        else notebook = null;
      }
    });
    return () => sub.subscription.unsubscribe();
  });

  async function loadNotebook() {
    const { data, error } = await supabase.rpc("my_notebook");
    if (error) {
      notebookUnavailable = isMissingSchemaError(error);
      return;
    }
    notebook = data as unknown as Notebook;
    const ids = new Set<string>();
    for (const s of notebook?.sales || []) for (const i of s.items) if (i.wine_vintage_id) ids.add(i.wine_vintage_id);
    for (const f of notebook?.feedback || []) ids.add(f.wine_vintage_id);
    if (ids.size) {
      const { data: rows } = await supabase.from("wine_vintage").select(VINTAGE_PUBLIC_SELECT).in("id", [...ids]);
      vintages = new Map((rows || []).map((v: any) => [v.id, v]));
    }
  }

  async function sendLink() {
    linkError = "";
    if (!email.trim()) {
      linkError = "Indiquez votre email.";
      return;
    }
    sendingLink = true;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/carnet` },
    });
    sendingLink = false;
    if (error) linkError = "Impossible d’envoyer le lien pour le moment.";
    else linkSent = true;
  }

  async function logout() {
    await supabase.auth.signOut();
    user = null;
    notebook = null;
  }

  /* ——— Vues dérivées ——— */
  $: firstName = notebook?.customers?.[0]?.first_name || getProfile().firstName || "";

  $: purchased = (() => {
    const map = new Map<string, { vintage: any; qty: number; last: string }>();
    for (const s of notebook?.sales || []) {
      for (const it of s.items) {
        if (!it.wine_vintage_id) continue;
        const v = vintages.get(it.wine_vintage_id);
        if (!v) continue;
        const cur = map.get(v.id) ?? { vintage: v, qty: 0, last: s.date };
        cur.qty += it.quantity;
        if (s.date > cur.last) cur.last = s.date;
        map.set(v.id, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.last.localeCompare(a.last));
  })();

  /* Notes : celles du compte (en base) + celles de ce téléphone, sans doublon. */
  $: tastedGroups = (() => {
    type Row = { vintageId: string; title: string; year: number | null; rating: number | null; comment: string };
    const groups = new Map<string, { name: string; date: string; rows: Map<string, Row> }>();
    const tastingName = (id: string) => notebook?.tastings.find((t) => t.id === id);
    for (const e of local) {
      const g = groups.get(e.tastingId) ?? { name: e.tastingName, date: e.tastingDate, rows: new Map() };
      g.rows.set(e.vintageId, { vintageId: e.vintageId, title: e.wineTitle, year: e.year, rating: e.rating, comment: e.comment });
      groups.set(e.tastingId, g);
    }
    for (const f of notebook?.feedback || []) {
      const t = tastingName(f.tasting_id);
      const g = groups.get(f.tasting_id) ?? { name: t?.name || "Dégustation", date: t?.date || f.created_at.slice(0, 10), rows: new Map() };
      if (!g.rows.has(f.wine_vintage_id)) {
        const v = vintages.get(f.wine_vintage_id);
        g.rows.set(f.wine_vintage_id, {
          vintageId: f.wine_vintage_id,
          title: v ? wineTitle(v.wine) : "Vin",
          year: v?.year ?? null,
          rating: f.rating,
          comment: f.comment || "",
        });
      }
      groups.set(f.tasting_id, g);
    }
    return [...groups.entries()]
      .map(([id, g]) => ({ id, ...g, rows: [...g.rows.values()].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)) }))
      .sort((a, b) => b.date.localeCompare(a.date));
  })();

  $: favorites = tastedGroups.flatMap((g) => g.rows).filter((r) => (r.rating ?? 0) >= 4);
  $: reorderCount = Object.values(reorder).reduce((s, n) => s + n, 0);

  function bump(id: string, delta: number) {
    const n = Math.max(0, (reorder[id] ?? 0) + delta);
    reorder = { ...reorder, [id]: n };
  }

  async function sendReorder() {
    reorderError = "";
    const profile = getProfile();
    const items = Object.entries(reorder)
      .filter(([, q]) => q > 0)
      .map(([wine_vintage_id, quantity]) => ({ wine_vintage_id, quantity }));
    if (!items.length) return;
    reorderSending = true;
    const contactEmail = user?.email || profile.email;
    const { error } = await supabase.from("wish_request").insert({
      source: "carnet",
      guest_id: getGuestId(),
      first_name: notebook?.customers?.[0]?.first_name || profile.firstName || contactEmail?.split("@")[0] || "Client",
      last_name: notebook?.customers?.[0]?.last_name || profile.lastName || null,
      email: contactEmail || null,
      phone: profile.phone || null,
      items,
    });
    reorderSending = false;
    if (error) {
      reorderError = "Impossible d’envoyer la demande pour le moment. Écrivez-nous et on s’en occupe !";
      return;
    }
    if (contactEmail) saveProfile({ ...profile, email: contactEmail });
    reorder = {};
    reorderDone = true;
  }
</script>

<svelte:head>
  <title>Mon carnet — Mezzaterra</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<section class="intro">
  <div class="mz-container mz-rise">
    <span class="mz-eyebrow">Mon carnet</span>
    <h1 class="mz-display mz-h1">{firstName ? `Bonjour ${firstName}` : "Mon carnet de dégustation"}</h1>
    <p class="mz-lead">Vos notes de dégustation, vos coups de cœur et vos achats, au même endroit.</p>
  </div>
</section>

<div class="mz-container layout">
  <div class="main">
    {#if favorites.length}
      <section class="block">
        <h2 class="section-title">Coups de cœur</h2>
        <div class="favorites">
          {#each favorites as f (f.vintageId)}
            {@const v = vintages.get(f.vintageId)}
            <a class="fav mz-card" href="/vins/{f.vintageId}">
              <span class="fav-title">{f.title}{f.year ? ` ${f.year}` : ""}</span>
              <StarRating value={f.rating} readonly size="0.95rem" />
              {#if v}<span class="mz-muted small">{v.wine?.winery?.name}</span>{/if}
            </a>
          {/each}
        </div>
      </section>
    {/if}

    <section class="block">
      <h2 class="section-title">Mes dégustations</h2>
      {#if tastedGroups.length === 0}
        <div class="mz-card empty">
          <p>Pas encore de notes. Lors de votre prochaine dégustation, scannez le QR code sur la table : chaque vin noté atterrit ici.</p>
          <a class="mz-btn mz-btn--sm" href="/tastings">Voir les prochaines dates</a>
        </div>
      {:else}
        {#each tastedGroups as g (g.id)}
          <article class="mz-card tasting">
            <header>
              <h3 class="mz-display mz-h3">{g.name}</h3>
              <span class="mz-muted small">{formatDateLong(g.date)}</span>
            </header>
            <ul>
              {#each g.rows as r (r.vintageId)}
                <li>
                  <a href="/vins/{r.vintageId}" class="row-title">{r.title}{r.year ? ` ${r.year}` : ""}</a>
                  <StarRating value={r.rating} readonly size="0.95rem" />
                  {#if r.comment}<p class="comment">« {r.comment} »</p>{/if}
                </li>
              {/each}
            </ul>
          </article>
        {/each}
      {/if}
    </section>

    {#if user && notebook}
      <section class="block">
        <h2 class="section-title">Mes vins</h2>
        {#if purchased.length === 0}
          <p class="mz-muted">Aucun achat associé à {notebook.email} pour l’instant.</p>
        {:else}
          {#if reorderDone}
            <p class="mz-feedback mz-feedback--success" transition:fade>Merci ! Nous revenons vers vous très vite pour confirmer.</p>
          {/if}
          <ul class="purchases">
            {#each purchased as p (p.vintage.id)}
              {@const st = wineStyle(p.vintage.wine?.wine_type)}
              <li class="mz-card">
                <WineBottle src={p.vintage.image_url} alt="" wine={st} height="5rem" glow={false} />
                <div class="p-body">
                  <a href="/vins/{p.vintage.id}" class="row-title">{wineTitle(p.vintage.wine)}{p.vintage.year ? ` ${p.vintage.year}` : ""}</a>
                  <span class="mz-muted small">{p.qty} bouteille{p.qty > 1 ? "s" : ""} · dernier achat le {formatDateShort(p.last)}</span>
                </div>
                <div class="stepper" role="group" aria-label="Recommander">
                  <button type="button" on:click={() => bump(p.vintage.id, -1)} disabled={!reorder[p.vintage.id]} aria-label="Moins">−</button>
                  <output>{reorder[p.vintage.id] ?? 0}</output>
                  <button type="button" on:click={() => bump(p.vintage.id, 1)} aria-label="Plus">+</button>
                </div>
              </li>
            {/each}
          </ul>
          {#if reorderCount > 0}
            <div class="reorder-bar" transition:fade={{ duration: 150 }}>
              <span>{reorderCount} bouteille{reorderCount > 1 ? "s" : ""} à recommander</span>
              <button class="mz-btn" type="button" disabled={reorderSending} on:click={sendReorder}>
                {reorderSending ? "Envoi…" : "Envoyer ma demande"}
              </button>
            </div>
            {#if reorderError}<p class="mz-feedback mz-feedback--error">{reorderError}</p>{/if}
          {/if}
        {/if}
      </section>

      {#if notebook.sales.length}
        <section class="block">
          <h2 class="section-title">Mes achats</h2>
          <ul class="sales">
            {#each notebook.sales as s (s.id)}
              <li>
                <span>{formatDateShort(s.date)}</span>
                <span class="mz-muted">{s.items.reduce((n, i) => n + i.quantity, 0)} article(s)</span>
                <strong>{formatEur(s.total_price)}</strong>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    {/if}
  </div>

  <aside class="side">
    <div class="mz-card account">
      {#if !ready}
        <p class="mz-muted">…</p>
      {:else if user}
        <span class="mz-eyebrow">Connecté·e</span>
        <p class="account-email">{user.email}</p>
        {#if notebookUnavailable}
          <p class="mz-muted small">L’historique d’achats sera bientôt disponible ici.</p>
        {/if}
        <button type="button" class="mz-btn mz-btn--ghost mz-btn--sm" on:click={logout}>Se déconnecter</button>
      {:else if linkSent}
        <span class="mz-eyebrow">Vérifiez vos emails</span>
        <p>Un lien de connexion a été envoyé à <strong>{email}</strong>.</p>
        <button type="button" class="mz-btn mz-btn--ghost mz-btn--sm" on:click={() => (linkSent = false)}>Renvoyer</button>
      {:else}
        <span class="mz-eyebrow">Retrouver mes achats</span>
        <p class="mz-muted small">
          Connectez-vous avec l’email utilisé pour vos commandes : vos achats et vos notes vous suivent sur tous vos appareils.
        </p>
        <form on:submit|preventDefault={sendLink} class="login">
          <input class="mz-input" type="email" bind:value={email} placeholder="Votre email" autocomplete="email" aria-label="Votre email" />
          <button class="mz-btn mz-btn--block" type="submit" disabled={sendingLink}>
            {sendingLink ? "Envoi…" : "Recevoir un lien de connexion"}
          </button>
        </form>
        {#if linkError}<p class="mz-feedback mz-feedback--error">{linkError}</p>{/if}
      {/if}
    </div>
    {#if local.length}
      <p class="mz-muted small note">Les notes prises sur ce téléphone sont enregistrées localement{user ? " et associées à votre compte quand vous aviez indiqué votre email" : ""}.</p>
    {/if}
  </aside>
</div>

<style>
  .intro {
    padding: 3rem 0 1rem;
  }

  .intro h1 {
    margin: 0.5rem 0 0.75rem;
  }

  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 20rem;
    gap: 2rem;
    align-items: start;
    padding-bottom: 3rem;
  }

  .block {
    margin-top: 1.75rem;
  }

  .section-title {
    margin: 0 0 1rem;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--mz-muted);
  }

  .small {
    font-size: 0.85rem;
  }

  .favorites {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
    gap: 0.75rem;
  }

  .fav {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 1rem;
    color: inherit;
    text-decoration: none;
    transition: transform 0.2s var(--mz-ease);
  }

  .fav:hover {
    transform: translateY(-2px);
  }

  .fav-title {
    font-family: var(--mz-font-display);
    font-size: 1.15rem;
    color: var(--mz-teal);
  }

  .empty {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .empty p {
    margin: 0;
    line-height: 1.6;
  }

  .tasting {
    padding: 1.25rem 1.5rem;
    margin-bottom: 1rem;
  }

  .tasting header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .tasting ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .tasting li {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.2rem 1rem;
    padding: 0.6rem 0;
    border-top: 1px solid var(--mz-line-soft);
  }

  .row-title {
    color: var(--mz-ink);
    font-weight: 600;
    text-decoration: none;
  }

  .row-title:hover {
    color: var(--mz-teal);
  }

  .comment {
    grid-column: 1 / -1;
    margin: 0;
    font-style: italic;
    color: var(--mz-ink-soft);
    font-size: 0.92rem;
  }

  .purchases {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .purchases li {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 1rem;
    padding: 0.6rem 1rem;
  }

  .p-body {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .stepper {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--mz-line);
    border-radius: 999px;
    background: #fff;
  }

  .stepper button {
    width: 2.2rem;
    height: 2.2rem;
    border: none;
    background: none;
    color: var(--mz-teal);
    font-size: 1.1rem;
    cursor: pointer;
    border-radius: 50%;
  }

  .stepper button:disabled {
    opacity: 0.35;
  }

  .stepper output {
    min-width: 1.5rem;
    text-align: center;
    font-weight: 700;
  }

  .reorder-bar {
    position: sticky;
    bottom: 1rem;
    margin-top: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 0.75rem 0.75rem 1.25rem;
    border-radius: 999px;
    background: var(--mz-ink);
    color: #fff;
    box-shadow: var(--mz-shadow);
  }

  .sales {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .sales li {
    display: grid;
    grid-template-columns: 7rem 1fr auto;
    gap: 1rem;
    padding: 0.6rem 0;
    border-bottom: 1px solid var(--mz-line-soft);
    font-variant-numeric: tabular-nums;
  }

  .side {
    position: sticky;
    top: 6rem;
  }

  .account {
    padding: 1.4rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: flex-start;
  }

  .account p {
    margin: 0;
  }

  .account-email {
    font-weight: 600;
    word-break: break-all;
  }

  .login {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .note {
    margin: 0.75rem 0.25rem 0;
  }

  @media (max-width: 860px) {
    .layout {
      grid-template-columns: 1fr;
    }

    .side {
      position: static;
      order: -1;
    }
  }
</style>
