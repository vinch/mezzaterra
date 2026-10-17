<script lang="ts">
  import { onMount } from "svelte";
  import { flip } from "svelte/animate";
  import { fade } from "svelte/transition";
  import { page } from "$app/stores";
  import WineCard from "$lib/components/site/WineCard.svelte";
  import { fetchAvailability, type Availability } from "$lib/publicData";
  import { STYLE_ORDER, allWineStyles, wineStyle, wineTitle, type WineStyleKey } from "$lib/wine";

  export let data;

  let availability: Map<string, Availability> | null = null;
  let styleFilter: WineStyleKey | "" = "";
  let inStockOnly = false;
  let query = "";

  onMount(async () => {
    availability = await fetchAvailability();
  });

  $: vintages = data.vintages as any[];
  $: presentStyles = allWineStyles().filter((s) =>
    vintages.some((v) => wineStyle(v.wine?.wine_type).key === s.key),
  );

  function normalize(s: string): string {
    return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  }

  $: filtered = vintages
    .filter((v) => !styleFilter || wineStyle(v.wine?.wine_type).key === styleFilter)
    .filter((v) => !inStockOnly || !availability || availability.get(v.id)?.in_stock)
    .filter((v) => {
      if (!query.trim()) return true;
      const blob = normalize(
        [
          wineTitle(v.wine),
          v.wine?.appelation?.name,
          v.wine?.winery?.name,
          v.year,
          ...(v.wine_vintage_grape || []).map((g: any) => g.grape?.name),
        ]
          .filter(Boolean)
          .join(" "),
      );
      return normalize(query)
        .split(/\s+/)
        .every((w) => blob.includes(w));
    })
    .sort((a, b) => {
      const sa = STYLE_ORDER.indexOf(wineStyle(a.wine?.wine_type).key);
      const sb = STYLE_ORDER.indexOf(wineStyle(b.wine?.wine_type).key);
      if (sa !== sb) return sa - sb;
      return wineTitle(a.wine).localeCompare(wineTitle(b.wine), "fr");
    });

  type WineryGroup = { winery: any; items: any[] };

  /* Regroupement par domaine. */
  function groupByWinery(list: any[]): WineryGroup[] {
    const acc = new Map<string, WineryGroup>();
    for (const v of list) {
      const w = v.wine?.winery;
      const key = w?.id || "autres";
      if (!acc.has(key)) acc.set(key, { winery: w, items: [] });
      acc.get(key)!.items.push(v);
    }
    return [...acc.values()].sort((a, b) =>
      (a.winery?.name || "").localeCompare(b.winery?.name || "", "fr"),
    );
  }

  $: groups = groupByWinery(filtered);

  function mapUrl(w: any): string | null {
    if (w?.latitude == null || w?.longitude == null) return null;
    return `https://www.openstreetmap.org/?mlat=${w.latitude}&mlon=${w.longitude}#map=12/${w.latitude}/${w.longitude}`;
  }
</script>

<svelte:head>
  <title>Nos vins — Mezzaterra</title>
  <meta property="og:title" content="Nos vins — Mezzaterra" />
  <meta property="og:description" content="Montepulciano, Pecorino, Cerasuolo… la cave Mezzaterra, domaine par domaine." />
  <meta property="og:url" content={$page.url.href} />
</svelte:head>

<section class="intro">
  <div class="mz-container mz-rise">
    <span class="mz-eyebrow">La cave</span>
    <h1 class="mz-display mz-h1">Nos vins</h1>
    <p class="mz-lead">
      Des domaines familiaux des Abruzzes, entre mer Adriatique et massif du Gran Sasso.
    </p>
  </div>
</section>

