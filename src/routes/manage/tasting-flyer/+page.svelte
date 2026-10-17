<script lang="ts">
  import { onMount } from "svelte";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import { supabase } from "$lib/supabase";
  import { todayIso } from "$lib/dates";
  import {
    FLYER_WIDTH,
    FLYER_HEIGHT,
    loadFlyerAssets,
    drawTastingFlyer,
    type FlyerAssets,
  } from "$lib/tastingFlyer";

  let canvasEl: HTMLCanvasElement | null = null;
  let assets: FlyerAssets | null = null;
  let loading = true;
  let error = "";
  let sharing = false;

  let date = nextFridayIsoDate();
  let time = "18:30";
  let price = 20;

  /** Prochain vendredi (aujourd’hui inclus). */
  function nextFridayIsoDate(): string {
    const d = new Date();
    d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  onMount(async () => {
    void prefillFromNextTasting();
    try {
      assets = await loadFlyerAssets();
    } catch (e) {
      error = e instanceof Error ? e.message : "Impossible de charger le visuel";
    } finally {
      loading = false;
    }
  });

  /** Reprend la date (et l’heure / le prix s’ils sont renseignés) de la prochaine dégustation. */
  async function prefillFromNextTasting() {
    const { data } = await supabase
      .from("tasting")
      .select("*")
      .gte("date", todayIso())
      .order("date", { ascending: true })
      .limit(1);
    const next = (data || [])[0] as any;
    if (!next) return;
    date = next.date;
    if (next.start_time) time = String(next.start_time).slice(0, 5);
    if (next.price != null) price = Number(next.price);
  }

  $: if (canvasEl && assets) {
    drawTastingFlyer(canvasEl.getContext("2d")!, assets, {
      date,
      time,
      price: Number(price) || 0,
    });
  }

  $: fileName = `degustation-${date || "visuel"}.png`;

  function canvasBlob(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!canvasEl) return reject(new Error("Aperçu indisponible"));
      canvasEl.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Export PNG impossible"))),
        "image/png",
      );
    });
  }

  async function handleDownload() {
    error = "";
    try {
      const url = URL.createObjectURL(await canvasBlob());
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      error = e instanceof Error ? e.message : "Erreur lors du téléchargement";
    }
  }

  $: canShare =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({
      files: [new File([], "test.png", { type: "image/png" })],
    });

  async function handleShare() {
    error = "";
    sharing = true;
    try {
      const file = new File([await canvasBlob()], fileName, { type: "image/png" });
      await navigator.share({ files: [file] });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        error = e instanceof Error ? e.message : "Erreur lors du partage";
      }
    } finally {
      sharing = false;
    }
  }
</script>

<svelte:head>
  <title>Visuel dégustation - Gestion</title>
</svelte:head>

<ManagePageShell title="Visuel dégustation">
  {#if error}
    <div class="error-message">{error}</div>
  {/if}

  <div class="flyer-layout">
    <div class="filters-container flyer-form">
      <h2 class="panel-title">Informations</h2>
      <div class="filter-group">
        <label for="flyer-date">Date</label>
        <input type="date" id="flyer-date" bind:value={date} required />
      </div>
      <div class="filter-group">
        <label for="flyer-time">Heure</label>
        <input type="time" id="flyer-time" bind:value={time} required />
      </div>
      <div class="filter-group">
        <label for="flyer-price">Prix par personne (€)</label>
        <input
          type="number"
          id="flyer-price"
          min="0"
          step="0.5"
          bind:value={price}
          required
        />
      </div>

      <div class="flyer-actions">
        <button
          type="button"
          class="btn-primary"
          on:click={handleDownload}
          disabled={loading || !assets}
        >
          Télécharger (PNG)
        </button>
        {#if canShare}
          <button
            type="button"
            class="btn-secondary"
            on:click={handleShare}
            disabled={loading || !assets || sharing}
          >
            Partager
          </button>
        {/if}
      </div>
      <p class="flyer-hint">Format {FLYER_WIDTH} × {FLYER_HEIGHT} px.</p>
    </div>

    <div class="flyer-preview">
      {#if loading}
        <div class="loading">Chargement du visuel…</div>
      {/if}
      <canvas
        bind:this={canvasEl}
        width={FLYER_WIDTH}
        height={FLYER_HEIGHT}
        class:hidden={loading}
        aria-label="Aperçu du visuel de la dégustation"
      ></canvas>
    </div>
  </div>
</ManagePageShell>

<style>
  .flyer-layout {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 1.5rem;
  }

  .flyer-form {
    flex: 0 1 20rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 0;
  }

  .flyer-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .flyer-hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--ink-2);
  }

  .flyer-preview {
    flex: 1 1 20rem;
    max-width: 480px;
  }

  .flyer-preview canvas {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .flyer-preview canvas.hidden {
    display: none;
  }
</style>
