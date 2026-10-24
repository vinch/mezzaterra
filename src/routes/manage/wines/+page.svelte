<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import type { Wine, Winery, Appelation, WineType } from "$lib/types";
  import { goto } from "$app/navigation";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import Modal from "$lib/ui/Modal.svelte";
  import Button from "$lib/ui/Button.svelte";
  import IconButton from "$lib/ui/IconButton.svelte";
  import RowMenu from "$lib/ui/RowMenu.svelte";
  import type { MenuItem } from "$lib/ui/Menu.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import DataTable from "$lib/ui/DataTable.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import Field from "$lib/ui/Field.svelte";
  import StockBadge from "$lib/ui/StockBadge.svelte";
  import WineDot, { robeOf, ROBE_LABEL, type Robe } from "$lib/ui/WineDot.svelte";
  import {
    IconArchive,
    IconArchiveRestore,
    IconClipboard,
    IconEye,
    IconPencil,
    IconPlus,
    IconSearch,
    IconTrash,
    IconWine,
    IconX,
  } from "$lib/ui/icons";
  import IconPlate from "@lucide/svelte/icons/utensils-crossed";
  import { formatEUR } from "$lib/format";
  import { promptReorder } from "$lib/reorder";
  import { isDiscontinued } from "$lib/wine";
  import { fetchStockMap } from "$lib/manageData";
  import { errorMessage } from "$lib/async";

  let wines: Wine[] = [];
  let wineries: Winery[] = [];
  let appellations: Appelation[] = [];
  let wineTypes: WineType[] = [];
  let loading = true;
  let error = "";
  let showModal = false;
  let editingWine: Wine | null = null;

  // Pairings modal state
  let showPairingsModal = false;
  let selectedWine: Wine | null = null;
  let winePairings: any[] = [];
  let allPairings: any[] = [];
  let selectedPairingId = "";

  // Filter state
  let filterWineryId = "";
  let filterAppelationId = "";
  let filterWineTypeId = "";
  let searchText = "";

  // Form fields
  let formData = {
    name: "",
    description: "",
    winery_id: "",
    appelation_id: "",
    wine_type_id: "",
  };

  onMount(async () => {
    void Promise.all([loadWineries(), loadAppellations(), loadWineTypes(), loadAllPairings()]);
    /* Fin du chargement une fois le stock aussi arrivé : sinon les vins s'affichent en rupture. */
    try {
      await Promise.all([loadStock(), loadWines()]);
    } finally {
      loading = false;
    }
  });

  async function loadAllPairings() {
    const { data } = await supabase
      .from("pairing")
      .select("*")
      .order("description");
    if (data) allPairings = data;
  }

  async function loadWines() {
    const { data, error: fetchError } = await supabase
      .from("wine")
      .select("*, winery (*), appelation ( *, label (*) ), wine_type (*), wine_vintage (*)")
      .order("created_at", { ascending: false });

    if (fetchError) {
      error = fetchError.message;
    } else {
      /* Millésimes triés une fois ici (du plus ancien au plus récent) plutôt qu'à chaque rendu. */
      for (const w of data || []) {
        w.wine_vintage.sort(
          (a, b) => (a.year ?? a.production_year ?? 0) - (b.year ?? b.production_year ?? 0),
        );
      }
      wines = (data || []).sort((a, b) => {
        // First: sort by winery name
        const wineryA = a.winery?.name?.toLowerCase() || "";
        const wineryB = b.winery?.name?.toLowerCase() || "";
        if (wineryA !== wineryB) {
          return wineryA.localeCompare(wineryB);
        }

        // Second: sort by wine name or appellation
        const wineNameA =
          a.name?.toLowerCase() || a.appelation?.name?.toLowerCase() || "";
        const wineNameB =
          b.name?.toLowerCase() || b.appelation?.name?.toLowerCase() || "";
        return wineNameA.localeCompare(wineNameB);
      });
    }
  }

  async function loadWineries() {
    const { data } = await supabase.from("winery").select("*").order("name");
    if (data) wineries = data;
  }

  async function loadAppellations() {
    const { data } = await supabase.from("appelation").select("*, label (*)").order("name");
    if (data) appellations = data;
  }

  async function loadWineTypes() {
    const { data } = await supabase.from("wine_type").select("*").order("name");
    if (data) wineTypes = data;
  }

  function openCreateModal() {
    editingWine = null;
    resetForm();
    showModal = true;
  }

  function openEditModal(wine: Wine) {
    editingWine = wine;
    formData = {
      name: wine.name || "",
      description: wine.description || "",
      winery_id: wine.winery_id || "",
      appelation_id: wine.appelation_id || "",
      wine_type_id: wine.wine_type_id || "",
    };
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingWine = null;
    resetForm();
  }

  function resetForm() {
    formData = {
      name: "",
      description: "",
      winery_id: "",
      appelation_id: "",
      wine_type_id: "",
    };
  }

  async function handleSubmit() {
    if (!formData.winery_id || !formData.wine_type_id) {
      error = "Nom, vignoble et type de vin sont obligatoires";
      return;
    }

    const wineData: any = {
      name: formData.name || null,
      description: formData.description || null,
      winery_id: formData.winery_id,
      wine_type_id: formData.wine_type_id,
    };

    // Include appelation_id only if it has a value, or set to null to clear it
    if (editingWine) {
      // For updates, set to null if empty to allow clearing the appellation
      wineData.appelation_id = formData.appelation_id || null;
    } else {
      // For inserts, only include if it has a value
      if (formData.appelation_id) {
        wineData.appelation_id = formData.appelation_id;
      }
    }

    if (editingWine) {
      const { error: updateError } = await supabase
        .from("wine")
        .update(wineData)
        .eq("id", editingWine.id);

      if (updateError) {
        error = updateError.message;
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("wine")
        .insert(wineData);

      if (insertError) {
        error = insertError.message;
        return;
      }
    }

    closeModal();
    await loadWines();
  }

  /** Appelée après confirmation via le ConfirmDialog. */
  async function deleteWine(id: string) {
    const { error: deleteError } = await supabase
      .from("wine")
      .delete()
      .eq("id", id);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    await loadWines();
  }

  // Pairings modal functions
  async function openPairingsModal(wine: Wine) {
    selectedWine = wine;
    await loadWinePairings();
    showPairingsModal = true;
  }

  async function loadWinePairings() {
    if (!selectedWine) return;

    const { data } = await supabase
      .from("wine_pairing")
      .select(
        `
        pairing_id,
        pairing (*)
      `
      )
      .eq("wine_id", selectedWine.id);

    winePairings = data || [];
  }

  async function addPairing() {
    if (!selectedPairingId || !selectedWine) return;

    const { error: insertError } = await supabase.from("wine_pairing").insert({
      wine_id: selectedWine.id,
      pairing_id: selectedPairingId,
    });

    if (insertError) {
      error = insertError.message;
      return;
    }

    selectedPairingId = "";
    await loadWinePairings();
  }

  async function removePairing(pairingId: string) {
    if (!selectedWine) return;

    if (!confirm("Êtes-vous sûr de vouloir supprimer ce pairing ?")) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("wine_pairing")
      .delete()
      .eq("wine_id", selectedWine.id)
      .eq("pairing_id", pairingId);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    await loadWinePairings();
  }

  function closePairingsModal() {
    showPairingsModal = false;
    selectedWine = null;
    winePairings = [];
    selectedPairingId = "";
  }

  $: linkedPairingIds = new Set(winePairings.map((wp) => wp.pairing_id));

  // Filter wines based on selected filters
  $: filteredWines = wines.filter((wine) => {
    // Filter by winery
    if (filterWineryId && wine.winery_id !== filterWineryId) {
      return false;
    }

    // Filter by appellation
    if (filterAppelationId && wine.appelation_id !== filterAppelationId) {
      return false;
    }

    // Filter by wine type
    if (filterWineTypeId && wine.wine_type_id !== filterWineTypeId) {
      return false;
    }

    // Filter by search text (vignoble, nom, appellation)
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      const wineryName = wine.winery?.name?.toLowerCase() || "";
      const wineName = wine.name?.toLowerCase() || "";
      const appelationName = wine.appelation?.name?.toLowerCase() || "";
      const appelationLabel = wine.appelation?.label?.name?.toLowerCase() || "";

      const matchesSearch =
        wineryName.includes(searchLower) ||
        wineName.includes(searchLower) ||
        appelationName.includes(searchLower) ||
        appelationLabel.includes(searchLower);

      if (!matchesSearch) {
        return false;
      }
    }

    return true;
  });

  function clearFilters() {
    filterWineryId = "";
    filterAppelationId = "";
    filterWineTypeId = "";
    searchText = "";
  }

  /* ——— Interface (refonte) ——— */
  /** null : stock illisible, affiché « — » plutôt qu'en fausse rupture (cause dans stockError). */
  let stock: Map<string, number> | null = new Map();
  let stockError = "";
  async function loadStock() {
    try {
      stock = await fetchStockMap();
    } catch (e) {
      stock = null;
      stockError = `Stock indisponible : ${errorMessage(e)}`;
    }
  }

  let robeFilter: Robe | "" = "";
  let inStockOnly = false;
  const ROBES: Robe[] = ["rouge", "blanc", "rose"];

  /** Millésimes du plus ancien au plus récent (triés au chargement). */
  function vintagesOf(wine: any): any[] {
    return wine.wine_vintage || [];
  }
  /* Bouteilles en stock et badge par vin, recalculés quand les vins ou le stock arrivent. */
  $: stockById = new Map(
    wines.map((w: any) => {
      const total = vintagesOf(w).reduce((n, v) => n + Math.max(0, stock?.get(v.id) ?? 0), 0);
      return [w.id, { total, badge: stockBadge(w, total, !!stock) }];
    }),
  );
  /** Dernier millésime qu'on peut encore recommander au fournisseur. */
  function latestVintage(wine: any): any | null {
    const list = vintagesOf(wine).filter((v) => !isDiscontinued(v));
    return list.length ? list[list.length - 1] : null;
  }
  /** Tous les millésimes sont « plus jamais disponibles » : le vin est retiré. */
  function isRetired(wine: any): boolean {
    const list = vintagesOf(wine);
    return list.length > 0 && list.every(isDiscontinued);
  }
  /** Badge de stock d'un vin (aucun si le stock est illisible, sauf pour un vin retiré). */
  function stockBadge(wine: any, total: number, stockKnown: boolean): "gone" | "out" | "low" | null {
    if (isRetired(wine)) return "gone";
    if (!stockKnown) return null;
    if (vintagesOf(wine).length && total <= 0) return "out";
    return total > 0 && total <= 3 ? "low" : null;
  }
  function priceText(wine: any): string {
    const prices = vintagesOf(wine)
      .map((v) => (v.price != null ? Number(v.price) : null))
      .filter((p): p is number => p != null);
    if (!prices.length) return "—";
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? formatEUR(min) : `${formatEUR(min)} – ${formatEUR(max)}`;
  }
  function wineTitle(wine: any): string {
    return wine.name?.trim() || wine.appelation?.name || "Vin sans nom";
  }

  /* Vins retirés en fin de liste : visibles, mais hors du chemin. */
  $: shownWines = filteredWines
    .filter((w: any) => !robeFilter || robeOf(w.wine_type) === robeFilter)
    .filter((w: any) => !inStockOnly || !stock || (stockById.get(w.id)?.total ?? 0) > 0)
    .sort((a: any, b: any) => Number(isRetired(a)) - Number(isRetired(b)));
  $: vintageCount = wines.reduce((n, w: any) => n + (w.wine_vintage?.length ?? 0), 0);
  $: bottleCount = stock ? [...stock.values()].reduce((n, q) => n + Math.max(0, q), 0) : null;
  $: subtitle = `${wines.length} vin${wines.length > 1 ? "s" : ""} · ${vintageCount} millésime${vintageCount > 1 ? "s" : ""} · ${
    bottleCount == null ? "stock indisponible" : `${bottleCount} bouteille${bottleCount > 1 ? "s" : ""} en stock`
  }`;
  $: filtersActive = !!(searchText || filterWineryId || filterAppelationId || filterWineTypeId || robeFilter || inStockOnly);

  function resetAll() {
    clearFilters();
    robeFilter = "";
    inStockOnly = false;
  }

  let notice = "";
  async function reorder(wine: any) {
    const v = latestVintage(wine);
    if (!v) return;
    try {
      notice = (await promptReorder(`${wineTitle(wine)} ${v.year ?? ""}`.trim(), v)) ?? notice;
    } catch (e) {
      error = errorMessage(e);
    }
  }

  async function setRetired(wine: any, retired: boolean) {
    const ids = vintagesOf(wine).map((v) => v.id);
    if (!ids.length) return;
    const { error: updateError } = await supabase
      .from("wine_vintage")
      .update({ discontinued_at: retired ? new Date().toISOString() : null })
      .in("id", ids);
    if (updateError) {
      error = updateError.message;
      return;
    }
    notice = retired
      ? `« ${wineTitle(wine)} » est marqué plus jamais disponible : il n’apparaît plus sur le site.`
      : `« ${wineTitle(wine)} » est de nouveau au catalogue.`;
    await loadWines();
  }

  function rowItems(wine: any): MenuItem[] {
    const items: MenuItem[] = [
      { label: "Ouvrir la fiche", icon: IconEye, href: `/manage/wines/${wine.id}` },
      { label: "Modifier", icon: IconPencil, onSelect: () => openEditModal(wine) },
      { label: "Ajouter un millésime", icon: IconPlus, href: `/manage/wines/${wine.id}?nouveau=1` },
      { label: "Accords mets & vins", icon: IconPlate, onSelect: () => openPairingsModal(wine) },
    ];
    if (latestVintage(wine)) items.push({ label: "Commander (réassort)", icon: IconClipboard, onSelect: () => reorder(wine) });
    if (isRetired(wine)) {
      items.push({ label: "Remettre au catalogue", icon: IconArchiveRestore, onSelect: () => setRetired(wine, false) });
    } else if (vintagesOf(wine).length) {
      items.push({ label: "Plus jamais disponible", icon: IconArchive, onSelect: () => setRetired(wine, true) });
    }
    items.push({ label: "Supprimer…", icon: IconTrash, danger: true, separator: true, onSelect: () => askDelete(wine) });
    return items;
  }

  function openRow(wine: any, e: MouseEvent) {
    if ((e.target as HTMLElement).closest("button, a, input, select, [role=menu]")) return;
    void goto(`/manage/wines/${wine.id}`);
  }

  let deleteTarget: any = null;
  let confirmOpen = false;
  function askDelete(wine: any) {
    deleteTarget = wine;
    confirmOpen = true;
  }
  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteWine(deleteTarget.id);
    confirmOpen = false;
  }
