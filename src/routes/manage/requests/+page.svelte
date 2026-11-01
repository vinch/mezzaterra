<script lang="ts">
  import { getContext, onMount } from "svelte";
  import { errorMessage, rowAction } from "$lib/async";
  import { fetchAllRows, supabase } from "$lib/supabase";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import Button from "$lib/ui/Button.svelte";
  import Card from "$lib/ui/Card.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import Spinner from "$lib/ui/Spinner.svelte";
  import { IconInbox } from "$lib/ui/icons";
  import { VINTAGE_LABEL_SELECT, vintageLabel } from "$lib/wine";
  import { formatDate, formatDateTime, formatEUR } from "$lib/format";
  import { contactReason } from "$lib/contact";
  import {
    createSaleFromWish,
    setContactStatus,
    setWishStatus,
    wishItems,
    wishTotal,
    type ContactMessage,
    type WishRequest,
  } from "$lib/wishes";

  /**
   * Tout ce qui arrive du public et attend une action : messages du formulaire de contact
   * (dont « Commander des vins ») et « J'en veux » passés pendant une dégustation.
   * Les réservations en ligne n'y sont pas : elles deviennent des participants toutes seules.
   */
  type Item = { kind: "message"; r: ContactMessage } | { kind: "wish"; r: WishRequest };
  type Filter = "new" | "handled" | "all";

  const { refreshCounts } = getContext<{ refreshCounts: () => void }>("manage");

  let loading = $state(true);
  let error = $state("");
  let wishes = $state.raw<WishRequest[]>([]);
  let messages = $state.raw<ContactMessage[]>([]);
  let vintages = $state.raw(new Map<string, any>());
  let tastings = new Map<string, any>();
  let filter = $state<Filter>("new");
  let busyId = $state("");

  onMount(async () => {
    try {
      const [, vRows, tRows] = await Promise.all([
        loadRequests(),
        fetchAllRows<any>((a, b) =>
          supabase
            .from("wine_vintage")
            .select(`id, price, ${VINTAGE_LABEL_SELECT}`)
            .order("id")
            .range(a, b),
        ),
        fetchAllRows<any>((a, b) => supabase.from("tasting").select("id, name, date").order("id").range(a, b)),
      ]);
      vintages = new Map(vRows.map((v) => [v.id, v]));
      tastings = new Map(tRows.map((t) => [t.id, t]));
    } catch (e) {
      error = errorMessage(e);
    } finally {
      loading = false;
    }
  });

  /** Seules les demandes changent après une action : produits et dégustations restent en mémoire. */
  async function loadRequests() {
    /* Paginé : au-delà de 1000 lignes, PostgREST tronquerait la liste sans le dire. */
    [wishes, messages] = await Promise.all([
      fetchAllRows<WishRequest>((a, b) =>
        supabase.from("wish_request").select("*").order("created_at", { ascending: false }).order("id").range(a, b),
      ),
      fetchAllRows<ContactMessage>((a, b) =>
        supabase.from("contact_message").select("*").order("created_at", { ascending: false }).order("id").range(a, b),
      ),
    ]);
  }

  let prices = $derived(new Map([...vintages.values()].map((v) => [v.id, Number(v.price ?? 0)])));
  let items = $derived(
    [
      ...messages.map((r): Item => ({ kind: "message", r })),
      ...wishes.map((r): Item => ({ kind: "wish", r })),
    ].sort((a, b) => b.r.created_at.localeCompare(a.r.created_at)),
  );
  let counts = $derived({
    new: items.filter((i) => i.r.status === "new").length,
    handled: items.filter((i) => i.r.status !== "new").length,
    all: items.length,
  });
  let shown = $derived(
    filter === "all" ? items : items.filter((i) => (filter === "new") === (i.r.status === "new")),
  );

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "new", label: "À traiter" },
    { key: "handled", label: "Traitées" },
    { key: "all", label: "Toutes" },
  ];

  function tastingName(id: string | null): string {
    if (!id) return "Site";
    const t = tastings.get(id);
    return t ? t.name || `Dégustation du ${formatDate(t.date)}` : "Dégustation";
  }

  function replyHref(m: ContactMessage): string {
    const label = contactReason(m.reason)?.label ?? "Votre message";
    /* Adresse encodée : un « ? » ou un « & » saisi dans l'email ne doit pas ajouter de destinataire. */
    return `mailto:${encodeURIComponent(m.email).replace("%40", "@")}?subject=${encodeURIComponent(`Re: ${label}${m.subject ? ` — ${m.subject}` : ""}`)}`;
  }

  /** Change le statut sur place, sans recharger toutes les demandes. */
  function setStatus(item: Item, status: "new" | "done" | "dismissed") {
    const id = item.r.id;
    return run(id, async () => {
      if (item.kind === "message") {
        await setContactStatus(id, status === "new" ? "new" : "done");
        messages = messages.map((m) => (m.id === id ? { ...m, status } : m));
      } else {
        await setWishStatus(id, status);
        wishes = wishes.map((w) => (w.id === id ? { ...w, status } : w));
      }
    });
  }

  const run = rowAction({ busy: (id) => (busyId = id), error: (m) => (error = m), after: refreshCounts });