<div class="mz-container">
  <div class="toolbar">
    <div class="chips" role="group" aria-label="Filtrer par couleur">
      <button type="button" class="filter-chip" class:on={!styleFilter} on:click={() => (styleFilter = "")}>Tous</button>
      {#each presentStyles as s}
        <button
          type="button"
          class="filter-chip"
          class:on={styleFilter === s.key}
          on:click={() => (styleFilter = styleFilter === s.key ? "" : s.key)}
          aria-pressed={styleFilter === s.key}
        >
          <span class="mz-dot" style="background: {s.color}"></span>{s.label}
        </button>
      {/each}
      {#if availability}
        <label class="filter-chip toggle" class:on={inStockOnly}>
          <input type="checkbox" bind:checked={inStockOnly} />
          Disponibles
        </label>
      {/if}
    </div>
    <input class="mz-input search" type="search" placeholder="Rechercher un vin, un cépage…" bind:value={query} aria-label="Rechercher" />
  </div>

  {#if data.error}
    <p class="mz-empty">{data.error}</p>
  {:else if groups.length === 0}
    <p class="mz-empty">Aucun vin ne correspond à ces critères.</p>
  {:else}
    {#each groups as group (group.winery?.id || "autres")}
      <section class="winery" id={group.winery?.id ? `domaine-${group.winery.id}` : undefined} transition:fade={{ duration: 150 }}>
        <header class="winery-head">
          <div>
            <h2 class="mz-display mz-h2">{group.winery?.name || "Autres"}</h2>
            <p class="mz-muted">
              {group.winery?.region?.country?.flag || group.winery?.country?.flag || ""}
              {[group.winery?.city, group.winery?.region?.name].filter(Boolean).join(", ")}
            </p>
          </div>
          <div class="winery-links">
            {#if mapUrl(group.winery)}
              <a class="mz-btn mz-btn--ghost mz-btn--sm" href={mapUrl(group.winery)} target="_blank" rel="noopener noreferrer">Sur la carte</a>
            {/if}
            {#if group.winery?.url}
              <a class="mz-btn mz-btn--ghost mz-btn--sm" href={group.winery.url} target="_blank" rel="noopener noreferrer">Site du domaine</a>
            {/if}
          </div>
        </header>
        <div class="grid">
          {#each group.items as v (v.id)}
            <div animate:flip={{ duration: 250 }}>
              <WineCard vintage={v} href="/vins/{v.id}" availability={availability?.get(v.id) ?? null} />
            </div>
          {/each}
        </div>
      </section>
    {/each}
  {/if}
</div>

<style>
  .intro {
    padding: 3rem 0 1.5rem;
  }

  .intro h1 {
    margin: 0.5rem 0 0.75rem;
  }

  .toolbar {
    position: sticky;
    top: 4.6rem;
    z-index: 5;
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1rem;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 0;
    background: var(--mz-paper);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.9rem;
    border-radius: 999px;
    border: 1px solid var(--mz-line);
    background: transparent;
    color: var(--mz-ink-soft);
    font: inherit;
    font-size: 0.88rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .filter-chip:hover {
    border-color: var(--mz-teal);
    color: var(--mz-teal);
  }

  .filter-chip.on {
    background: var(--mz-teal);
    border-color: var(--mz-teal);
    color: #fff;
  }

  .toggle input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .search {
    flex: 0 1 18rem;
    padding: 0.55rem 0.9rem;
    border-radius: 999px;
    font-size: 0.92rem;
  }

  .winery {
    padding: 2rem 0 1rem;
    scroll-margin-top: 9rem;
  }

  .winery-head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
    padding-bottom: 1rem;
    margin-bottom: 1.25rem;
    border-bottom: 1px solid var(--mz-line-soft);
  }

  .winery-head p {
    margin: 0.35rem 0 0;
  }

  .winery-links {
    display: flex;
    gap: 0.5rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
    gap: 1.25rem;
  }

  .grid > div {
    display: grid;
  }

  @media (max-width: 720px) {
    .toolbar {
      top: 6.2rem;
    }

    .search {
      flex: 1 1 100%;
    }
  }
</style>
