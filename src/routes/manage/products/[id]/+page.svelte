<script lang="ts">
  import { preventDefault } from "$lib/ui/events";

  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import type { PageData } from "./$types";
  import type { WineVintage } from "$lib/types";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import Modal from "$lib/ui/Modal.svelte";
  import Button from "$lib/ui/Button.svelte";
  import IconButton from "$lib/ui/IconButton.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import Field from "$lib/ui/Field.svelte";
  import Select from "$lib/ui/Select.svelte";
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
    IconPencil,
    IconPlus,
    IconTrash,
    IconX,
  } from "$lib/ui/icons";
  import { KIND_ICONS } from "$lib/ui/kindIcons";
  import { formatEUR } from "$lib/format";
  import { errorMessage, latestOnly } from "$lib/async";
  import {
    appellationText,
    byVolume,
    grapesText,
    isDiscontinued,
    vintageNotes,
    vintageYearLabel,
    wineStyle,
    wineTitle,
    wineTypeLabel,
  } from "$lib/wine";
  import { formatVolume, kindInfo, kindListHref, kindOf } from "$lib/productKinds";

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  let wine = data.wine;
  /** Vocabulaire du produit : millésime ou lot, cépages ou variétés… */
  const kind = kindInfo(wine);
  const kindIcons = KIND_ICONS[kind.key];
  /* Millésimes déjà chargés par +page.ts ; relus seulement après une modification. */
  let vintages = $state<WineVintage[]>(sortVintages(wine.wine_vintage || []));
  let error = $state("");
  /** Modale unique création / édition (`editingVintage` les distingue). */
  let formOpen = $state(false);
  let saving = $state(false);
  let editingVintage = $state<any>(null);

  function emptyForm() {
    return {
      production_year: "",
      year: "",
      volume_ml: String(kind.volumes[0]),
      abv: "",
      purchase_price: "",
      price: "",
      image_url: "",
      organic: false,
    };
  }
  let vintageFormData = $state(emptyForm());

  /*
   * Nouveau millésime d'un vin qui en a déjà : on reprend image, cépages et notes de dégustation
   * d'un millésime existant (le plus récent par défaut). Les accords sont ceux du vin.
   */
  /** Millésime repris ; vide : « Ne rien reprendre ». */
  let sourceId = $state("");
  let copyGrapes = $state(true);
  let copyNotes = $state(true);
  /** Cépages et notes des millésimes, en texte, lus à l'ouverture de la création. */
  let sourceDetails = $state<Record<string, { grapes: string; notes: string }> | null>(null);
  let source = $derived(editingVintage ? null : vintages.find((v) => v.id === sourceId));
  let sourceInfo = $derived(source && sourceDetails?.[source.id]);
  /* Rien à reprendre : case décochée et grisée (tant que c'est en lecture, on ne sait pas). */
  let noGrapes = $derived(!!sourceInfo && !sourceInfo.grapes);
  let noNotes = $derived(!!sourceInfo && !sourceInfo.notes);
  /* Ce que les cases annoncent est exactement ce qui est copié. */
  let takeGrapes = $derived(copyGrapes && !noGrapes);
  let takeNotes = $derived(copyNotes && !noNotes);
  let imageReused = $derived(!!source?.image_url && vintageFormData.image_url === source.image_url);

  // Grapes modal state
  let showGrapesModal = $state(false);
  let selectedVintage = $state<any>(null);
  let vintageGrapes = $state<any[]>([]);
  let allGrapes = $state<any[]>([]);
  let selectedGrapeId = $state("");
  let grapePercentage = $state("");

  onMount(() => {
    /* Lien « Ajouter un millésime » depuis la liste des vins. */
    if (new URLSearchParams(window.location.search).has("nouveau")) openCreateModal();
  });

  function sortVintages(list: WineVintage[]): WineVintage[] {
    return [...list].sort((a, b) => b.production_year - a.production_year || byVolume(a, b));
  }

  function openCreateModal() {
    editingVintage = null;
    copyGrapes = copyNotes = true;
    vintageFormData = emptyForm();
    pickSource(vintages[0]?.id ?? "");
    formOpen = true;
    if (vintages.length) loadSourceDetails();
  }

  /* Une ouverture plus récente relance la lecture : sa réponse fait foi. */
  const detailsLoad = latestOnly((e) => (error = `${kind.ingredients} et notes illisibles : ${errorMessage(e)}`));

  async function loadSourceDetails() {
    sourceDetails = null;
    const data = await detailsLoad.run(async () => {
      const res = await supabase
        .from("wine_vintage")
        .select("id, wine_vintage_grape ( percentage, grape ( name ) ), note ( type, content )")
        .eq("wine_id", wine.id);
      if (res.error) throw new Error(res.error.message);
      return res.data;
    });
    if (!data) return;
    sourceDetails = Object.fromEntries(
      data.map((v) => [
        v.id,
        { grapes: grapesText(v.wine_vintage_grape, true), notes: vintageNotes(v.note, kind.key).map((n) => n.label).join(", ") },
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
      error = `Enregistré, mais la liste n’a pas pu être relue : rechargez la page (${read.error.message}).`;
    }
    return read;
  }

  function openEditModal(vintage: WineVintage) {
    editingVintage = vintage;
    /* `!= null` et non un test de vérité : un prix ou un degré à 0 reste 0 (et non vide, donc null). */
    const text = (v: number | null) => (v != null ? String(v) : "");
    vintageFormData = {
      production_year: text(vintage.production_year),
      volume_ml: String(vintage.volume_ml),
      year: text(vintage.year),
      abv: text(vintage.abv),
      purchase_price: text(vintage.purchase_price),
      price: text(vintage.price),
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
      abv: kind.hasAbv ? num(vintageFormData.abv) : null,
      /* Prix d'achat obligatoire en base : vide, on garde l'actuel (ou le défaut à la création). */
      purchase_price: num(vintageFormData.purchase_price) ?? undefined,
      price: num(vintageFormData.price),
      image_url: vintageFormData.image_url || null,
      organic: vintageFormData.organic,
      /* Contenant fixé à la création (voir le formulaire). */
      ...(editingVintage ? {} : { volume_ml: Number(vintageFormData.volume_ml) }),
    };

    /* La ligne enregistrée revient de la base : la liste se met à jour sans tout relire. */
    saving = true;
    const { data: saved, error: saveError } = editingVintage
      ? await supabase.from("wine_vintage").update(vintageData).eq("id", editingVintage.id).select().single()
      : await createVintage(vintageData);
    saving = false;

    if (saveError || !saved) {
      /* Formulaire déjà fermé : createVintage a posé son propre message. */
      /* 23505 : index unique produit + année + contenant (un seul « 50 cl 2025 » par produit). */
      if (formOpen) {
        error = saveError?.code === "23505"
          ? `Ce ${kind.batch.toLowerCase()} existe déjà (même année, ou même mise en bouteille sans année, et même contenant). S’il est « plus jamais disponible », remettez-le plutôt au catalogue.`
          : saveError?.message ?? "Introuvable après l’enregistrement";
      }
      return;
    }

    vintages = sortVintages([...vintages.filter((v) => v.id !== saved.id), saved]);
    error = "";
    closeForm();
  }

  let deleteTarget = $state<WineVintage | null>(null);

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
      { label: "Gérer le stock", icon: IconBox, href: `/manage/products/${wine.id}/stock/${v.id}` },
      { label: kind.ingredients, icon: kindIcons.ingredient, onSelect: () => openGrapesModal(v) },
      { label: "Modifier", icon: IconPencil, onSelect: () => openEditModal(v) },
      {
        label: gone ? "Remettre au catalogue" : "Plus jamais disponible",
        icon: gone ? IconArchiveRestore : IconArchive,
        onSelect: () => toggleDiscontinued(v),
      },
      { label: "Supprimer…", icon: IconTrash, danger: true, separator: true, onSelect: () => (deleteTarget = v) },
    ];
  }

  let subtitle = $derived([wine.winery?.name, appellationText(wine.appelation), wineTypeLabel(wine.wine_type)].filter(Boolean).join(" · "));

  // Grapes modal functions
  async function openGrapesModal(vintage: any) {
    selectedVintage = vintage;
    /* La liste des cépages n'est lue qu'à la première ouverture. */
    await Promise.all([
      loadVintageGrapes(),
      allGrapes.length
        ? null
        : supabase.from("grape").select("*").eq("kind", kind.key).order("name").then(({ data }) => (allGrapes = data || [])),
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

  /** Élément de la composition à retirer, en attente de confirmation. */
  let grapeToRemove = $state<any>(null);

  /** Appelée après confirmation via le ConfirmDialog. */
  async function removeGrape(grapeId: string) {
    if (!selectedVintage) return;

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

  let linkedGrapeIds = $derived(new Set(vintageGrapes.map((vg) => vg.grape_id)));
</script>

<svelte:head>
  <title>{wineTitle(wine)} - Gestion</title>
</svelte:head>

<ManagePageShell title={wineTitle(wine)} {subtitle} back={{ href: kindListHref("/manage/products", kindOf(wine)), label: "Produits" }}>
  {#snippet actions()}
      <Button variant="primary" onclick={openCreateModal}><IconPlus size={16} strokeWidth={1.75} /> {kind.newBatch}</Button>
  {/snippet}

  {#if wine.description}
    <p class="wine-description">{wine.description}</p>
  {/if}

  {#if error && !formOpen && !showGrapesModal}
    <div class="error-message" role="alert">{error}</div>
  {/if}

  {#if vintages.length === 0}
    <EmptyState icon={kindIcons.product} title="{kind.noBatch} pour {kind.thisLabel}" text="À ajouter pour vendre, stocker et servir en dégustation.">
      <Button onclick={openCreateModal}><IconPlus size={16} strokeWidth={1.75} /> {kind.newBatch}</Button>
    </EmptyState>
  {:else}
    <DataTable caption="{kind.batchPlural} de {wineTitle(wine)}">
      <thead>
        <tr>
          <th scope="col">{kind.batch}</th>
          <th scope="col">Mise en bouteille</th>
          {#if kind.hasAbv}<th scope="col" class="num">Degré</th>{/if}
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
                <a class="row-link" href="/manage/products/{wine.id}/stock/{vintage.id}">{vintageYearLabel(vintage, kind.key)}</a>
                {#if vintage.organic}<span class="ui-chip organic">Bio</span>{/if}
                {#if isDiscontinued(vintage)}<StockBadge kind="gone" />{/if}
              </span>
            </td>
            <td>{vintage.production_year}</td>
            {#if kind.hasAbv}<td class="num">{vintage.abv != null ? `${vintage.abv} %` : "—"}</td>{/if}
            <td class="num">{formatEUR(vintage.purchase_price)}</td>
            <td class="num">{formatEUR(vintage.price)}</td>
            <td class="col-actions"><RowMenu items={rowItems(vintage)} label="Actions pour {vintageYearLabel(vintage, kind.key)}" /></td>
          </tr>
        {/each}
      </tbody>
    </DataTable>
  {/if}
</ManagePageShell>

<!-- Modal de création / édition -->
<Modal open={formOpen} title="{editingVintage ? kind.editBatch : kind.newBatch} - {wineTitle(wine)}" onclose={closeForm}>
  {#if error}<div class="error-message" role="alert">{error}</div>{/if}
  <form id="vintage-form" class="ui-grid-2" onsubmit={preventDefault(submitForm)}>
    {#if !editingVintage && vintages.length}
      <fieldset class="reuse wide">
        <legend class="t-label">Reprendre les données de</legend>
        <Select ariaLabel="{kind.batch} repris" value={sourceId} onchange={(e) => pickSource((e.currentTarget as HTMLSelectElement).value)}>
          <option value="">Ne rien reprendre</option>
          {#each vintages as v (v.id)}
            <option value={v.id}>{vintageYearLabel(v, kind.key)}</option>
          {/each}
        </Select>
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
                    onchange={(e) => (vintageFormData.image_url = e.currentTarget.checked ? source?.image_url ?? "" : "")}
                  />
                  Image
                  {#if !source.image_url}<span class="t-muted">aucune</span>{/if}
                </label>
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    checked={takeGrapes}
                    disabled={noGrapes}
                    onchange={(e) => (copyGrapes = e.currentTarget.checked)}
                  />
                  {kind.ingredients}
                  <span class="t-muted">{sourceInfo ? sourceInfo.grapes || "aucun" : "…"}</span>
                </label>
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    checked={takeNotes}
                    disabled={noNotes}
                    onchange={(e) => (copyNotes = e.currentTarget.checked)}
                  />
                  Notes de dégustation
                  <span class="t-muted">{sourceInfo ? sourceInfo.notes || "aucune" : "…"}</span>
                </label>
              </div>
            </div>
          {/if}
          <p class="t-caption reuse-hint">Les accords mets sont ceux du produit : ils valent déjà pour tous ses {kind.batchPlural.toLowerCase()}.</p>
      </fieldset>
    {/if}

    <Field id="production_year" label="Année de mise en bouteille" required>
      <!-- Focus à l'ouverture ici, pas sur la liste du millésime repris (la saisie de l'année y changerait le choix). -->
      <!-- svelte-ignore a11y_autofocus -->
      <input id="production_year" class="ui-control" type="number" autofocus bind:value={vintageFormData.production_year} min="1900" max="2030" required />
    </Field>

    <Field id="year" label={kind.yearLabel}>
      <input id="year" class="ui-control" type="number" bind:value={vintageFormData.year} min="1900" max="2030" placeholder={kind.yearPlaceholder} />
    </Field>

    <!-- Un lot par contenant : 50 cl et 5 L d'une même huile ont chacun leur prix et leur stock. -->
    <!-- Fixé à la création : changer le contenant d'un lot réécrirait son stock et ses ventes passées. -->
    <Field id="volume_ml" label="Contenant" required>
      <Select id="volume_ml" bind:value={vintageFormData.volume_ml} required disabled={!!editingVintage}>
        {#each editingVintage ? [editingVintage.volume_ml] : kind.volumes as ml (ml)}
          <option value={String(ml)}>{formatVolume(ml)}</option>
        {/each}
      </Select>
    </Field>

    <Field id="purchase_price" label="Prix d’achat (€)">
      <input id="purchase_price" class="ui-control" type="number" step="0.01" min="0" bind:value={vintageFormData.purchase_price} placeholder="Prix unitaire payé au fournisseur" />
    </Field>

    <Field id="price" label="Prix de vente (€)">
      <input id="price" class="ui-control" type="number" step="0.01" min="0" bind:value={vintageFormData.price} placeholder="Prix unitaire de vente" />
    </Field>

    {#if kind.hasAbv}
      <Field id="abv" label="Degré d’alcool (%)">
        <input id="abv" class="ui-control" type="number" step="0.1" min="0" max="20" bind:value={vintageFormData.abv} />
      </Field>
    {/if}

    <!-- Image reprise : on la change en décochant « Image » plus haut. -->
    <Field id="image_url" label="URL de l’image" help={imageReused ? "Décochez « Image » pour en mettre une autre." : ""}>
      {#snippet children({ describedby })}
        <input id="image_url" class="ui-control" type="url" bind:value={vintageFormData.image_url} disabled={imageReused} aria-describedby={describedby} />
      {/snippet}
    </Field>

    <label class="checkbox-label wide">
      <input type="checkbox" bind:checked={vintageFormData.organic} />
      {kind.organicLabel}
    </label>
  </form>
  {#snippet footer()}
      <Button variant="ghost" onclick={closeForm}>Annuler</Button>
      <Button variant="primary" type="submit" form="vintage-form" disabled={saving}>{editingVintage ? "Mettre à jour" : "Créer"}</Button>
  {/snippet}
</Modal>

<!-- Cépages d'un millésime, variétés d'olives d'un lot -->
<Modal open={showGrapesModal} title={kind.ingredients} maxWidth={520} onclose={closeGrapesModal}>
  {#if error}<div class="error-message" role="alert">{error}</div>{/if}
  {#if selectedVintage}<p class="t-muted grapes-intro">{wineTitle(wine)} · {vintageYearLabel(selectedVintage, kind.key)}</p>{/if}
  {#if vintageGrapes.length === 0}
    <EmptyState icon={kindIcons.ingredient} title="{kind.noIngredient} pour {kind.thisBatch}" compact />
  {:else}
    <ul class="grapes">
      {#each vintageGrapes as vintageGrape (vintageGrape.grape_id)}
        <li>
          <span>{vintageGrape.grape.name}{#if vintageGrape.percentage}<span class="t-muted"> · {vintageGrape.percentage} %</span>{/if}</span>
          <IconButton label="Retirer {vintageGrape.grape.name}" onclick={() => (grapeToRemove = vintageGrape)}>
            <IconX size={16} strokeWidth={1.75} />
          </IconButton>
        </li>
      {/each}
    </ul>
  {/if}
  <div class="add-grape">
    <select class="ui-control" bind:value={selectedGrapeId} aria-label="{kind.ingredients} : ajouter">
      <option value="">{kind.chooseIngredient}</option>
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
    <Button onclick={addGrape} disabled={!selectedGrapeId}><IconPlus size={16} strokeWidth={1.75} /> Ajouter</Button>
  </div>
  {#snippet footer()}
      <Button variant="primary" onclick={closeGrapesModal}>Terminé</Button>
  {/snippet}
</Modal>

<ConfirmDialog
  open={!!grapeToRemove}
  title="Retirer de la composition ?"
  message={grapeToRemove ? `« ${grapeToRemove.grape?.name ?? ""} » sera retiré de la composition.` : ""}
  confirmLabel="Oui, retirer"
  action={() => removeGrape(grapeToRemove.grape_id)}
  oncancel={() => (grapeToRemove = null)}
  ondone={() => (grapeToRemove = null)}
/>

<ConfirmDialog
  open={!!deleteTarget}
  title="Supprimer {kind.thisBatch} ?"
  message={deleteTarget ? `${kind.batch} ${vintageYearLabel(deleteTarget, kind.key)} : suppression avec ${kind.ingredients.toLowerCase()} et notes, si aucune vente ni aucun mouvement de stock ne l’utilise.` : ""}
  action={() => deleteVintage(deleteTarget!)}
  oncancel={() => (deleteTarget = null)}
  ondone={() => (deleteTarget = null)}
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
    display: flex;
    flex-direction: column;
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
