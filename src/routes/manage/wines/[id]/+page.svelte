<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import type { PageData } from "./$types";
  import type { WineVintage } from "$lib/types";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import Modal from "$lib/ui/Modal.svelte";
  import Button from "$lib/ui/Button.svelte";
  import IconButton from "$lib/ui/IconButton.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import DataTable from "$lib/ui/DataTable.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import RowMenu from "$lib/ui/RowMenu.svelte";
  import type { MenuItem } from "$lib/ui/Menu.svelte";
  import StockBadge from "$lib/ui/StockBadge.svelte";
  import {
    IconArchive,
    IconArchiveRestore,
    IconBox,
    IconGrape,
    IconPencil,
    IconPlus,
    IconTrash,
    IconWine,
    IconX,
  } from "$lib/ui/icons";
  import { formatEUR } from "$lib/format";
  import { appellationText, isDiscontinued, wineStyle, wineTitle } from "$lib/wine";

  export let data: PageData;

  let wine = data.wine;
  /* Millésimes déjà chargés par +page.ts ; relus seulement après une modification. */
  let vintages: WineVintage[] = [...(wine.wine_vintage || [])].sort(
    (a, b) => b.production_year - a.production_year,
  );
  let loading = false;
  let error = "";
  /** Modale unique création / édition (`editingVintage` les distingue). */
  let formOpen = false;
  let editingVintage: any = null;

  // Vintage form fields
  let vintageFormData = {
    production_year: "",
    year: "",
    abv: "",
    purchase_price: "",
    price: "",
    image_url: "",
    organic: false,
  };

  // Grapes modal state
  let showGrapesModal = false;
  let selectedVintage: any = null;
  let vintageGrapes: any[] = [];
  let allGrapes: any[] = [];
  let selectedGrapeId = "";
  let grapePercentage = "";

  onMount(async () => {
    /* Lien « Ajouter un millésime » depuis la liste des vins. */
    if (new URLSearchParams(window.location.search).has("nouveau")) openCreateModal();
    await loadAllGrapes();
  });

  async function loadAllGrapes() {
    const { data } = await supabase.from("grape").select("*").order("name");
    if (data) allGrapes = data;
  }

  async function loadVintages() {
    loading = true;
    const { data: vintagesData, error: fetchError } = await supabase
      .from("wine_vintage")
      .select("*")
      .eq("wine_id", wine.id)
      .order("production_year", { ascending: false });

    if (fetchError) {
      error = fetchError.message;
    } else {
      vintages = vintagesData || [];
    }
    loading = false;
  }

  function openCreateModal() {
    editingVintage = null;
    resetForm();
    formOpen = true;
  }

  function openEditModal(vintage: WineVintage) {
    editingVintage = vintage;
    vintageFormData = {
      production_year: vintage.production_year
        ? vintage.production_year.toString()
        : "",
      year: vintage.year ? vintage.year.toString() : "",
      abv: vintage.abv ? vintage.abv.toString() : "",
      purchase_price: vintage.purchase_price
        ? vintage.purchase_price.toString()
        : "",
      price: vintage.price ? vintage.price.toString() : "",
      image_url: vintage.image_url || "",
      organic: vintage.organic || false,
    };
    formOpen = true;
  }

  function closeForm() {
    formOpen = false;
    editingVintage = null;
    resetForm();
  }

  function resetForm() {
    vintageFormData = {
      production_year: "",
      year: "",
      abv: "",
      purchase_price: "",
      price: "",
      image_url: "",
      organic: false,
    };
  }

  /** Création ou modification (selon `editingVintage`) du millésime. */
  async function submitForm() {
    if (!vintageFormData.production_year) {
      error = "L'année de mise en bouteille est obligatoire";
      return;
    }

    const vintageData = {
      production_year: parseInt(vintageFormData.production_year),
      year: vintageFormData.year ? parseInt(vintageFormData.year) : null,
      abv: vintageFormData.abv ? parseFloat(vintageFormData.abv) : null,
      purchase_price: vintageFormData.purchase_price
        ? parseFloat(vintageFormData.purchase_price)
        : undefined,
      price: vintageFormData.price ? parseFloat(vintageFormData.price) : null,
      image_url: vintageFormData.image_url || null,
      organic: vintageFormData.organic,
    };

    const { error: saveError } = editingVintage
      ? await supabase.from("wine_vintage").update(vintageData).eq("id", editingVintage.id)
      : await supabase.from("wine_vintage").insert({ ...vintageData, wine_id: wine.id });

    if (saveError) {
      error = saveError.message;
      return;
    }

    closeForm();
    await loadVintages();
  }

  let deleteTarget: WineVintage | null = null;
  let confirmOpen = false;
  let deleting = false;

  function askDelete(vintage: WineVintage) {
    deleteTarget = vintage;
    confirmOpen = true;
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    deleting = true;
    const { error: deleteError } = await supabase
      .from("wine_vintage")
      .delete()
      .eq("id", deleteTarget.id);
    deleting = false;
    confirmOpen = false;

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    error = "";
    await loadVintages();
  }

  function vintageName(v: WineVintage): string {
    return v.year ? String(v.year) : `Non millésimé (${v.production_year})`;
  }

  /** « Plus jamais disponible » : masqué du site, exclu du réassort. Réversible. */
  async function toggleDiscontinued(vintage: WineVintage) {
    const { error: updateError } = await supabase
      .from("wine_vintage")
      .update({ discontinued_at: isDiscontinued(vintage) ? null : new Date().toISOString() })
      .eq("id", vintage.id);

    if (updateError) {
      error = updateError.message;
      return;
    }

    await loadVintages();
  }

  function rowItems(v: WineVintage): MenuItem[] {
    const gone = isDiscontinued(v);
    return [
      { label: "Gérer le stock", icon: IconBox, href: `/manage/wines/${wine.id}/stock/${v.id}` },
      { label: "Cépages", icon: IconGrape, onSelect: () => openGrapesModal(v) },
      { label: "Modifier", icon: IconPencil, onSelect: () => openEditModal(v) },
      {
        label: gone ? "Remettre au catalogue" : "Plus jamais disponible",
        icon: gone ? IconArchiveRestore : IconArchive,
        onSelect: () => toggleDiscontinued(v),
      },
      { label: "Supprimer…", icon: IconTrash, danger: true, separator: true, onSelect: () => askDelete(v) },
    ];
  }

  $: subtitle = [wine.winery?.name, appellationText(wine.appelation), wine.wine_type && wineStyle(wine.wine_type).label].filter(Boolean).join(" · ");

  // Grapes modal functions
  async function openGrapesModal(vintage: any) {
    selectedVintage = vintage;
    await loadVintageGrapes();
    showGrapesModal = true;
  }

  async function loadVintageGrapes() {
    if (!selectedVintage) return;

    const { data } = await supabase
      .from("wine_vintage_grape")
      .select(
        `
        grape_id,
        percentage,
        grape (*)
      `
      )
      .eq("wine_vintage_id", selectedVintage.id);

    vintageGrapes = data || [];
  }

  async function addGrape() {
    if (!selectedGrapeId || !selectedVintage) return;

    const { error: insertError } = await supabase
      .from("wine_vintage_grape")
      .insert({
        wine_vintage_id: selectedVintage.id,
        grape_id: selectedGrapeId,
        percentage: grapePercentage ? parseFloat(grapePercentage) : null,
      });

    if (insertError) {
      error = insertError.message;
      return;
    }

    selectedGrapeId = "";
    grapePercentage = "";
    await loadVintageGrapes();
  }

  async function removeGrape(grapeId: string) {
    if (!selectedVintage) return;

    if (!confirm("Êtes-vous sûr de vouloir supprimer ce cépage ?")) {
      return;
    }

    const { error: deleteError } = await supabase
      .from("wine_vintage_grape")
      .delete()
      .eq("wine_vintage_id", selectedVintage.id)
      .eq("grape_id", grapeId);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    await loadVintageGrapes();
  }

  function closeGrapesModal() {
    showGrapesModal = false;
    selectedVintage = null;
    vintageGrapes = [];
    selectedGrapeId = "";
    grapePercentage = "";
  }

  function isGrapeLinked(grapeId: string): boolean {
    return vintageGrapes.some((vg) => vg.grape_id === grapeId);
  }
