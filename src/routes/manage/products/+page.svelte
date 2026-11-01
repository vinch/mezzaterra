<script lang="ts">
  import { preventDefault } from "$lib/ui/events";

  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import type { Product, Producer, Appellation, ProductType } from "$lib/types";
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
  import { byRobe, byVolume, compareProductsByProducer, MAIN_ROBES, styleByKey, lotShortLabel, wineRobe, type ProductStyleKey, productTitle, productTypeLabel, withVolume } from "$lib/products";
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
  import { isDiscontinued } from "$lib/products";
  import { DEFAULT_KIND, kindCount, kindFromUrl, kindInfo, kindListHref, kindOf, kindTabItems, PRODUCT_KIND_OPTIONS, type ProductKind } from "$lib/productKinds";
  import { fetchStockMap, fetchProductTypes } from "$lib/manageData";
  import { errorMessage } from "$lib/async";

  let products = $state.raw<Product[]>([]);
  let producers = $state<Producer[]>([]);
  let appellations = $state<Appellation[]>([]);
  let productTypes = $state<ProductType[]>([]);
  let loading = $state(true);
  let error = $state("");
  let showModal = $state(false);
  let editingProduct = $state<Product | null>(null);

  // Pairings modal state
  let showPairingsModal = $state(false);
  let selectedProduct = $state<Product | null>(null);
  let linkedPairings = $state<any[]>([]);
  let allPairings = $state<any[]>([]);
  let selectedPairingId = $state("");
  let pairingError = $state("");

  // Filter state
  let filterProducerId = $state("");
  let filterAppellationId = $state("");
  let searchText = $state("");

  // Form fields
  let formData = $state({
    kind: DEFAULT_KIND,
    name: "",
    description: "",
    producer_id: "",
    appellation_id: "",
    product_type_id: "",
  });
  /* Types et appellations du type de produit choisi (un vin n'a pas de fruité, une huile pas de robe). */
  let formKind = $derived(kindInfo(formData.kind));
  let formTypes = $derived(productTypes.filter((t) => kindOf(t) === formData.kind));
  let formAppellations = $derived(appellations.filter((a) => kindOf(a) === formData.kind));

  /** Changement de type de produit : son type et son appellation ne valent plus. */
  function setFormKind(kind: ProductKind) {
    formData.kind = kind;
    formData.product_type_id = "";
    formData.appellation_id = "";
  }

  onMount(async () => {
    void Promise.all([loadProducers(), loadAppellations(), loadProductTypes(), loadAllPairings()]);
    /* Fin du chargement une fois le stock aussi arrivé : sinon les vins s'affichent en rupture. */
    try {
      await Promise.all([loadStock(), loadProducts()]);
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

  async function loadProducts() {
    const { data, error: fetchError } = await supabase
      .from("product")
      .select("*, producer (*), appellation ( *, label (*) ), product_type (*), lot (*)")
      .order("created_at", { ascending: false });

    if (fetchError) {
      error = fetchError.message;
    } else {
      /* Millésimes triés une fois ici (du plus ancien au plus récent) plutôt qu'à chaque rendu. */
      for (const w of data || []) {
        w.lot.sort(
          (a, b) => (a.year ?? a.production_year ?? 0) - (b.year ?? b.production_year ?? 0) || byVolume(a, b),
        );
      }
      products = (data || []).sort(compareProductsByProducer);
    }
  }

  async function loadProducers() {
    const { data } = await supabase.from("producer").select("*").order("name");
    if (data) producers = data;
  }

  async function loadAppellations() {
    const { data } = await supabase.from("appellation").select("*, label (*)").order("name");
    if (data) appellations = data;
  }

  async function loadProductTypes() {
    productTypes = await fetchProductTypes();
  }

  function openCreateModal() {
    editingProduct = null;
    resetForm();
    showModal = true;
  }

  function openEditModal(product: Product) {
    editingProduct = product;
    formData = {
      kind: kindOf(product),
      name: product.name || "",
      description: product.description || "",
      producer_id: product.producer_id || "",
      appellation_id: product.appellation_id || "",
      product_type_id: product.product_type_id || "",
    };
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingProduct = null;
    resetForm();
  }

  function resetForm() {
    formData = {
      kind: tab,
      name: "",
      description: "",
      producer_id: "",
      appellation_id: "",
      product_type_id: "",
    };
  }

  async function handleSubmit() {
    if (!formData.producer_id || !formData.product_type_id) {
      error = `Domaine et ${formKind.typeLabel.toLowerCase()} sont obligatoires`;
      return;
    }

    const productData: any = {
      kind: formData.kind,
      name: formData.name || null,
      description: formData.description || null,
      producer_id: formData.producer_id,
      product_type_id: formData.product_type_id,
      /* Vide : aucune appellation (null efface celle d'un produit modifié). */
      appellation_id: formData.appellation_id || null,
    };

    const { error: saveError } = editingProduct
      ? await supabase.from("product").update(productData).eq("id", editingProduct.id)
      : await supabase.from("product").insert(productData);
    if (saveError) {
      error = saveError.message;
      return;
    }

    /* Montre le produit, même enregistré sous un autre type que l'onglet ouvert. */
    setTab(formData.kind);
    closeModal();
    await loadProducts();
  }

  /** Appelée après confirmation via le ConfirmDialog. */
  async function deleteProduct(id: string) {
    const { error: deleteError } = await supabase
      .from("product")
      .delete()
      .eq("id", id);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    await loadProducts();
  }

  // Pairings modal functions
  async function openPairingsModal(product: Product) {
    selectedProduct = product;
    await loadProductPairings();
    showPairingsModal = true;
  }

  async function loadProductPairings() {
    if (!selectedProduct) return;

    const { data } = await supabase
      .from("product_pairing")
      .select(
        `
        pairing_id,
        pairing (*)
      `
      )
      .eq("product_id", selectedProduct.id);

    linkedPairings = data || [];
  }

  async function addPairing() {
    const pairingId = selectedPairingId;
    selectedPairingId = "";
    if (!pairingId || !selectedProduct || linkedPairingIds.has(pairingId)) return;

    /* Affiché tout de suite : l'option est grisée avant la fin de l'insertion, pas de doublon. */
    linkedPairings = [...linkedPairings, { pairing_id: pairingId, pairing: allPairings.find((p) => p.id === pairingId) }];
    pairingError = "";

    const { error: insertError } = await supabase.from("product_pairing").insert({
      product_id: selectedProduct.id,
      pairing_id: pairingId,
    });

    if (insertError) pairingError = insertError.message;
    await loadProductPairings();
  }

  /** Accord à retirer, en attente de confirmation. */
  let pairingToRemove = $state<any>(null);

  /** Appelée après confirmation via le ConfirmDialog. */
  async function removePairing(pairingId: string) {
    if (!selectedProduct) return;

    const { error: deleteError } = await supabase
      .from("product_pairing")
      .delete()
      .eq("product_id", selectedProduct.id)
      .eq("pairing_id", pairingId);

    if (deleteError) {
      pairingError = deleteError.message;
      return;
    }

    pairingError = "";
    await loadProductPairings();
  }

  function closePairingsModal() {
    showPairingsModal = false;
    selectedProduct = null;
    linkedPairings = [];
    selectedPairingId = "";
    pairingError = "";
  }

  function clearFilters() {
    filterProducerId = "";
    filterAppellationId = "";
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
  let tabProducts = $derived(products.filter((w) => kindOf(w) === tab));
  let tabItems = $derived(kindTabItems(products, loading));
  let tabAppellations = $derived(appellations.filter((a) => kindOf(a) === tab));
  /** Les filtres propres à un type (robe, appellation, domaine) ne valent pas pour l'autre. */
  function setTab(kind: ProductKind) {
    if (kind === tab) return;
    tab = kind;
    robeFilter = "";
    filterAppellationId = "";
    filterProducerId = "";
    replaceState(kindListHref($page.url.pathname, kind), {});
  }

  /** Millésimes du plus ancien au plus récent (triés au chargement). */
  function lotsOf(product: any): any[] {
    return product.lot || [];
  }
  /** Dernier millésime qu'on peut encore recommander au fournisseur. */
  function latestLot(product: any): any | null {
    const list = lotsOf(product).filter((v) => !isDiscontinued(v));
    const last = list[list.length - 1];
    /* Plusieurs contenants pour la dernière année : le réassort se fait lot par lot (fiche du produit). */
    const sameYear = list.filter((v) => (v.year ?? v.production_year) === (last?.year ?? last?.production_year));
    return sameYear.length === 1 ? last : null;
  }
  /** Tous les millésimes sont « plus jamais disponibles » : le vin est retiré. */
  function isRetired(product: any): boolean {
    const list = lotsOf(product);
    return list.length > 0 && list.every(isDiscontinued);
  }
  /** Badge de stock d'un vin (aucun si le stock est illisible, sauf pour un vin retiré). */
  function stockBadge(product: any, total: number, stockKnown: boolean): "gone" | "out" | "low" | null {
    if (isRetired(product)) return "gone";
    if (!stockKnown) return null;
    if (lotsOf(product).length && total <= 0) return "out";
    return total > 0 && total <= 3 ? "low" : null;
  }
  function pricesOf(product: any): number[] {
    return lotsOf(product)
      .map((v) => (v.price != null ? Number(v.price) : null))
      .filter((p): p is number => p != null);
  }
  function minPrice(product: any): number | null {
    const prices = pricesOf(product);
    return prices.length ? Math.min(...prices) : null;
  }
  function priceText(product: any): string {
    const prices = pricesOf(product);
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
  async function reorder(product: any) {
    const v = latestLot(product);
    if (!v) return;
    try {
      notice = (await promptReorder(lotShortLabel({ ...v, product }), v)) ?? notice;
    } catch (e) {
      error = errorMessage(e);
    }
  }

  async function setRetired(product: any, retired: boolean) {
    const ids = lotsOf(product).map((v) => v.id);
    if (!ids.length) return;
    const { error: updateError } = await supabase
      .from("lot")
      .update({ discontinued_at: retired ? new Date().toISOString() : null })
      .in("id", ids);
    if (updateError) {
      error = updateError.message;
      return;
    }
    notice = retired
      ? `« ${productTitle(product)} » est marqué plus jamais disponible et n’apparaît plus sur le site.`
      : `« ${productTitle(product)} » est de nouveau au catalogue.`;
    await loadProducts();
  }

  function rowItems(product: any): MenuItem[] {
    const kind = kindInfo(product);
    const items: MenuItem[] = [
      { label: "Ouvrir la fiche", icon: IconEye, href: `/manage/products/${product.id}` },
      { label: "Modifier", icon: IconPencil, onSelect: () => openEditModal(product) },
      { label: kind.addBatch, icon: IconPlus, href: `/manage/products/${product.id}?nouveau=1` },
    ];
    if (kind.pairingsLabel) items.push({ label: kind.pairingsLabel, icon: IconPlate, onSelect: () => openPairingsModal(product) });
    if (latestLot(product)) items.push({ label: "Commander (réassort)", icon: IconClipboard, onSelect: () => reorder(product) });
    if (isRetired(product)) {
      items.push({ label: "Remettre au catalogue", icon: IconArchiveRestore, onSelect: () => setRetired(product, false) });
    } else if (lotsOf(product).length) {
      items.push({ label: "Plus jamais disponible", icon: IconArchive, onSelect: () => setRetired(product, true) });
    }
    items.push({ label: "Supprimer…", icon: IconTrash, danger: true, separator: true, onSelect: () => askDelete(product) });
    return items;
  }

  function openRow(product: any, e: MouseEvent) {
    if ((e.target as HTMLElement).closest("button, a, input, select, [role=menu]")) return;
    void goto(`/manage/products/${product.id}`);
  }

  let deleteTarget = $state<any>(null);
  let confirmOpen = $state(false);
  function askDelete(product: any) {
    deleteTarget = product;
    confirmOpen = true;
  }
  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteProduct(deleteTarget.id);
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
  // Filter products based on selected filters
  /* Recherche sans accents ni casse : domaine, nom, appellation ou son label. */
  let searchQuery = $derived(fold(searchText));
  let filteredProducts = $derived(tabProducts.filter((product) => {
    // Filter by producer
    if (filterProducerId && product.producer_id !== filterProducerId) {
      return false;
    }

    // Filter by appellation
    if (filterAppellationId && product.appellation_id !== filterAppellationId) {
      return false;
    }

    if (searchQuery) {
      const fields = [product.producer?.name, product.name, product.appellation?.name, product.appellation?.label?.name];
      if (!fields.some((f) => fold(f || "").includes(searchQuery))) return false;
    }

    return true;
  }));
  /* Bouteilles en stock et badge par vin, recalculés quand les vins ou le stock arrivent. */
  let stockById = $derived(new Map(
    products.map((w: any) => {
      const total = lotsOf(w).reduce((n, v) => n + Math.max(0, stock?.get(v.id) ?? 0), 0);
      return [w.id, { total, badge: stockBadge(w, total, !!stock) }];
    }),
  ));
  type SortKey = "name" | "producer" | "type" | "stock" | "price";
  let sort = $state<SortState<SortKey>>({ key: "producer", dir: "asc" });
  /** Rang des types : robe du plus léger au plus corsé (blanc, rosé, rouge), puis ordre propre au produit (fruité d'une huile). */
  let typeRank = $derived(new Map([...productTypes].sort(byRobe).map((t, i) => [t.id, i])));
  /** Valeur triée d'un produit ; null (sans prix, stock illisible) en fin de liste. */
  function sortValue(product: any, key: SortKey): string | number | null {
    switch (key) {
      case "name": return productTitle(product);
      case "producer": return product.producer?.name ?? null;
      case "type": return typeRank.get(product.product_type_id) ?? null;
      case "stock": return stock ? stockById.get(product.id)?.total ?? 0 : null;
      case "price": return minPrice(product);
    }
  }
  /* Vins retirés en fin de liste : visibles, mais hors du chemin. À égalité, l'ordre du chargement (domaine, puis nom). */
  let shownProducts = $derived(filteredProducts
    .filter((w: any) => !robeFilter || wineRobe(w.product_type).key === robeFilter)
    .filter((w: any) => !inStockOnly || !stock || (stockById.get(w.id)?.total ?? 0) > 0)
    .sort((a: any, b: any) =>
      Number(isRetired(a)) - Number(isRetired(b)) ||
      compareValues(sortValue(a, sort.key), sortValue(b, sort.key), sort.dir)));
  /** « 19 vins (35 millésimes) · 120 bouteilles en stock », pour l'onglet ouvert. */
  let subtitle = $derived.by(() => {
    const batches = tabProducts.reduce((n, w: any) => n + (w.lot?.length ?? 0), 0);
    const bottles = tabProducts.reduce((n, w) => n + (stockById.get(w.id)?.total ?? 0), 0);
    return [
      `${kindCount(tabKind, tabProducts.length)} (${batches} ${(batches > 1 ? tabKind.batchPlural : tabKind.batch).toLowerCase()})`,
      stock ? `${bottles} bouteille${bottles > 1 ? "s" : ""} en stock` : "stock indisponible",
    ].join(" · ");
  });
  let filtersActive = $derived(!!(searchText || filterProducerId || filterAppellationId || robeFilter || inStockOnly));
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
  {:else if tabProducts.length === 0}
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
      <select class="ui-control filter-select" bind:value={filterProducerId} aria-label="Domaine">
        <option value="">Tous les domaines</option>
        {#each producers as producer}
          <option value={producer.id}>{producer.name}</option>
        {/each}
      </select>
      <select class="ui-control filter-select" bind:value={filterAppellationId} aria-label="Appellation">
        <option value="">Toutes les appellations</option>
        {#each tabAppellations as appellation}
          <option value={appellation.id}>{appellation.name}{appellation.label?.name ? ` ${appellation.label.name}` : ""}</option>
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

    {#if shownProducts.length === 0}
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
              <SortHeader column="name" label="Produit" also={{ column: "producer", label: "Domaine" }} bind:sort />
              <SortHeader column="type" label={tabKind.typeLabel} bind:sort />
              <th scope="col">{tabKind.batchPlural} · stock</th>
              <SortHeader column="stock" label="Stock" num firstDir="desc" bind:sort />
              <SortHeader column="price" label="Prix de vente" num bind:sort />
              <th scope="col" class="col-actions"><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {#each shownProducts as product (product.id)}
              {@const { total, badge } = stockById.get(product.id) ?? { total: 0, badge: null }}
              {@const robe = wineRobe(product.product_type).key}
              {@const retired = isRetired(product)}
              <tr class="is-clickable" class:retired onclick={(e) => openRow(product, e)}>
                <td>
                  <span class="wine-cell">
                    <StyleDot {robe} />
                    <span class="wine-name">
                      <a class="row-link" href="/manage/products/{product.id}">{productTitle(product)}</a>
                      <span class="t-caption">{product.producer?.name ?? "—"}{product.name && product.appellation?.name ? ` · ${product.appellation.name}` : ""}</span>
                    </span>
                  </span>
                </td>
                <td>{productTypeLabel(product.product_type)}</td>
                <td>
                  <span class="lots">
                    {#each lotsOf(product) as v (v.id)}
                      {@const q = stock?.get(v.id) ?? 0}
                      {@const lot = withVolume(String(v.year ?? v.production_year), v, kindOf(product))}
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
                      <span class="t-muted">{kindInfo(product).noBatch}</span>
                    {/each}
                  </span>
                </td>
                <td class="num">
                  <span class="stock-cell">
                    {#if badge}<StockBadge kind={badge} />{/if}
                    <strong>{stock ? `${total} bt.` : "—"}</strong>
                  </span>
                </td>
                <td class="num">{priceText(product)}</td>
                <td class="col-actions"><RowMenu items={rowItems(product)} label="Actions pour {productTitle(product)}" /></td>
              </tr>
            {/each}
          </tbody>
        </DataTable>
        <p class="t-caption footnote">Clic sur un produit pour ouvrir sa fiche. Les actions secondaires sont dans « … ».</p>
      </div>

      <ul class="cards mobile-only">
        {#each shownProducts as product (product.id)}
          {@const { total, badge } = stockById.get(product.id) ?? { total: 0, badge: null }}
          <li class="wine-card" class:retired={isRetired(product)}>
            <a class="wine-card-main" href="/manage/products/{product.id}">
              <span class="wc-top">
                <span class="wine-cell"><StyleDot type={product.product_type} /><strong>{productTitle(product)}</strong></span>
                <strong>{stock ? `${total} bt.` : "—"}</strong>
              </span>
              <span class="wc-bottom">
                <span class="t-muted">{product.producer?.name ?? ""}</span>
                {#if badge}<StockBadge kind={badge} />{/if}
              </span>
            </a>
            <RowMenu items={rowItems(product)} label="Actions pour {productTitle(product)}" />
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
    ? `« ${productTitle(deleteTarget)} » (${deleteTarget.producer?.name ?? ""}) sera supprimé du catalogue, ainsi que ses ${deleteTarget.lot?.length ?? 0} ${kindInfo(deleteTarget).batchPlural.toLowerCase()} si la base l’autorise. Les ventes passées ne sont pas modifiées.`
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

<Modal open={showModal} title={editingProduct ? formKind.editLabel : formKind.newLabel} onclose={closeModal}>
  <form id="wine-form" class="wine-form" onsubmit={preventDefault(handleSubmit)}>
    <!-- Choisi à la création seulement : la base refuse de changer le type d'un produit qui a des millésimes ou des lots. -->
    <Field id="wine-kind" label="Type de produit" required help={editingProduct ? "Ne change plus une fois le produit créé." : ""}>
      <select
        id="wine-kind"
        class="ui-control"
        value={formData.kind}
        onchange={(e) => setFormKind(e.currentTarget.value as ProductKind)}
        disabled={!!editingProduct}
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
        <select id="wine-winery" class="ui-control" bind:value={formData.producer_id} required>
          <option value="">Sélectionner un domaine</option>
          {#each producers as producer}
            <option value={producer.id}>{producer.name}</option>
          {/each}
        </select>
      </Field>
      <Field id="wine-type" label={formKind.typeLabel} required>
        <select id="wine-type" class="ui-control" bind:value={formData.product_type_id} required>
          <option value="">Sélectionner…</option>
          {#each formTypes as productType}
            <option value={productType.id}>{productTypeLabel(productType)}</option>
          {/each}
        </select>
      </Field>
    </div>
    <Field id="wine-appellation" label="Appellation" optional>
      <select id="wine-appellation" class="ui-control" bind:value={formData.appellation_id}>
        <option value="">Aucune</option>
        {#each formAppellations as appellation}
          <option value={appellation.id}>{appellation.name}{appellation.label?.name ? ` ${appellation.label.name}` : ""}</option>
        {/each}
      </select>
    </Field>
    <Field id="wine-description" label="Description" optional>
      <textarea id="wine-description" class="ui-control" rows="3" bind:value={formData.description}></textarea>
    </Field>
  </form>
  {#snippet footer()}
      <Button variant="ghost" onclick={closeModal}>Annuler</Button>
      <Button variant="primary" onclick={handleSubmit}>{editingProduct ? "Enregistrer" : "Créer"}</Button>
  {/snippet}
</Modal>

<Modal open={showPairingsModal} title={kindInfo(selectedProduct).pairingsLabel ?? ""} maxWidth={520} onclose={closePairingsModal}>
  {#if selectedProduct}<p class="t-muted pairing-intro">{productTitle(selectedProduct)} · {selectedProduct.producer?.name ?? ""}</p>{/if}
  {#if pairingError}<div class="error-message" role="alert">{pairingError}</div>{/if}
  {#if linkedPairings.length === 0}
    <EmptyState icon={IconPlate} title="Aucun accord pour {kindInfo(selectedProduct).thisLabel}" compact />
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

  .lots {
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
