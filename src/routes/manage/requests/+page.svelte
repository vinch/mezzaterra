<script lang="ts">
  import { onMount } from "svelte";
  import { supabase } from "$lib/supabase";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import { vintageLabel } from "$lib/wine";
  import { formatDate, formatEUR } from "$lib/format";
  import { createSaleFromWish, setWishStatus, wishItems, wishTotal, type WishRequest } from "$lib/wishes";

  let loading = true;
  let error = "";
  let wishes: WishRequest[] = [];
  let vintages = new Map<string, any>();
  let tastings = new Map<string, any>();
  type Filter = "new" | "done" | "dismissed" | "all";
  let filter: Filter = "new";
  let busyId = "";

  onMount(async () => {
    await load();
    loading = false;
  });

  async function load() {
    const [, vRes, tRes] = await Promise.all([
      loadWishes(),
      supabase
        .from("wine_vintage")
        .select("id, year, production_year, price, wine ( name, winery ( name ), appelation ( name, label ( name ) ) )"),
      supabase.from("tasting").select("id, name, date"),
    ]);
    vintages = new Map((vRes.data || []).map((v: any) => [v.id, v]));
    tastings = new Map((tRes.data || []).map((t: any) => [t.id, t]));
  }

  /** Seules les demandes changent après une action : millésimes et dégustations restent en mémoire. */
  async function loadWishes() {
    const { data, error: fetchError } = await supabase
      .from("wish_request")
      .select("*")
      .order("created_at", { ascending: false });
    if (fetchError) {
      error = fetchError.message;
      return;
    }
    wishes = (data || []) as unknown as WishRequest[];
  }

  $: prices = new Map([...vintages.values()].map((v) => [v.id, Number(v.price ?? 0)]));
  $: shown = filter === "all" ? wishes : wishes.filter((w) => w.status === filter);
  $: counts = {
    new: wishes.filter((w) => w.status === "new").length,
    done: wishes.filter((w) => w.status === "done").length,
    dismissed: wishes.filter((w) => w.status === "dismissed").length,
    all: wishes.length,
  };

  function tastingName(id: string | null): string {
    if (!id) return "Site";
    const t = tastings.get(id);
    return t ? t.name || `Dégustation du ${formatDate(t.date)}` : "Dégustation";
  }

  async function run(w: WishRequest, action: () => Promise<unknown>) {
    error = "";
    busyId = w.id;
    try {
      await action();
      await loadWishes();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busyId = "";
    }
  }

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "new", label: "À traiter" },
    { key: "done", label: "Transformées en vente" },
    { key: "dismissed", label: "Ignorées" },
    { key: "all", label: "Toutes" },
  ];
</script>

<svelte:head>
  <title>Demandes - Gestion</title>
</svelte:head>

<ManagePageShell title="Demandes">
  {#if loading}
    <div class="loading">Chargement…</div>
  {:else}
    {#if error}<div class="error-message">{error}</div>{/if}

    <div class="tabs" role="tablist">
      {#each FILTERS as f}
        <button type="button" role="tab" class:active={filter === f.key} aria-selected={filter === f.key} on:click={() => (filter = f.key)}>
          {f.label} <span class="count">{counts[f.key]}</span>
        </button>
      {/each}
    </div>

    {#if shown.length === 0}
      <div class="empty-state"><p>Aucune demande ici.</p></div>
    {:else}
      <div class="cards">
        {#each shown as w (w.id)}
          <article class="card" class:faded={w.status !== "new"}>
            <header>
              <div>
                <strong class="who">{w.first_name} {w.last_name || ""}</strong>
                <span class="meta">{[w.email, w.phone].filter(Boolean).join(" · ")}</span>
              </div>
              <div class="right">
                <span class="source">{tastingName(w.tasting_id)}</span>
                <span class="meta">{new Date(w.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
              </div>
            </header>
            <table class="lines">
              <tbody>
                {#each wishItems(w.items) as it}
                  <tr>
                    <td class="qty">{it.quantity} ×</td>
                    <td>{vintageLabel(vintages.get(it.wine_vintage_id))}</td>
                    <td class="num">{formatEUR(it.quantity * (prices.get(it.wine_vintage_id) ?? 0))}</td>
                  </tr>
                {/each}
              </tbody>
              <tfoot>
                <tr><td></td><td>Total au prix catalogue</td><td class="num"><strong>{formatEUR(wishTotal(w, prices))}</strong></td></tr>
              </tfoot>
            </table>
            {#if w.message}<p class="message">« {w.message} »</p>{/if}
            <footer>
              {#if w.status === "new"}
                <button type="button" class="btn-primary" disabled={busyId === w.id} on:click={() => run(w, () => createSaleFromWish(w, prices, tastingName(w.tasting_id)))}>
                  {busyId === w.id ? "…" : "Créer la vente (en attente)"}
                </button>
                <button type="button" class="btn-secondary" disabled={busyId === w.id} on:click={() => run(w, () => setWishStatus(w.id, "dismissed"))}>Ignorer</button>
              {:else if w.status === "done"}
                <a class="btn-secondary" href="/manage/sales">Voir les ventes</a>
                <span class="meta">Client créé ou retrouvé automatiquement (email / téléphone).</span>
              {:else}
                <button type="button" class="btn-secondary" disabled={busyId === w.id} on:click={() => run(w, () => setWishStatus(w.id, "new"))}>Remettre à traiter</button>
              {/if}
            </footer>
          </article>
        {/each}
      </div>
    {/if}
  {/if}
</ManagePageShell>

<style>
  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 1.25rem;
  }

  .tabs button {
    padding: 0.45rem 0.9rem;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: white;
    font: inherit;
    font-size: 0.9rem;
    cursor: pointer;
  }

  .tabs button.active {
    background: var(--teal-600);
    border-color: var(--teal-600);
    color: white;
  }

  .count {
    opacity: 0.7;
    margin-left: 0.2rem;
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr));
    gap: 1rem;
  }

  .card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.07);
    padding: 1.1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .card.faded {
    opacity: 0.7;
  }

  header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
  }

  header > div {
    display: flex;
    flex-direction: column;
  }

  .right {
    text-align: right;
  }

  .who {
    font-size: 1.05rem;
  }

  .meta {
    font-size: 0.82rem;
    color: var(--ink-2);
  }

  .source {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--teal-600);
  }

  .lines {
    width: 100%;
    font-size: 0.9rem;
  }

  .lines td {
    padding: 0.3rem 0.25rem;
    border-bottom: 1px solid #f3f3f3;
  }

  .lines tfoot td {
    border-bottom: none;
    color: var(--ink-2);
  }

  .qty {
    width: 3rem;
    color: var(--ink-2);
    white-space: nowrap;
  }

  .num {
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .message {
    margin: 0;
    font-style: italic;
    color: var(--mz-ink-soft);
  }

  footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-top: auto;
  }

  footer a {
    text-decoration: none;
  }
</style>