</script>

<svelte:head>
  <title>Demandes - Gestion</title>
</svelte:head>

<ManagePageShell title="Demandes" subtitle="Messages du site et commandes « J’en veux » des dégustations">
  {#if loading}
    <Spinner />
  {:else}
    {#if error}<div class="error-message" role="alert">{error}</div>{/if}

    <div class="filters" role="group" aria-label="Filtrer les demandes">
      {#each FILTERS as f}
        <button type="button" class="ui-chip" aria-pressed={filter === f.key} onclick={() => (filter = f.key)}>
          {f.label}<span class="count">{counts[f.key]}</span>
        </button>
      {/each}
    </div>

    {#if shown.length === 0}
      <Card>
        <EmptyState
          icon={IconInbox}
          title={filter === "new" ? "Rien à traiter" : "Aucune demande ici"}
          text="Les messages du formulaire de contact et les « J’en veux » des dégustations arrivent ici."
        />
      </Card>
    {:else}
      <div class="cards">
        {#each shown as item (item.kind + item.r.id)}
          {@const r = item.r}
          <Card>
            <article class="request" class:faded={r.status !== "new"}>
              <header>
                <div class="who">
                  <strong>{r.first_name} {r.last_name || ""}</strong>
                  <span class="t-caption">{[r.email, r.phone].filter(Boolean).join(" · ")}</span>
                </div>
                <div class="right">
                  <span class="source">
                    {item.kind === "message" ? (contactReason(item.r.reason)?.label ?? "Message") : `« J’en veux » · ${tastingName(item.r.tasting_id)}`}
                  </span>
                  <span class="t-caption">{formatDateTime(r.created_at)}</span>
                </div>
              </header>
              {#if item.kind === "message"}
                {@const m = item.r}
                {#if m.subject}<p class="t-caption">À propos de : <strong>{m.subject}</strong></p>{/if}
                <p class="message">{m.message}</p>
                <footer>
                  <Button size="sm" href={replyHref(m)}>Répondre par email</Button>
                  <Button size="sm" variant="ghost" disabled={busyId === m.id} onclick={() => setStatus(item, m.status === "new" ? "done" : "new")}>
                    {m.status === "new" ? "Marquer comme traité" : "Remettre à traiter"}
                  </Button>
                </footer>
              {:else}
                {@const w = item.r}
                <ul class="lines">
                  {#each wishItems(w.items) as it}
                    <li>
                      <span class="qty">{it.quantity} ×</span>
                      <span>{vintageLabel(vintages.get(it.wine_vintage_id))}</span>
                      <span class="num">{formatEUR(it.quantity * (prices.get(it.wine_vintage_id) ?? 0))}</span>
                    </li>
                  {/each}
                  <li class="total">
                    <span></span>
                    <span>Total au prix catalogue</span>
                    <strong class="num">{formatEUR(wishTotal(w, prices))}</strong>
                  </li>
                </ul>
                {#if w.message}<p class="message">« {w.message} »</p>{/if}
                <footer>
                  {#if w.status === "new"}
                    <Button size="sm" disabled={busyId === w.id} onclick={() => run(w.id, () => createSaleFromWish(w, prices, tastingName(w.tasting_id)).then(loadRequests))}>
                      {busyId === w.id ? "…" : "Créer la vente (en attente)"}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busyId === w.id} onclick={() => setStatus(item, "dismissed")}>Ignorer</Button>
                  {:else if w.status === "done"}
                    <Button size="sm" href="/manage/sales">Voir les ventes</Button>
                    <span class="t-caption">Vente créée, client retrouvé ou créé (email, téléphone).</span>
                  {:else}
                    <span class="t-caption">Ignorée</span>
                    <Button size="sm" variant="ghost" disabled={busyId === w.id} onclick={() => setStatus(item, "new")}>Remettre à traiter</Button>
                  {/if}
                </footer>
              {/if}
            </article>
          </Card>
        {/each}
      </div>
    {/if}
  {/if}
</ManagePageShell>

<style>
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 20px;
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr));
    gap: 16px;
    align-items: start;
  }

  .request {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .request.faded {
    opacity: 0.7;
  }

  header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
  }

  .who,
  .right {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .who strong {
    font-size: 16px;
  }

  .right {
    text-align: right;
    flex-shrink: 0;
  }

  .source {
    font-size: 13px;
    font-weight: 600;
    color: var(--teal-600);
  }

  .message {
    margin: 0;
    white-space: pre-line;
    overflow-wrap: anywhere;
  }

  .lines {
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: 14px;
  }

  .lines li {
    display: grid;
    grid-template-columns: 3rem 1fr auto;
    gap: 8px;
    padding: 6px 0;
    border-bottom: 1px solid var(--border-soft);
  }

  .lines .total {
    border-bottom: none;
    color: var(--ink-2);
  }

  .qty {
    color: var(--ink-2);
    white-space: nowrap;
  }

  footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
</style>