</script>

<svelte:head>
  <title>Vins - Gestion</title>
</svelte:head>

<ManagePageShell title="Vins" subtitle={loading ? "" : subtitle}>
  <svelte:fragment slot="actions">
    <Button variant="primary" on:click={openCreateModal}><IconPlus size={18} strokeWidth={1.75} /> Nouveau vin</Button>
  </svelte:fragment>

  {#if error}
    <div class="error-message" role="alert">{error}</div>
  {/if}
  {#if stockError}
    <div class="error-message" role="alert">{stockError}</div>
  {/if}
  {#if notice}
    <div class="success-message" role="status">{notice}</div>
  {/if}

  {#if loading}
    <div class="loading">Chargement…</div>
  {:else if wines.length === 0}
    <div class="empty-card">
      <EmptyState icon={IconWine} title="Aucun vin au catalogue" text="Ajoutez un premier vin, puis ses millésimes.">
        <Button on:click={openCreateModal}>Créer le premier vin</Button>
      </EmptyState>
    </div>
  {:else}
    <div class="filters-bar">
      <label class="search">
        <span class="sr-only">Rechercher un vin, un domaine, une appellation</span>
        <IconSearch size={16} strokeWidth={1.75} aria-hidden="true" />
        <input class="ui-control" type="search" placeholder="Rechercher un vin, un domaine…" bind:value={searchText} />
      </label>
      <div class="chips" role="group" aria-label="Filtrer par robe">
        <button type="button" class="ui-chip" aria-pressed={!robeFilter} on:click={() => (robeFilter = "")}>Toutes</button>
        {#each ROBES as r}
          <button type="button" class="ui-chip" aria-pressed={robeFilter === r} on:click={() => (robeFilter = robeFilter === r ? "" : r)}>
            <WineDot robe={r} />{ROBE_LABEL[r]}
          </button>
        {/each}
      </div>
      <select class="ui-control filter-select" bind:value={filterWineryId} aria-label="Domaine">
        <option value="">Tous les domaines</option>
        {#each wineries as winery}
          <option value={winery.id}>{winery.name}</option>
        {/each}
      </select>
      <select class="ui-control filter-select" bind:value={filterAppelationId} aria-label="Appellation">
        <option value="">Toutes les appellations</option>
        {#each appellations as appelation}
          <option value={appelation.id}>{appelation.name}{appelation.label?.name ? ` ${appelation.label.name}` : ""}</option>
        {/each}
      </select>
      <label class="check">
        <input type="checkbox" bind:checked={inStockOnly} disabled={!stock} />
        En stock seulement
      </label>
      {#if filtersActive}
        <Button variant="ghost" size="sm" on:click={resetAll}><IconX size={14} strokeWidth={1.75} /> Réinitialiser</Button>
      {/if}
    </div>

    {#if shownWines.length === 0}
      <div class="empty-card">
        <EmptyState icon={IconSearch} title="Aucun vin ne correspond" text="Modifiez la recherche ou les filtres." compact>
          <Button on:click={resetAll}>Réinitialiser les filtres</Button>
        </EmptyState>
      </div>
    {:else}
      <div class="desktop-only">
        <DataTable caption="Catalogue des vins">
          <thead>
            <tr>
              <th scope="col">Vin</th>
              <th scope="col">Robe</th>
              <th scope="col">Millésimes · stock</th>
              <th scope="col" class="num">Stock</th>
              <th scope="col" class="num">Prix de vente</th>
              <th scope="col" class="col-actions"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {#each shownWines as wine (wine.id)}
              {@const { total, badge } = stockById.get(wine.id) ?? { total: 0, badge: null }}
              {@const robe = robeOf(wine.wine_type)}
              {@const retired = isRetired(wine)}
              <tr class="is-clickable" class:retired on:click={(e) => openRow(wine, e)}>
                <td>
                  <span class="wine-cell">
                    <WineDot {robe} />
                    <span class="wine-name">
                      <a class="row-link" href="/manage/wines/{wine.id}">{wineTitle(wine)}</a>
                      <span class="t-caption">{wine.winery?.name ?? "—"}{wine.name && wine.appelation?.name ? ` · ${wine.appelation.name}` : ""}</span>
                    </span>
                  </span>
                </td>
                <td>{ROBE_LABEL[robe]}</td>
                <td>
                  <span class="vintages">
                    {#each vintagesOf(wine) as v (v.id)}
                      {@const q = stock?.get(v.id) ?? 0}
                      {#if isDiscontinued(v)}
                        <span class="vintage-chip gone" title="Plus jamais disponible">{v.year ?? v.production_year}</span>
                      {:else if !stock}
                        <span class="vintage-chip">{v.year ?? v.production_year}</span>
                      {:else}
                        <span class="vintage-chip" class:out={q <= 0}>
                          {v.year ?? v.production_year} · {q <= 0 ? "rupture" : q}
                        </span>
                      {/if}
                    {:else}
                      <span class="t-muted">Aucun millésime</span>
                    {/each}
                  </span>
                </td>
                <td class="num">
                  <span class="stock-cell">
                    {#if badge}<StockBadge kind={badge} />{/if}
                    <strong>{stock ? `${total} bt.` : "—"}</strong>
                  </span>
                </td>
                <td class="num">{priceText(wine)}</td>
                <td class="col-actions"><RowMenu items={rowItems(wine)} label="Actions pour {wineTitle(wine)}" /></td>
              </tr>
            {/each}
          </tbody>
        </DataTable>
        <p class="t-caption footnote">Clic sur un vin pour ouvrir sa fiche. Les actions secondaires sont dans « … ».</p>
      </div>

      <ul class="cards mobile-only">
        {#each shownWines as wine (wine.id)}
          {@const { total, badge } = stockById.get(wine.id) ?? { total: 0, badge: null }}
          <li class="wine-card" class:retired={isRetired(wine)}>
            <a class="wine-card-main" href="/manage/wines/{wine.id}">
              <span class="wc-top">
                <span class="wine-cell"><WineDot robe={robeOf(wine.wine_type)} /><strong>{wineTitle(wine)}</strong></span>
                <strong>{stock ? `${total} bt.` : "—"}</strong>
              </span>
              <span class="wc-bottom">
                <span class="t-muted">{wine.winery?.name ?? ""}</span>
                {#if badge}<StockBadge kind={badge} />{/if}
              </span>
            </a>
            <RowMenu items={rowItems(wine)} label="Actions pour {wineTitle(wine)}" />
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</ManagePageShell>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Supprimer ce vin ?"
  message={deleteTarget
    ? `« ${wineTitle(deleteTarget)} » (${deleteTarget.winery?.name ?? ""}) sera supprimé du catalogue, ainsi que ses ${deleteTarget.wine_vintage?.length ?? 0} millésime(s) si la base l’autorise. Les ventes passées ne sont pas modifiées.`
    : ""}
  on:confirm={confirmDelete}
/>

<Modal open={showModal} title={editingWine ? "Modifier le vin" : "Nouveau vin"} on:close={closeModal}>
  <form id="wine-form" class="wine-form" on:submit|preventDefault={handleSubmit}>
    <Field id="wine-name" label="Nom du vin" help="Laisser vide pour utiliser le nom de l’appellation.">
      <input id="wine-name" class="ui-control" type="text" bind:value={formData.name} />
    </Field>
    <div class="grid-2">
      <Field id="wine-winery" label="Domaine" required>
        <select id="wine-winery" class="ui-control" bind:value={formData.winery_id} required>
          <option value="">Sélectionner un domaine</option>
          {#each wineries as winery}
            <option value={winery.id}>{winery.name}</option>
          {/each}
        </select>
      </Field>
      <Field id="wine-type" label="Robe" required>
        <select id="wine-type" class="ui-control" bind:value={formData.wine_type_id} required>
          <option value="">Sélectionner une robe</option>
          {#each wineTypes as wineType}
            <option value={wineType.id}>{ROBE_LABEL[robeOf(wineType)] === "Autre" ? wineType.name : ROBE_LABEL[robeOf(wineType)]}</option>
          {/each}
        </select>
      </Field>
    </div>
    <Field id="wine-appellation" label="Appellation" optional>
      <select id="wine-appellation" class="ui-control" bind:value={formData.appelation_id}>
        <option value="">Aucune</option>
        {#each appellations as appelation}
          <option value={appelation.id}>{appelation.name}{appelation.label?.name ? ` ${appelation.label.name}` : ""}</option>
        {/each}
      </select>
    </Field>
    <Field id="wine-description" label="Description" optional>
      <textarea id="wine-description" class="ui-control" rows="3" bind:value={formData.description}></textarea>
    </Field>
  </form>
  <svelte:fragment slot="footer">
    <Button variant="ghost" on:click={closeModal}>Annuler</Button>
    <Button variant="primary" on:click={handleSubmit}>{editingWine ? "Enregistrer" : "Créer le vin"}</Button>
  </svelte:fragment>
</Modal>

<Modal open={showPairingsModal} title="Accords mets & vins" maxWidth={520} on:close={closePairingsModal}>
  {#if selectedWine}<p class="t-muted pairing-intro">{wineTitle(selectedWine)} · {selectedWine.winery?.name ?? ""}</p>{/if}
  {#if winePairings.length === 0}
    <EmptyState icon={IconPlate} title="Aucun accord pour ce vin" compact />
  {:else}
    <ul class="pairings">
      {#each winePairings as wp}
        <li>
          <span>{wp.pairing.description}</span>
          <IconButton label="Retirer {wp.pairing.description}" on:click={() => removePairing(wp.pairing_id)}>
            <IconX size={16} strokeWidth={1.75} />
          </IconButton>
        </li>
      {/each}
    </ul>
  {/if}
  <div class="add-pairing">
    <select class="ui-control" bind:value={selectedPairingId} aria-label="Accord à ajouter">
      <option value="">Choisir un plat…</option>
      {#each allPairings as pairing}
        <option value={pairing.id} disabled={linkedPairingIds.has(pairing.id)}>
          {pairing.description}{linkedPairingIds.has(pairing.id) ? " (déjà ajouté)" : ""}
        </option>
      {/each}
    </select>
    <Button on:click={addPairing} disabled={!selectedPairingId}><IconPlus size={16} strokeWidth={1.75} /> Ajouter</Button>
  </div>
  <svelte:fragment slot="footer">
    <Button variant="primary" on:click={closePairingsModal}>Terminé</Button>
  </svelte:fragment>
</Modal>

<style>
  .filters-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .search {
    position: relative;
    flex: 0 1 340px;
    display: flex;
    align-items: center;
    color: var(--ink-2);
  }

  .search :global(svg) {
    position: absolute;
    left: 12px;
  }

  .search input {
    padding-left: 36px;
  }

  .chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .filter-select {
    width: auto;
    min-width: 180px;
  }

  .check {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    cursor: pointer;
  }

  .check input {
    width: 18px;
    height: 18px;
    accent-color: var(--teal-600);
  }

  .empty-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
  }

  .wine-cell {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .wine-name {
    display: flex;
    flex-direction: column;
    line-height: 18px;
  }



  .vintages {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .vintage-chip {
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--table-head);
    border: 1px solid var(--border-soft);
    font-size: 12px;
    white-space: nowrap;
  }

  .vintage-chip.out {
    background: var(--st-cancelled-bg);
    border-color: #ecc9c9;
    color: var(--danger);
  }

  /* Millésime retiré : barré, en pointillés. */
  .vintage-chip.gone {
    background: transparent;
    border-style: dashed;
    color: var(--ink-2);
    text-decoration: line-through;
  }

  /* Vin retiré : présent mais en retrait. */
  tr.retired > td:not(.col-actions),
  .wine-card.retired .wine-card-main {
    opacity: 0.55;
  }

  .stock-cell {
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }

  .footnote {
    margin: 10px 2px 0;
  }

  .mobile-only {
    display: none;
  }

  .cards {
    list-style: none;
    margin: 0;
    padding: 0;
    flex-direction: column;
    gap: 8px;
  }

  .wine-card {
    display: flex;
    align-items: center;
    gap: 4px;
    padding-right: 4px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
  }

  .wine-card-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 8px 12px 14px;
    color: inherit !important;
    text-decoration: none;
  }

  .wc-top,
  .wc-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .wine-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .pairing-intro {
    margin: 0 0 12px;
  }

  .pairings {
    list-style: none;
    margin: 0 0 16px;
    padding: 0;
    border: 1px solid var(--border-soft);
    border-radius: var(--r-md);
    background: #fff;
  }

  .pairings li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 4px 4px 14px;
    border-bottom: 1px solid var(--border-soft);
  }

  .pairings li:last-child {
    border-bottom: none;
  }

  .add-pairing {
    display: flex;
    gap: 8px;
  }

  @media (max-width: 767px) {
    .desktop-only {
      display: none;
    }

    .mobile-only {
      display: flex;
    }

    .search,
    .filter-select {
      flex: 1 1 100%;
    }

    .chips {
      overflow-x: auto;
      flex-wrap: nowrap;
    }

    .grid-2 {
      grid-template-columns: 1fr;
    }
  }
</style>