</script>

<svelte:head>
  <title>{wineTitle(wine)} - Gestion</title>
</svelte:head>

<ManagePageShell title={wineTitle(wine)} {subtitle} back={{ href: "/manage/wines", label: "Vins" }}>
  <svelte:fragment slot="actions">
    <Button variant="primary" on:click={openCreateModal}><IconPlus size={16} strokeWidth={1.75} /> Nouveau millésime</Button>
  </svelte:fragment>

  {#if wine.description}
    <p class="wine-description">{wine.description}</p>
  {/if}

  {#if error}
    <div class="error-message" role="alert">{error}</div>
  {/if}

  {#if loading}
    <div class="loading">Chargement…</div>
  {:else if vintages.length === 0}
    <EmptyState icon={IconWine} title="Aucun millésime pour ce vin" text="Ajoutez un millésime pour le vendre, le stocker et le servir en dégustation.">
      <Button on:click={openCreateModal}><IconPlus size={16} strokeWidth={1.75} /> Nouveau millésime</Button>
    </EmptyState>
  {:else}
    <DataTable caption="Millésimes de {wineTitle(wine)}">
      <thead>
        <tr>
          <th scope="col">Millésime</th>
          <th scope="col">Mise en bouteille</th>
          <th scope="col" class="num">Degré</th>
          <th scope="col" class="num">Prix d’achat</th>
          <th scope="col" class="num">Prix de vente</th>
          <th scope="col" class="col-actions"><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {#each vintages as vintage (vintage.id)}
          <tr class:gone={isDiscontinued(vintage)}>
            <td>
              <span class="vintage-cell">
                {#if vintage.image_url}<img src={vintage.image_url} alt="" class="thumb" />{/if}
                <a class="vintage-link" href="/manage/wines/{wine.id}/stock/{vintage.id}">{vintageName(vintage)}</a>
                {#if vintage.organic}<span class="ui-chip organic">Bio</span>{/if}
                {#if isDiscontinued(vintage)}<StockBadge kind="gone" />{/if}
              </span>
            </td>
            <td>{vintage.production_year}</td>
            <td class="num">{vintage.abv != null ? `${vintage.abv} %` : "—"}</td>
            <td class="num">{formatEUR(vintage.purchase_price)}</td>
            <td class="num">{formatEUR(vintage.price)}</td>
            <td class="col-actions"><RowMenu items={rowItems(vintage)} label="Actions pour {vintageName(vintage)}" /></td>
          </tr>
        {/each}
      </tbody>
    </DataTable>
  {/if}
</ManagePageShell>

<!-- Modal de création / édition -->
<Modal open={formOpen} title="{editingVintage ? 'Modifier le millésime' : 'Nouveau millésime'} - {wine.name}" maxWidth={640} on:close={closeForm}>
  <form id="vintage-form" on:submit|preventDefault={submitForm}>
    <div class="form-grid">
      <div class="form-group">
        <label for="production_year">Année de mise en bouteille *</label>
        <input
          type="number"
          id="production_year"
          bind:value={vintageFormData.production_year}
          min="1900"
          max="2030"
          required
        />
      </div>

      <div class="form-group">
        <label for="year">Année millésime</label>
        <input
          type="number"
          id="year"
          bind:value={vintageFormData.year}
          min="1900"
          max="2030"
          placeholder="Si le vin est non millésimé, laissez vide"
        />
      </div>

      <div class="form-group">
        <label for="purchase_price">Prix d'achat (€)</label>
        <input
          type="number"
          step="0.01"
          id="purchase_price"
          bind:value={vintageFormData.purchase_price}
          min="0"
          placeholder="Prix auquel vous achetez le vin"
        />
      </div>

      <div class="form-group">
        <label for="price">Prix de vente (€)</label>
        <input
          type="number"
          step="0.01"
          id="price"
          bind:value={vintageFormData.price}
          min="0"
          placeholder="Prix auquel vous vendez le vin"
        />
      </div>

      <div class="form-group">
        <label for="abv">Degré d'alcool (%)</label>
        <input
          type="number"
          step="0.1"
          id="abv"
          bind:value={vintageFormData.abv}
          min="0"
          max="20"
        />
      </div>

      <div class="form-group">
        <label for="image_url">URL de l'image</label>
        <input
          type="url"
          id="image_url"
          bind:value={vintageFormData.image_url}
        />
      </div>

      <div class="form-group full-width">
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={vintageFormData.organic} />
          Vin biologique
        </label>
      </div>
    </div>
  </form>
  <svelte:fragment slot="footer">
    <Button variant="ghost" on:click={closeForm}>Annuler</Button>
    <Button variant="primary" type="submit" form="vintage-form">{editingVintage ? "Mettre à jour" : "Créer le millésime"}</Button>
  </svelte:fragment>
</Modal>

<!-- Cépages d'un millésime -->
<Modal open={showGrapesModal} title="Cépages" maxWidth={520} on:close={closeGrapesModal}>
  {#if selectedVintage}<p class="t-muted grapes-intro">{wineTitle(wine)} · {vintageName(selectedVintage)}</p>{/if}
  {#if vintageGrapes.length === 0}
    <EmptyState icon={IconGrape} title="Aucun cépage pour ce millésime" compact />
  {:else}
    <ul class="grapes">
      {#each vintageGrapes as vintageGrape (vintageGrape.grape_id)}
        <li>
          <span>{vintageGrape.grape.name}{#if vintageGrape.percentage}<span class="t-muted"> · {vintageGrape.percentage} %</span>{/if}</span>
          <IconButton label="Retirer {vintageGrape.grape.name}" on:click={() => removeGrape(vintageGrape.grape_id)}>
            <IconX size={16} strokeWidth={1.75} />
          </IconButton>
        </li>
      {/each}
    </ul>
  {/if}
  <div class="add-grape">
    <select class="ui-control" bind:value={selectedGrapeId} aria-label="Cépage à ajouter">
      <option value="">Choisir un cépage…</option>
      {#each allGrapes as grape (grape.id)}
        <option value={grape.id} disabled={isGrapeLinked(grape.id)}>
          {grape.name}{isGrapeLinked(grape.id) ? " (déjà ajouté)" : ""}
        </option>
      {/each}
    </select>
    <input
      class="ui-control percent"
      type="number"
      step="0.1"
      min="0"
      max="100"
      placeholder="%"
      aria-label="Pourcentage"
      bind:value={grapePercentage}
      disabled={!selectedGrapeId}
    />
    <Button on:click={addGrape} disabled={!selectedGrapeId}><IconPlus size={16} strokeWidth={1.75} /> Ajouter</Button>
  </div>
  <svelte:fragment slot="footer">
    <Button variant="primary" on:click={closeGrapesModal}>Terminé</Button>
  </svelte:fragment>
</Modal>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Supprimer ce millésime ?"
  message={deleteTarget ? `Le millésime ${vintageName(deleteTarget)} sera supprimé, avec ses cépages et notes, si aucune vente ni aucun mouvement de stock ne l’utilise.` : ""}
  busy={deleting}
  on:confirm={confirmDelete}
/>

<style>
  .wine-description {
    max-width: 72ch;
    margin: 0 0 20px;
    color: var(--ink-2);
    line-height: 1.6;
  }

  /* Millésime retiré : ligne en retrait, actions toujours utilisables. */
  tr.gone td:not(.col-actions) {
    opacity: 0.55;
  }

  .vintage-cell {
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }

  .thumb {
    width: 28px;
    height: 40px;
    object-fit: contain;
  }

  .vintage-link {
    font-weight: 600;
    text-decoration: none;
  }

  .vintage-link:hover {
    text-decoration: underline;
  }

  .organic {
    padding: 0 8px;
    height: 22px;
    font-size: 12px;
  }

  .grapes-intro {
    margin: 0 0 12px;
  }

  .grapes {
    margin: 0 0 16px;
    padding: 0;
    list-style: none;
  }

  .grapes li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 4px 4px 14px;
    border-bottom: 1px solid var(--border-soft);
  }

  .grapes li:last-child {
    border-bottom: none;
  }

  .add-grape {
    display: flex;
    gap: 8px;
  }

  .add-grape select {
    flex: 1;
  }

  .add-grape .percent {
    width: 84px;
  }
</style>
