<script lang="ts">
  import { preventDefault } from "$lib/ui/events";

  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import type { Wine, Winery, Appelation, WineType } from "$lib/types";
  import { goto, replaceState } from "$app/navigation";
  import { page } from "$app/stores";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import Modal from "$lib/ui/Modal.svelte";
  import Button from "$lib/ui/Button.svelte";
  import IconButton from "$lib/ui/IconButton.svelte";
  import RowMenu from "$lib/ui/RowMenu.svelte";
  import type { MenuItem } from "$lib/ui/Menu.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import DataTable from "$lib/ui/DataTable.svelte";
  import SortHeader from "$lib/ui/SortHeader.svelte";
  import { compareValues, type SortState } from "$lib/sort";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import Field from "$lib/ui/Field.svelte";
  import StockBadge from "$lib/ui/StockBadge.svelte";
  import StyleDot from "$lib/ui/StyleDot.svelte";
  import Spinner from "$lib/ui/Spinner.svelte";
  import Tabs from "$lib/ui/Tabs.svelte";
  import Combobox, { type ComboOption } from "$lib/ui/Combobox.svelte";
  import { byRobe, byVolume, compareProductsByProducer, MAIN_ROBES, styleByKey, vintageShortLabel, wineRobe, type ProductStyleKey, productTitle, productTypeLabel, withVolume } from "$lib/wine";
  import {
    IconArchive,
    IconArchiveRestore,
    IconClipboard,
    IconEye,
    IconPencil,
    IconPlus,
    IconSearch,
    IconTrash,
    IconX,
  } from "$lib/ui/icons";
  import IconPlate from "@lucide/svelte/icons/utensils-crossed";
  import { KIND_ICONS } from "$lib/ui/kindIcons";
  import { fold, formatEUR } from "$lib/format";
  import { promptReorder } from "$lib/reorder";
  import { isDiscontinued } from "$lib/wine";
  import { DEFAULT_KIND, kindCount, kindFromUrl, kindInfo, kindListHref, kindOf, kindTabItems, PRODUCT_KIND_OPTIONS, type ProductKind } from "$lib/productKinds";
  import { fetchStockMap, fetchWineTypes } from "$lib/manageData";
  import { errorMessage } from "$lib/async";

  let wines = $state.raw<Wine[]>([]);
  let wineries = $state<Winery[]>([]);
  let appellations = $state<Appelation[]>([]);
  let wineTypes = $state<WineType[]>([]);
  let loading = $state(true);
  let error = $state("");
  let showModal = $state(false);
  let editingWine = $state<Wine | null>(null);

  // Pairings modal state
  let showPairingsModal = $state(false);
  let selectedWine = $state<Wine | null>(null);
  let linkedPairings = $state<any[]>([]);
  let allPairings = $state<any[]>([]);
  let selectedPairingId = $state("");
  let pairingError = $state("");

  // Filter state
  let filterWineryId = $state("");
  let filterAppelationId = $state("");
  let searchText = $state("");

  // Form fields
  let formData = $state({
    kind: DEFAULT_KIND,
    name: "",
    description: "",
    winery_id: "",
    appelation_id: "",
    wine_type_id: "",
  });
  /* Types et appellations du type de produit choisi (un vin n'a pas de fruité, une huile pas de robe). */
  let formKind = $derived(kindInfo(formData.kind));
  let formTypes = $derived(wineTypes.filter((t) => kindOf(t) === formData.kind));
  let formAppellations = $derived(appellations.filter((a) => kindOf(a) === formData.kind));

  /** Changement de type de produit : son type et son appellation ne valent plus. */
  function setFormKind(kind: ProductKind) {
    formData.kind = kind;
    formData.wine_type_id = "";
    formData.appelation_id = "";
  }

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
          (a, b) => (a.year ?? a.production_year ?? 0) - (b.year ?? b.production_year ?? 0) || byVolume(a, b),
        );
      }
      wines = (data || []).sort(compareProductsByProducer);
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
    wineTypes = await fetchWineTypes();
  }

  function openCreateModal() {
    editingWine = null;
    resetForm();
    showModal = true;
  }

  function openEditModal(wine: Wine) {
    editingWine = wine;
    formData = {
      kind: kindOf(wine),
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
      kind: tab,
      name: "",
      description: "",
      winery_id: "",
      appelation_id: "",
      wine_type_id: "",
    };
  }

  async function handleSubmit() {
    if (!formData.winery_id || !formData.wine_type_id) {
      error = `Domaine et ${formKind.typeLabel.toLowerCase()} sont obligatoires`;
      return;
    }

    const wineData: any = {
      kind: formData.kind,
      name: formData.name || null,
      description: formData.description || null,
      winery_id: formData.winery_id,
      wine_type_id: formData.wine_type_id,
      /* Vide : aucune appellation (null efface celle d'un produit modifié). */
      appelation_id: formData.appelation_id || null,
    };

    const { error: saveError } = editingWine
      ? await supabase.from("wine").update(wineData).eq("id", editingWine.id)
      : await supabase.from("wine").insert(wineData);
    if (saveError) {
      error = saveError.message;
      return;
    }

    /* Montre le produit, même enregistré sous un autre type que l'onglet ouvert. */
    setTab(formData.kind);
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

    linkedPairings = data || [];
  }

  async function addPairing() {
    const pairingId = selectedPairingId;
    selectedPairingId = "";
    if (!pairingId || !selectedWine || linkedPairingIds.has(pairingId)) return;

    /* Affiché tout de suite : l'option est grisée avant la fin de l'insertion, pas de doublon. */
    linkedPairings = [...linkedPairings, { pairing_id: pairingId, pairing: allPairings.find((p) => p.id === pairingId) }];
    pairingError = "";

    const { error: insertError } = await supabase.from("wine_pairing").insert({
      wine_id: selectedWine.id,
      pairing_id: pairingId,
    });

    if (insertError) pairingError = insertError.message;
    await loadWinePairings();
  }

  /** Accord à retirer, en attente de confirmation. */
  let pairingToRemove = $state<any>(null);

  /** Appelée après confirmation via le ConfirmDialog. */
  async function removePairing(pairingId: string) {
    if (!selectedWine) return;

    const { error: deleteError } = await supabase
      .from("wine_pairing")
      .delete()
      .eq("wine_id", selectedWine.id)
      .eq("pairing_id", pairingId);

    if (deleteError) {
      pairingError = deleteError.message;
      return;
    }

    pairingError = "";
    await loadWinePairings();
  }

  function closePairingsModal() {
    showPairingsModal = false;
    selectedWine = null;
    linkedPairings = [];
    selectedPairingId = "";
    pairingError = "";
  }

  function clearFilters() {
    filterWineryId = "";
    filterAppelationId = "";
    searchText = "";
  }

  /* ——— Interface (refonte) ——— */
  /** null : stock illisible, affiché « — » plutôt qu'en fausse rupture (cause dans stockError). */
  let stock = $state<Map<string, number> | null>(new Map());
  let stockError = $state("");
  async function loadStock() {
    try {
      stock = await fetchStockMap();
    } catch (e) {
      stock = null;
      stockError = `Stock indisponible : ${errorMessage(e)}`;
    }
  }

  let robeFilter = $state<ProductStyleKey | "">("");
  let inStockOnly = $state(false);

  /** Un onglet par type de produit : vins et huiles ne se mélangent pas dans la liste. */
  let tab = $state<ProductKind>(kindFromUrl($page.url));
  let tabKind = $derived(kindInfo(tab));
  let tabWines = $derived(wines.filter((w) => kindOf(w) === tab));
  let tabItems = $derived(kindTabItems(wines, loading));
  let tabAppellations = $derived(appellations.filter((a) => kindOf(a) === tab));
  /** Les filtres propres à un type (robe, appellation, domaine) ne valent pas pour l'autre. */
  function setTab(kind: ProductKind) {
    if (kind === tab) return;
    tab = kind;
    robeFilter = "";
    filterAppelationId = "";
    filterWineryId = "";
    replaceState(kindListHref($page.url.pathname, kind), {});
  }

  /** Millésimes du plus ancien au plus récent (triés au chargement). */
  function vintagesOf(wine: any): any[] {
    return wine.wine_vintage || [];
  }
  /** Dernier millésime qu'on peut encore recommander au fournisseur. */
  function latestVintage(wine: any): any | null {
    const list = vintagesOf(wine).filter((v) => !isDiscontinued(v));
    const last = list[list.length - 1];
    /* Plusieurs contenants pour la dernière année : le réassort se fait lot par lot (fiche du produit). */
    const sameYear = list.filter((v) => (v.year ?? v.production_year) === (last?.year ?? last?.production_year));
    return sameYear.length === 1 ? last : null;
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
  function pricesOf(wine: any): number[] {
    return vintagesOf(wine)
      .map((v) => (v.price != null ? Number(v.price) : null))
      .filter((p): p is number => p != null);
  }
  function minPrice(wine: any): number | null {
    const prices = pricesOf(wine);
    return prices.length ? Math.min(...prices) : null;
  }
  function priceText(wine: any): string {
    const prices = pricesOf(wine);
    if (!prices.length) return "—";
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? formatEUR(min) : `${formatEUR(min)} – ${formatEUR(max)}`;
  }

  function resetAll() {
    clearFilters();
    robeFilter = "";
    inStockOnly = false;
  }

  let notice = $state("");
  async function reorder(wine: any) {
    const v = latestVintage(wine);
    if (!v) return;
    try {
      notice = (await promptReorder(vintageShortLabel({ ...v, wine }), v)) ?? notice;
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
      ? `« ${productTitle(wine)} » est marqué plus jamais disponible et n’apparaît plus sur le site.`
      : `« ${productTitle(wine)} » est de nouveau au catalogue.`;
    await loadWines();
  }

  function rowItems(wine: any): MenuItem[] {
    const kind = kindInfo(wine);
    const items: MenuItem[] = [
      { label: "Ouvrir la fiche", icon: IconEye, href: `/manage/products/${wine.id}` },
      { label: "Modifier", icon: IconPencil, onSelect: () => openEditModal(wine) },
      { label: kind.addBatch, icon: IconPlus, href: `/manage/products/${wine.id}?nouveau=1` },
    ];
    if (kind.pairingsLabel) items.push({ label: kind.pairingsLabel, icon: IconPlate, onSelect: () => openPairingsModal(wine) });
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
    void goto(`/manage/products/${wine.id}`);
  }

  let deleteTarget = $state<any>(null);
  let confirmOpen = $state(false);
  function askDelete(wine: any) {
    deleteTarget = wine;
    confirmOpen = true;
  }
  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteWine(deleteTarget.id);
    confirmOpen = false;
  }
  let linkedPairingIds = $derived(new Set(linkedPairings.map((wp) => wp.pairing_id)));
  let pairingOptions = $derived(allPairings.map<ComboOption>((p) => {
    const linked = linkedPairingIds.has(p.id);
    return {
      id: p.id,
      label: linked ? `${p.description} (déjà ajouté)` : p.description,
      searchText: fold(p.description),
      disabled: linked,
    };
  }));
  // Filter wines based on selected filters
  /* Recherche sans accents ni casse : domaine, nom, appellation ou son label. */
  let searchQuery = $derived(fold(searchText));
  let filteredWines = $derived(tabWines.filter((wine) => {
    // Filter by winery
    if (filterWineryId && wine.winery_id !== filterWineryId) {
      return false;
    }

    // Filter by appellation
    if (filterAppelationId && wine.appelation_id !== filterAppelationId) {
      return false;
    }

    if (searchQuery) {
      const fields = [wine.winery?.name, wine.name, wine.appelation?.name, wine.appelation?.label?.name];
      if (!fields.some((f) => fold(f || "").includes(searchQuery))) return false;
    }

    return true;
  }));
  /* Bouteilles en stock et badge par vin, recalculés quand les vins ou le stock arrivent. */
  let stockById = $derived(new Map(
    wines.map((w: any) => {
      const total = vintagesOf(w).reduce((n, v) => n + Math.max(0, stock?.get(v.id) ?? 0), 0);
      return [w.id, { total, badge: stockBadge(w, total, !!stock) }];
    }),
  ));
  type SortKey = "name" | "type" | "stock" | "price";
  let sort = $state<SortState<SortKey>>({ key: "name", dir: "asc" });
  /** Rang des types : robe du plus léger au plus corsé (blanc, rosé, rouge), puis ordre propre au produit (fruité d'une huile). */
  let typeRank = $derived(new Map([...wineTypes].sort(byRobe).map((t, i) => [t.id, i])));
  /** Valeur triée d'un produit ; null (sans prix, stock illisible) en fin de liste. */
  function sortValue(wine: any, key: SortKey): string | number | null {
    switch (key) {
      case "name": return productTitle(wine);
      case "type": return typeRank.get(wine.wine_type_id) ?? null;
      case "stock": return stock ? stockById.get(wine.id)?.total ?? 0 : null;
      case "price": return minPrice(wine);
    }
  }
  /* Vins retirés en fin de liste : visibles, mais hors du chemin. À égalité, l'ordre du chargement (domaine, puis nom). */
  let shownWines = $derived(filteredWines
    .filter((w: any) => !robeFilter || wineRobe(w.wine_type).key === robeFilter)
    .filter((w: any) => !inStockOnly || !stock || (stockById.get(w.id)?.total ?? 0) > 0)
    .sort((a: any, b: any) =>
      Number(isRetired(a)) - Number(isRetired(b)) ||
      compareValues(sortValue(a, sort.key), sortValue(b, sort.key), sort.dir)));
  /** « 19 vins (35 millésimes) · 120 bouteilles en stock », pour l'onglet ouvert. */
  let subtitle = $derived.by(() => {
    const batches = tabWines.reduce((n, w: any) => n + (w.wine_vintage?.length ?? 0), 0);
    const bottles = tabWines.reduce((n, w) => n + (stockById.get(w.id)?.total ?? 0), 0);
    return [
      `${kindCount(tabKind, tabWines.length)} (${batches} ${(batches > 1 ? tabKind.batchPlural : tabKind.batch).toLowerCase()})`,
      stock ? `${bottles} bouteille${bottles > 1 ? "s" : ""} en stock` : "stock indisponible",
    ].join(" · ");
  });
  let filtersActive = $derived(!!(searchText || filterWineryId || filterAppelationId || robeFilter || inStockOnly));
</script>

<svelte:head>
  <title>Produits - Gestion</title>
</svelte:head>

<ManagePageShell title="Produits" subtitle={loading ? "" : subtitle}>
  {#snippet actions()}
      <Button variant="primary" onclick={openCreateModal}><IconPlus size={18} strokeWidth={1.75} /> {tabKind.newLabel}</Button>
  {/snippet}

  {#snippet tabs()}
    <Tabs label="Type de produit" items={tabItems} bind:value={() => tab, setTab} />
  {/snippet}

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
    <Spinner />
  {:else if tabWines.length === 0}
    <div class="empty-card">
      <EmptyState icon={KIND_ICONS[tab].product} title={tabKind.noProduct} text="Créez le produit, puis ses {tabKind.batchPlural.toLowerCase()} (un par contenant).">
        <Button onclick={openCreateModal}><IconPlus size={16} strokeWidth={1.75} /> {tabKind.newLabel}</Button>
      </EmptyState>
    </div>
  {:else}
    <div class="filters-bar">
      <label class="search">
        <span class="sr-only">Rechercher un produit, un domaine, une appellation</span>
        <IconSearch size={16} strokeWidth={1.75} aria-hidden="true" />
        <input class="ui-control" type="search" placeholder="Rechercher un produit, un domaine…" bind:value={searchText} />
      </label>
      <!-- Robes : seulement pour un type dont la couleur dépend du type (vin). -->
      {#if !tabKind.style}
        <div class="chips" role="group" aria-label="Filtrer par robe">
          <button type="button" class="ui-chip" aria-pressed={!robeFilter} onclick={() => (robeFilter = "")}>Tous</button>
          {#each MAIN_ROBES as r}
            <button type="button" class="ui-chip" aria-pressed={robeFilter === r} onclick={() => (robeFilter = robeFilter === r ? "" : r)}>
              <StyleDot robe={r} />{styleByKey(r).label}
            </button>
          {/each}
        </div>
      {/if}
      <select class="ui-control filter-select" bind:value={filterWineryId} aria-label="Domaine">
        <option value="">Tous les domaines</option>
        {#each wineries as winery}
          <option value={winery.id}>{winery.name}</option>
        {/each}
      </select>
      <select class="ui-control filter-select" bind:value={filterAppelationId} aria-label="Appellation">
        <option value="">Toutes les appellations</option>
        {#each tabAppellations as appelation}
          <option value={appelation.id}>{appelation.name}{appelation.label?.name ? ` ${appelation.label.name}` : ""}</option>
        {/each}
      </select>
      <label class="check">
        <input type="checkbox" bind:checked={inStockOnly} disabled={!stock} />
        En stock seulement
      </label>
      {#if filtersActive}
        <Button variant="ghost" size="sm" onclick={resetAll}><IconX size={14} strokeWidth={1.75} /> Réinitialiser</Button>
      {/if}
    </div>

    {#if shownWines.length === 0}
      <div class="empty-card">
        <EmptyState icon={IconSearch} title="Aucun produit ne correspond" text="Modifiez la recherche ou les filtres." compact>
          <Button onclick={resetAll}>Réinitialiser les filtres</Button>
        </EmptyState>
      </div>
    {:else}
      <div class="desktop-only">
        <DataTable caption="Catalogue des produits">
          <thead>
            <tr>
              <SortHeader column="name" label="Produit" bind:sort />
              <SortHeader column="type" label={tabKind.typeLabel} bind:sort />
              <th scope="col">{tabKind.batchPlural} · stock</th>
              <SortHeader column="stock" label="Stock" num firstDir="desc" bind:sort />
              <SortHeader column="price" label="Prix de vente" num bind:sort />
              <th scope="col" class="col-actions"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {#each shownWines as wine (wine.id)}
              {@const { total, badge } = stockById.get(wine.id) ?? { total: 0, badge: null }}
              {@const robe = wineRobe(wine.wine_type).key}
              {@const retired = isRetired(wine)}
              <tr class="is-clickable" class:retired onclick={(e) => openRow(wine, e)}>
                <td>
                  <span class="wine-cell">
                    <StyleDot {robe} />
                    <span class="wine-name">
                      <a class="row-link" href="/manage/products/{wine.id}">{productTitle(wine)}</a>
                      <span class="t-caption">{wine.winery?.name ?? "—"}{wine.name && wine.appelation?.name ? ` · ${wine.appelation.name}` : ""}</span>
                    </span>
                  </span>
                </td>
                <td>{productTypeLabel(wine.wine_type)}</td>
                <td>
                  <span class="vintages">
                    {#each vintagesOf(wine) as v (v.id)}
                      {@const q = stock?.get(v.id) ?? 0}
                      {@const lot = withVolume(String(v.year ?? v.production_year), v, kindOf(wine))}
                      {#if isDiscontinued(v)}
                        <span class="vintage-chip gone" title="Plus jamais disponible">{lot}</span>
                      {:else if !stock}
                        <span class="vintage-chip">{lot}</span>
                      {:else}
                        <span class="vintage-chip" class:out={q <= 0}>
                          {lot} · {q <= 0 ? "rupture" : q}
                        </span>
                      {/if}
                    {:else}
                      <span class="t-muted">{kindInfo(wine).noBatch}</span>
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
                <td class="col-actions"><RowMenu items={rowItems(wine)} label="Actions pour {productTitle(wine)}" /></td>
              </tr>
            {/each}
          </tbody>
        </DataTable>
        <p class="t-caption footnote">Clic sur un produit pour ouvrir sa fiche. Les actions secondaires sont dans « … ».</p>
      </div>

      <ul class="cards mobile-only">
        {#each shownWines as wine (wine.id)}
          {@const { total, badge } = stockById.get(wine.id) ?? { total: 0, badge: null }}
          <li class="wine-card" class:retired={isRetired(wine)}>
            <a class="wine-card-main" href="/manage/products/{wine.id}">
              <span class="wc-top">
                <span class="wine-cell"><StyleDot type={wine.wine_type} /><strong>{productTitle(wine)}</strong></span>
                <strong>{stock ? `${total} bt.` : "—"}</strong>
              </span>
              <span class="wc-bottom">
                <span class="t-muted">{wine.winery?.name ?? ""}</span>
                {#if badge}<StockBadge kind={badge} />{/if}
              </span>
            </a>
            <RowMenu items={rowItems(wine)} label="Actions pour {productTitle(wine)}" />
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</ManagePageShell>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Supprimer {deleteTarget ? kindInfo(deleteTarget).thisLabel : 'ce produit'} ?"
  message={deleteTarget
    ? `« ${productTitle(deleteTarget)} » (${deleteTarget.winery?.name ?? ""}) sera supprimé du catalogue, ainsi que ses ${deleteTarget.wine_vintage?.length ?? 0} ${kindInfo(deleteTarget).batchPlural.toLowerCase()} si la base l’autorise. Les ventes passées ne sont pas modifiées.`
    : ""}
  onconfirm={confirmDelete}
/>

<ConfirmDialog
  open={!!pairingToRemove}
  title="Retirer cet accord ?"
  message={pairingToRemove ? `« ${pairingToRemove.pairing?.description ?? ""} » ne sera plus proposé avec ce produit.` : ""}
  confirmLabel="Oui, retirer"
  action={() => removePairing(pairingToRemove.pairing_id)}
  oncancel={() => (pairingToRemove = null)}
  ondone={() => (pairingToRemove = null)}
/>

<Modal open={showModal} title={editingWine ? formKind.editLabel : formKind.newLabel} onclose={closeModal}>
  <form id="wine-form" class="wine-form" onsubmit={preventDefault(handleSubmit)}>
    <!-- Choisi à la création seulement : la base refuse de changer le type d'un produit qui a des millésimes ou des lots. -->
    <Field id="wine-kind" label="Type de produit" required help={editingWine ? "Ne change plus une fois le produit créé." : ""}>
      <select
        id="wine-kind"
        class="ui-control"
        value={formData.kind}
        onchange={(e) => setFormKind(e.currentTarget.value as ProductKind)}
        disabled={!!editingWine}
      >
        {#each PRODUCT_KIND_OPTIONS as o (o.value)}
          <option value={o.value}>{o.label}</option>
        {/each}
      </select>
    </Field>
    <Field id="wine-name" label="Nom" help="Laisser vide pour utiliser le nom de l’appellation.">
      <input id="wine-name" class="ui-control" type="text" bind:value={formData.name} />
    </Field>
    <div class="ui-grid-2">
      <Field id="wine-winery" label="Domaine" required>
        <select id="wine-winery" class="ui-control" bind:value={formData.winery_id} required>
          <option value="">Sélectionner un domaine</option>
          {#each wineries as winery}
            <option value={winery.id}>{winery.name}</option>
          {/each}
        </select>
      </Field>
      <Field id="wine-type" label={formKind.typeLabel} required>
        <select id="wine-type" class="ui-control" bind:value={formData.wine_type_id} required>
          <option value="">Sélectionner…</option>
          {#each formTypes as wineType}
            <option value={wineType.id}>{productTypeLabel(wineType)}</option>
          {/each}
        </select>
      </Field>
    </div>
    <Field id="wine-appellation" label="Appellation" optional>
      <select id="wine-appellation" class="ui-control" bind:value={formData.appelation_id}>
        <option value="">Aucune</option>
        {#each formAppellations as appelation}
          <option value={appelation.id}>{appelation.name}{appelation.label?.name ? ` ${appelation.label.name}` : ""}</option>
        {/each}
      </select>
    </Field>
    <Field id="wine-description" label="Description" optional>
      <textarea id="wine-description" class="ui-control" rows="3" bind:value={formData.description}></textarea>
    </Field>
  </form>
  {#snippet footer()}
      <Button variant="ghost" onclick={closeModal}>Annuler</Button>
      <Button variant="primary" onclick={handleSubmit}>{editingWine ? "Enregistrer" : "Créer"}</Button>
  {/snippet}
</Modal>

<Modal open={showPairingsModal} title={kindInfo(selectedWine).pairingsLabel ?? ""} maxWidth={520} onclose={closePairingsModal}>
  {#if selectedWine}<p class="t-muted pairing-intro">{productTitle(selectedWine)} · {selectedWine.winery?.name ?? ""}</p>{/if}
  {#if pairingError}<div class="error-message" role="alert">{pairingError}</div>{/if}
  {#if linkedPairings.length === 0}
    <EmptyState icon={IconPlate} title="Aucun accord pour {kindInfo(selectedWine).thisLabel}" compact />
  {:else}
    <ul class="pairings">
      {#each linkedPairings as wp}
        <li>
          <span>{wp.pairing.description}</span>
          <IconButton label="Retirer {wp.pairing.description}" onclick={() => (pairingToRemove = wp)}>
            <IconX size={16} strokeWidth={1.75} />
          </IconButton>
        </li>
      {/each}
    </ul>
  {/if}
  <Field id="add-pairing" label="Ajouter un accord">
    <Combobox
      id="add-pairing"
      bind:value={selectedPairingId}
      options={pairingOptions}
      maxResults={pairingOptions.length}
      placeholder="Rechercher un plat…"
      emptyText="Aucun plat trouvé"
      onchange={addPairing}
    />
  </Field>
  {#snippet footer()}
      <Button variant="primary" onclick={closePairingsModal}>Terminé</Button>
  {/snippet}
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
    border-radius: var(--r-sm);
    background: var(--table-head);
    border: 1px solid var(--border-soft);
    font-size: 12px;
    white-space: nowrap;
  }

  .vintage-chip.out {
    background: var(--st-cancelled-bg);
    border-color: var(--danger-border);
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
    color: inherit;
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

  .pairing-intro {
    margin: 0 0 12px;
  }

  .pairings {
    list-style: none;
    margin: 0 0 16px;
    padding: 0;
    border: 1px solid var(--border-soft);
    border-radius: var(--r-md);
    background: var(--card);
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
  }
</style>
