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
  import WineBottle from "$lib/components/site/WineBottle.svelte";
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
  import {
    appellationText,
    grapesText,
    isDiscontinued,
    vintageNotes,
    vintageYearLabel,
    wineStyle,
    wineTitle,
    wineTypeLabel,
  } from "$lib/wine";

  export let data: PageData;

  let wine = data.wine;
  /* Millésimes déjà chargés par +page.ts ; relus seulement après une modification. */
  let vintages: WineVintage[] = sortVintages(wine.wine_vintage || []);
  let error = "";
  /** Modale unique création / édition (`editingVintage` les distingue). */
  let formOpen = false;
  let saving = false;
  let editingVintage: any = null;

  function emptyForm() {
    return { production_year: "", year: "", abv: "", purchase_price: "", price: "", image_url: "", organic: false };
  }
  let vintageFormData = emptyForm();

  /*
   * Nouveau millésime d'un vin qui en a déjà : on reprend image, cépages et notes de dégustation
   * d'un millésime existant (le plus récent par défaut). Les accords sont ceux du vin.
   */
  /** Millésime repris ; vide : « Ne rien reprendre ». */
  let sourceId = "";
  let copyGrapes = true;
  let copyNotes = true;
  /** Cépages et notes des millésimes, en texte, lus à l'ouverture de la création. */
  let sourceDetails: Record<string, { grapes: string; notes: string }> | null = null;
  $: source = editingVintage ? null : vintages.find((v) => v.id === sourceId);
  $: sourceInfo = source && sourceDetails?.[source.id];
  /* Rien à reprendre : case décochée et grisée (tant que c'est en lecture, on ne sait pas). */
  $: noGrapes = !!sourceInfo && !sourceInfo.grapes;
  $: noNotes = !!sourceInfo && !sourceInfo.notes;
  /* Ce que les cases annoncent est exactement ce qui est copié. */
  $: takeGrapes = copyGrapes && !noGrapes;
  $: takeNotes = copyNotes && !noNotes;
  $: imageReused = !!source?.image_url && vintageFormData.image_url === source.image_url;

  // Grapes modal state
  let showGrapesModal = false;
  let selectedVintage: any = null;
  let vintageGrapes: any[] = [];
  let allGrapes: any[] = [];
  let selectedGrapeId = "";
  let grapePercentage = "";

  onMount(() => {
    /* Lien « Ajouter un millésime » depuis la liste des vins. */
    if (new URLSearchParams(window.location.search).has("nouveau")) openCreateModal();
  });

  function sortVintages(list: WineVintage[]): WineVintage[] {
    return [...list].sort((a, b) => b.production_year - a.production_year);
  }

  function openCreateModal() {
    editingVintage = null;
    sourceId = vintages[0]?.id ?? "";
    copyGrapes = copyNotes = true;
    vintageFormData = { ...emptyForm(), image_url: vintages[0]?.image_url ?? "" };
    formOpen = true;
    if (vintages.length) loadSourceDetails();
  }

  let detailsRequest = 0;

  async function loadSourceDetails() {
    sourceDetails = null;
    const request = ++detailsRequest;
    const { data, error: loadError } = await supabase
      .from("wine_vintage")
      .select("id, wine_vintage_grape ( percentage, grape ( name ) ), note ( type, content )")
      .eq("wine_id", wine.id);
    /* Une ouverture plus récente a relancé la lecture : sa réponse fait foi. */
    if (request !== detailsRequest) return;
    if (loadError) {
      error = `Cépages et notes des millésimes illisibles : ${loadError.message}`;
      return;
    }
    sourceDetails = Object.fromEntries(
      (data || []).map((v) => [
        v.id,
        { grapes: grapesText(v.wine_vintage_grape, true), notes: vintageNotes(v.note).map((n) => n.label).join(", ") },
      ]),
    );
  }

  /** Changement de millésime repris (ou aucun) : l'image suit, sauf si on en a mis une autre. */
  function pickSource(id: string) {
    if (imageReused || !vintageFormData.image_url) vintageFormData.image_url = vintages.find((v) => v.id === id)?.image_url ?? "";
    sourceId = id;
  }

  /** Création via la base : le millésime et ses reprises en une transaction, puis la ligne créée. */
  async function createVintage(vintageData: Record<string, unknown>) {
    const { data: id, error: rpcError } = await supabase.rpc("create_wine_vintage", {
      p_vintage: { ...vintageData, wine_id: wine.id },
      p_source_id: source?.id,
      p_copy_grapes: takeGrapes,
      p_copy_notes: takeNotes,
    });
    if (rpcError) return { data: null, error: rpcError };
    const read = await supabase.from("wine_vintage").select().eq("id", id).single();
    /* Le millésime existe : on ferme le formulaire, un second clic le créerait en double. */
    if (read.error) {
      closeForm();
      error = `Millésime créé, mais la liste n’a pas pu être relue : rechargez la page (${read.error.message}).`;
    }
    return read;
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
    error = "";
  }

  /** Création ou modification (selon `editingVintage`) du millésime. */
  /** Valeur d'un champ numérique (bind:value donne un nombre, ou "" / null s'il est vide). */
  function num(v: unknown): number | null {
    return v === "" || v == null ? null : Number(v);
  }

  async function submitForm() {
    if (saving) return;
    if (!vintageFormData.production_year) {
      error = "L'année de mise en bouteille est obligatoire";
      return;
    }

    const vintageData = {
      production_year: Number(vintageFormData.production_year),
      year: num(vintageFormData.year),
      abv: num(vintageFormData.abv),
      /* Prix d'achat obligatoire en base : vide, on garde l'actuel (ou le défaut à la création). */
      purchase_price: num(vintageFormData.purchase_price) ?? undefined,
      price: num(vintageFormData.price),
      image_url: vintageFormData.image_url || null,
      organic: vintageFormData.organic,
    };

    /* La ligne enregistrée revient de la base : la liste se met à jour sans tout relire. */
    saving = true;
    const { data: saved, error: saveError } = editingVintage
      ? await supabase.from("wine_vintage").update(vintageData).eq("id", editingVintage.id).select().single()
      : await createVintage(vintageData);
    saving = false;

    if (saveError || !saved) {
      /* Formulaire déjà fermé : createVintage a posé son propre message. */
      if (formOpen) error = saveError?.message ?? "Millésime introuvable après l’enregistrement";
      return;
    }

    vintages = sortVintages([...vintages.filter((v) => v.id !== saved.id), saved]);
    error = "";
    closeForm();
  }

  let deleteTarget: WineVintage | null = null;

  async function deleteVintage(vintage: WineVintage) {
    const { error: deleteError } = await supabase.from("wine_vintage").delete().eq("id", vintage.id);
    if (deleteError) {
      error = deleteError.message;
      return;
    }
    vintages = vintages.filter((v) => v.id !== vintage.id);
    error = "";
  }

  /** « Plus jamais disponible » : masqué du site, exclu du réassort. Réversible. */
  async function toggleDiscontinued(vintage: WineVintage) {
    const { data: saved, error: updateError } = await supabase
      .from("wine_vintage")
      .update({ discontinued_at: isDiscontinued(vintage) ? null : new Date().toISOString() })
      .eq("id", vintage.id)
      .select()
      .single();

    if (updateError) {
      error = updateError.message;
      return;
    }

    vintages = vintages.map((v) => (v.id === saved.id ? saved : v));
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
      { label: "Supprimer…", icon: IconTrash, danger: true, separator: true, onSelect: () => (deleteTarget = v) },
    ];
  }

  $: subtitle = [wine.winery?.name, appellationText(wine.appelation), wineTypeLabel(wine.wine_type)].filter(Boolean).join(" · ");

  // Grapes modal functions
  async function openGrapesModal(vintage: any) {
    selectedVintage = vintage;
    /* La liste des cépages n'est lue qu'à la première ouverture. */
    await Promise.all([
      loadVintageGrapes(),
      allGrapes.length
        ? null
        : supabase.from("grape").select("*").order("name").then(({ data }) => (allGrapes = data || [])),
    ]);
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

    if (!confirm("Retirer ce cépage du millésime ?")) {
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
    error = "";
    selectedVintage = null;
    vintageGrapes = [];
    selectedGrapeId = "";
    grapePercentage = "";
  }

  $: linkedGrapeIds = new Set(vintageGrapes.map((vg) => vg.grape_id));
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

  {#if error && !formOpen && !showGrapesModal}
    <div class="error-message" role="alert">{error}</div>
  {/if}

  {#if vintages.length === 0}
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
                <a class="row-link" href="/manage/wines/{wine.id}/stock/{vintage.id}">{vintageYearLabel(vintage)}</a>
                {#if vintage.organic}<span class="ui-chip organic">Bio</span>{/if}
                {#if isDiscontinued(vintage)}<StockBadge kind="gone" />{/if}
              </span>
            </td>
            <td>{vintage.production_year}</td>
            <td class="num">{vintage.abv != null ? `${vintage.abv} %` : "—"}</td>
            <td class="num">{formatEUR(vintage.purchase_price)}</td>
            <td class="num">{formatEUR(vintage.price)}</td>
            <td class="col-actions"><RowMenu items={rowItems(vintage)} label="Actions pour {vintageYearLabel(vintage)}" /></td>
          </tr>
        {/each}
      </tbody>
    </DataTable>
  {/if}
</ManagePageShell>

<!-- Modal de création / édition -->
<Modal open={formOpen} title="{editingVintage ? 'Modifier le millésime' : 'Nouveau millésime'} - {wine.name}" on:close={closeForm}>
  {#if error}<div class="error-message" role="alert">{error}</div>{/if}
  <form id="vintage-form" on:submit|preventDefault={submitForm}>
    <div class="form-grid">
      {#if !editingVintage && vintages.length}
        <fieldset class="form-group full-width reuse">
          <legend class="section-title">Reprendre d’un millésime existant</legend>
          <select aria-label="Millésime repris" value={sourceId} on:change={(e) => pickSource(e.currentTarget.value)}>
            <option value="">Ne rien reprendre</option>
            {#each vintages as v (v.id)}
              <option value={v.id}>{vintageYearLabel(v)}</option>
            {/each}
          </select>
          {#if source}
            <div class="reuse-items">
              <!-- Aperçu de la bouteille à côté des cases (silhouette du site sans image) : lignes de même hauteur. -->
              <div class="reuse-preview" class:off={!imageReused} aria-hidden="true">
                <WineBottle src={source.image_url} wine={wineStyle(wine.wine_type)} height="80px" />
              </div>
              <div class="reuse-checks">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    checked={imageReused}
                    disabled={!source.image_url}
                    on:change={(e) => (vintageFormData.image_url = e.currentTarget.checked ? source?.image_url ?? "" : "")}
                  />
                  Image
                  {#if !source.image_url}<span class="t-muted">aucune</span>{/if}
                </label>
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    checked={takeGrapes}
                    disabled={noGrapes}
                    on:change={(e) => (copyGrapes = e.currentTarget.checked)}
                  />
                  Cépages
                  <span class="t-muted">{sourceInfo ? sourceInfo.grapes || "aucun" : "…"}</span>
                </label>
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    checked={takeNotes}
                    disabled={noNotes}
                    on:change={(e) => (copyNotes = e.currentTarget.checked)}
                  />
                  Notes de dégustation
                  <span class="t-muted">{sourceInfo ? sourceInfo.notes || "aucune" : "…"}</span>
                </label>
              </div>
            </div>
          {/if}
          <p class="t-caption reuse-hint">Les accords mets-vins sont ceux du vin : ils valent déjà pour tous ses millésimes.</p>
        </fieldset>
      {/if}

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
          disabled={imageReused}
          aria-describedby={imageReused ? "image-hint" : undefined}
        />
        <!-- Image reprise : on la change en décochant « Image » plus haut. -->
        {#if imageReused}
          <span id="image-hint" class="t-caption">Décochez « Image » pour en mettre une autre.</span>
        {/if}
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
    <Button variant="primary" type="submit" form="vintage-form" disabled={saving}>{editingVintage ? "Mettre à jour" : "Créer le millésime"}</Button>
  </svelte:fragment>
</Modal>

<!-- Cépages d'un millésime -->
<Modal open={showGrapesModal} title="Cépages" maxWidth={520} on:close={closeGrapesModal}>
  {#if error}<div class="error-message" role="alert">{error}</div>{/if}
  {#if selectedVintage}<p class="t-muted grapes-intro">{wineTitle(wine)} · {vintageYearLabel(selectedVintage)}</p>{/if}
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
        <option value={grape.id} disabled={linkedGrapeIds.has(grape.id)}>
          {grape.name}{linkedGrapeIds.has(grape.id) ? " (déjà ajouté)" : ""}
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
  open={!!deleteTarget}
  title="Supprimer ce millésime ?"
  message={deleteTarget ? `Le millésime ${vintageYearLabel(deleteTarget)} sera supprimé, avec ses cépages et notes, si aucune vente ni aucun mouvement de stock ne l’utilise.` : ""}
  onConfirm={() => deleteVintage(deleteTarget!)}
  on:cancel={() => (deleteTarget = null)}
  on:done={() => (deleteTarget = null)}
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

  .reuse {
    margin: 0;
    padding: 12px 14px;
    border: 1px solid var(--border-soft);
    border-radius: var(--r-sm);
    gap: 10px;
  }

  .reuse legend {
    margin: 0;
    padding: 0 4px;
  }

  .reuse-items {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .reuse-preview {
    flex: none;
    display: flex;
    justify-content: center;
    width: 44px;
    transition: opacity 0.15s;
  }

  /* Image non reprise : l'aperçu s'efface. */
  .reuse-preview.off {
    opacity: 0.3;
  }

  .reuse-checks {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  .reuse .checkbox-label {
    flex-wrap: wrap;
  }

  .reuse-hint {
    margin: 0;
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
