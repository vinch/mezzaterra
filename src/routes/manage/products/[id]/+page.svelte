<script lang="ts">
  import { preventDefault } from "$lib/ui/events";

  import { supabase } from "$lib/supabase";
  import { onMount } from "svelte";
  import type { PageData } from "./$types";
  import type { Lot } from "$lib/types";
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
  import ProductBottle from "$lib/components/site/ProductBottle.svelte";
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
    varietiesText,
    isDiscontinued,
    lotNotes,
    lotYearLabel,
    productStyle,
    productTitle,
    productTypeLabel,
  } from "$lib/products";
  import { formatVolume, kindInfo, kindListHref, kindOf } from "$lib/productKinds";

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  let product = data.product;
  /** Vocabulaire du produit : millésime ou lot, cépages ou variétés… */
  const kind = kindInfo(product);
  const kindIcons = KIND_ICONS[kind.key];
  /* Millésimes déjà chargés par +page.ts ; relus seulement après une modification. */
  let lots = $state<Lot[]>(sortLots(product.lot || []));
  let error = $state("");
  /** Modale unique création / édition (`editingLot` les distingue). */
  let formOpen = $state(false);
  let saving = $state(false);
  let editingLot = $state<any>(null);

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
  let lotFormData = $state(emptyForm());

  /*
   * Nouveau millésime d'un vin qui en a déjà : on reprend image, cépages et notes de dégustation
   * d'un millésime existant (le plus récent par défaut). Les accords sont ceux du vin.
   */
  /** Millésime repris ; vide : « Ne rien reprendre ». */
  let sourceId = $state("");
  let copyVarieties = $state(true);
  let copyNotes = $state(true);
  /** Cépages et notes des millésimes, en texte, lus à l'ouverture de la création. */
  let sourceDetails = $state<Record<string, { varieties: string; notes: string }> | null>(null);
  let source = $derived(editingLot ? null : lots.find((v) => v.id === sourceId));
  let sourceInfo = $derived(source && sourceDetails?.[source.id]);
  /* Rien à reprendre : case décochée et grisée (tant que c'est en lecture, on ne sait pas). */
  let noVarieties = $derived(!!sourceInfo && !sourceInfo.varieties);
  let noNotes = $derived(!!sourceInfo && !sourceInfo.notes);
  /* Ce que les cases annoncent est exactement ce qui est copié. */
  let takeVarieties = $derived(copyVarieties && !noVarieties);
  let takeNotes = $derived(copyNotes && !noNotes);
  let imageReused = $derived(!!source?.image_url && lotFormData.image_url === source.image_url);

  // Varieties modal state
  let showVarietiesModal = $state(false);
  let selectedLot = $state<any>(null);
  let lotVarieties = $state<any[]>([]);
  let allVarieties = $state<any[]>([]);
  let selectedVarietyId = $state("");
  let varietyPercentage = $state("");

  onMount(() => {
    /* Lien « Ajouter un millésime » depuis la liste des vins. */
    if (new URLSearchParams(window.location.search).has("nouveau")) openCreateModal();
  });

  function sortLots(list: Lot[]): Lot[] {
    return [...list].sort((a, b) => b.production_year - a.production_year || byVolume(a, b));
  }

  function openCreateModal() {
    editingLot = null;
    copyVarieties = copyNotes = true;
    lotFormData = emptyForm();
    pickSource(lots[0]?.id ?? "");
    formOpen = true;
    if (lots.length) loadSourceDetails();
  }

  /* Une ouverture plus récente relance la lecture : sa réponse fait foi. */
  const detailsLoad = latestOnly((e) => (error = `${kind.varieties} et notes illisibles : ${errorMessage(e)}`));

  async function loadSourceDetails() {
    sourceDetails = null;
    const data = await detailsLoad.run(async () => {
      const res = await supabase
        .from("lot")
        .select("id, lot_variety ( percentage, variety ( name ) ), note ( type, content )")
        .eq("product_id", product.id);
      if (res.error) throw new Error(res.error.message);
      return res.data;
    });
    if (!data) return;
    sourceDetails = Object.fromEntries(
      data.map((v) => [
        v.id,
        { varieties: varietiesText(v.lot_variety, true), notes: lotNotes(v.note, kind.key).map((n) => n.label).join(", ") },
      ]),
    );
  }

  /** Changement de millésime repris (ou aucun) : l'image suit, sauf si on en a mis une autre. */
  function pickSource(id: string) {
    if (imageReused || !lotFormData.image_url) lotFormData.image_url = lots.find((v) => v.id === id)?.image_url ?? "";
    sourceId = id;
  }

  /** Création via la base : le millésime et ses reprises en une transaction, puis la ligne créée. */
  async function createLot(lotData: Record<string, unknown>) {
    const { data: id, error: rpcError } = await supabase.rpc("create_lot", {
      p_lot: { ...lotData, product_id: product.id },
      p_source_id: source?.id,
      p_copy_varieties: takeVarieties,
      p_copy_notes: takeNotes,
    });
    if (rpcError) return { data: null, error: rpcError };
    const read = await supabase.from("lot").select().eq("id", id).single();
    /* Le millésime existe : on ferme le formulaire, un second clic le créerait en double. */
    if (read.error) {
      closeForm();
      error = `Enregistré, mais la liste n’a pas pu être relue : rechargez la page (${read.error.message}).`;
    }
    return read;
  }

  function openEditModal(lot: Lot) {
    editingLot = lot;
    /* `!= null` et non un test de vérité : un prix ou un degré à 0 reste 0 (et non vide, donc null). */
    const text = (v: number | null) => (v != null ? String(v) : "");
    lotFormData = {
      production_year: text(lot.production_year),
      volume_ml: String(lot.volume_ml),
      year: text(lot.year),
      abv: text(lot.abv),
      purchase_price: text(lot.purchase_price),
      price: text(lot.price),
      image_url: lot.image_url || "",
      organic: lot.organic || false,
    };
    formOpen = true;
  }

  function closeForm() {
    formOpen = false;
    editingLot = null;
    error = "";
  }

  /** Création ou modification (selon `editingLot`) du millésime. */
  /** Valeur d'un champ numérique (bind:value donne un nombre, ou "" / null s'il est vide). */
  function num(v: unknown): number | null {
    return v === "" || v == null ? null : Number(v);
  }

  async function submitForm() {
    if (saving) return;
    if (!lotFormData.production_year) {
      error = "L'année de mise en bouteille est obligatoire";
      return;
    }

    const lotData = {
      production_year: Number(lotFormData.production_year),
      year: num(lotFormData.year),
      abv: kind.hasAbv ? num(lotFormData.abv) : null,
      /* Prix d'achat obligatoire en base : vide, on garde l'actuel (ou le défaut à la création). */
      purchase_price: num(lotFormData.purchase_price) ?? undefined,
      price: num(lotFormData.price),
      image_url: lotFormData.image_url || null,
      organic: lotFormData.organic,
      /* Contenant fixé à la création (voir le formulaire). */
      ...(editingLot ? {} : { volume_ml: Number(lotFormData.volume_ml) }),
    };

    /* La ligne enregistrée revient de la base : la liste se met à jour sans tout relire. */
    saving = true;
    const { data: saved, error: saveError } = editingLot
      ? await supabase.from("lot").update(lotData).eq("id", editingLot.id).select().single()
      : await createLot(lotData);
    saving = false;

    if (saveError || !saved) {
      /* Formulaire déjà fermé : createLot a posé son propre message. */
      /* 23505 : index unique produit + année + contenant (un seul « 50 cl 2025 » par produit). */
      if (formOpen) {
        error = saveError?.code === "23505"
          ? `Ce ${kind.lot.toLowerCase()} existe déjà (même année, ou même mise en bouteille sans année, et même contenant). S’il est « plus jamais disponible », remettez-le plutôt au catalogue.`
          : saveError?.message ?? "Introuvable après l’enregistrement";
      }
      return;
    }

    lots = sortLots([...lots.filter((v) => v.id !== saved.id), saved]);
    error = "";
    closeForm();
  }

  let deleteTarget = $state<Lot | null>(null);

  async function deleteLot(lot: Lot) {
    const { error: deleteError } = await supabase.from("lot").delete().eq("id", lot.id);
    if (deleteError) {
      error = deleteError.message;
      return;
    }
    lots = lots.filter((v) => v.id !== lot.id);
    error = "";
  }

  /** « Plus jamais disponible » : masqué du site, exclu du réassort. Réversible. */
  async function toggleDiscontinued(lot: Lot) {
    const { data: saved, error: updateError } = await supabase
      .from("lot")
      .update({ discontinued_at: isDiscontinued(lot) ? null : new Date().toISOString() })
      .eq("id", lot.id)
      .select()
      .single();

    if (updateError) {
      error = updateError.message;
      return;
    }

    lots = lots.map((v) => (v.id === saved.id ? saved : v));
  }

  function rowItems(v: Lot): MenuItem[] {
    const gone = isDiscontinued(v);
    return [
      { label: "Gérer le stock", icon: IconBox, href: `/manage/products/${product.id}/stock/${v.id}` },
      { label: kind.varieties, icon: kindIcons.variety, onSelect: () => openVarietiesModal(v) },
      { label: "Modifier", icon: IconPencil, onSelect: () => openEditModal(v) },
      {
        label: gone ? "Remettre au catalogue" : "Plus jamais disponible",
        icon: gone ? IconArchiveRestore : IconArchive,
        onSelect: () => toggleDiscontinued(v),
      },
      { label: "Supprimer…", icon: IconTrash, danger: true, separator: true, onSelect: () => (deleteTarget = v) },
    ];
  }

  let subtitle = $derived([product.producer?.name, appellationText(product.appellation), productTypeLabel(product.product_type)].filter(Boolean).join(" · "));

  // Varieties modal functions
  async function openVarietiesModal(lot: any) {
    selectedLot = lot;
    /* La liste des cépages n'est lue qu'à la première ouverture. */
    await Promise.all([
      loadLotVarieties(),
      allVarieties.length
        ? null
        : supabase.from("variety").select("*").eq("kind", kind.key).order("name").then(({ data }) => (allVarieties = data || [])),
    ]);
    showVarietiesModal = true;
  }

  async function loadLotVarieties() {
    if (!selectedLot) return;

    const { data } = await supabase
      .from("lot_variety")
      .select(
        `
        variety_id,
        percentage,
        variety (*)
      `
      )
      .eq("lot_id", selectedLot.id);

    lotVarieties = data || [];
  }

  async function addVariety() {
    if (!selectedVarietyId || !selectedLot) return;

    const { error: insertError } = await supabase
      .from("lot_variety")
      .insert({
        lot_id: selectedLot.id,
        variety_id: selectedVarietyId,
        percentage: varietyPercentage ? parseFloat(varietyPercentage) : null,
      });

    if (insertError) {
      error = insertError.message;
      return;
    }

    selectedVarietyId = "";
    varietyPercentage = "";
    await loadLotVarieties();
  }

  /** Année la plus tardive saisissable : un lot de l'an prochain peut déjà être annoncé. */
  const MAX_YEAR = new Date().getFullYear() + 1;

  /** Élément de la composition à retirer, en attente de confirmation. */
  let varietyToRemove = $state<any>(null);

  /** Appelée après confirmation via le ConfirmDialog. */
  async function removeVariety(varietyId: string) {
    if (!selectedLot) return;

    const { error: deleteError } = await supabase
      .from("lot_variety")
      .delete()
      .eq("lot_id", selectedLot.id)
      .eq("variety_id", varietyId);

    if (deleteError) {
      error = deleteError.message;
      return;
    }

    await loadLotVarieties();
  }

  function closeVarietiesModal() {
    showVarietiesModal = false;
    error = "";
    selectedLot = null;
    lotVarieties = [];
    selectedVarietyId = "";
    varietyPercentage = "";
  }

  let linkedVarietyIds = $derived(new Set(lotVarieties.map((vg) => vg.variety_id)));
</script>

<svelte:head>
  <title>{productTitle(product)} - Gestion</title>
</svelte:head>

<ManagePageShell title={productTitle(product)} {subtitle} back={{ href: kindListHref("/manage/products", kindOf(product)), label: "Produits" }}>
  {#snippet actions()}
      <Button variant="primary" onclick={openCreateModal}><IconPlus size={16} strokeWidth={1.75} /> {kind.newLot}</Button>
  {/snippet}

  {#if product.description}
    <p class="product-description">{product.description}</p>
  {/if}

  {#if error && !formOpen && !showVarietiesModal}
    <div class="error-message" role="alert">{error}</div>
  {/if}

  {#if lots.length === 0}
    <EmptyState icon={kindIcons.product} title="{kind.noLot} pour {kind.thisLabel}" text="À ajouter pour vendre, stocker et servir en dégustation.">
      <Button onclick={openCreateModal}><IconPlus size={16} strokeWidth={1.75} /> {kind.newLot}</Button>
    </EmptyState>
  {:else}
    <DataTable caption="{kind.lotPlural} de {productTitle(product)}">
      <thead>
        <tr>
          <th scope="col">{kind.lot}</th>
          <th scope="col">Mise en bouteille</th>
          {#if kind.hasAbv}<th scope="col" class="num">Degré</th>{/if}
          <th scope="col" class="num">Prix d’achat</th>
          <th scope="col" class="num">Prix de vente</th>
          <th scope="col" class="col-actions"><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {#each lots as lot (lot.id)}
          <tr class:gone={isDiscontinued(lot)}>
            <td>
              <span class="lot-cell">
                {#if lot.image_url}<img src={lot.image_url} alt="" class="thumb" />{/if}
                <a class="row-link" href="/manage/products/{product.id}/stock/{lot.id}">{lotYearLabel(lot, kind.key)}</a>
                {#if lot.organic}<span class="ui-chip organic">Bio</span>{/if}
                {#if isDiscontinued(lot)}<StockBadge kind="gone" />{/if}
              </span>
            </td>
            <td>{lot.production_year}</td>
            {#if kind.hasAbv}<td class="num">{lot.abv != null ? `${lot.abv} %` : "—"}</td>{/if}
            <td class="num">{formatEUR(lot.purchase_price)}</td>
            <td class="num">{formatEUR(lot.price)}</td>
            <td class="col-actions"><RowMenu items={rowItems(lot)} label="Actions pour {lotYearLabel(lot, kind.key)}" /></td>
          </tr>
        {/each}
      </tbody>
    </DataTable>
  {/if}
</ManagePageShell>

<!-- Modal de création / édition -->
<Modal open={formOpen} title="{editingLot ? kind.editLot : kind.newLot} - {productTitle(product)}" onclose={closeForm}>
  {#if error}<div class="error-message" role="alert">{error}</div>{/if}
  <form id="lot-form" class="ui-grid-2" onsubmit={preventDefault(submitForm)}>
    {#if !editingLot && lots.length}
      <fieldset class="reuse wide">
        <legend class="t-label">Reprendre les données de</legend>
        <Select ariaLabel="{kind.lot} repris" value={sourceId} onchange={(e) => pickSource((e.currentTarget as HTMLSelectElement).value)}>
          <option value="">Ne rien reprendre</option>
          {#each lots as v (v.id)}
            <option value={v.id}>{lotYearLabel(v, kind.key)}</option>
          {/each}
        </Select>
          {#if source}
            <div class="reuse-items">
              <!-- Aperçu de la bouteille à côté des cases (silhouette du site sans image) : lignes de même hauteur. -->
              <div class="reuse-preview" class:off={!imageReused} aria-hidden="true">
                <ProductBottle src={source.image_url} style={productStyle(product.product_type)} height="80px" />
              </div>
              <div class="reuse-checks">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    checked={imageReused}
                    disabled={!source.image_url}
                    onchange={(e) => (lotFormData.image_url = e.currentTarget.checked ? source?.image_url ?? "" : "")}
                  />
                  Image
                  {#if !source.image_url}<span class="t-muted">aucune</span>{/if}
                </label>
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    checked={takeVarieties}
                    disabled={noVarieties}
                    onchange={(e) => (copyVarieties = e.currentTarget.checked)}
                  />
                  {kind.varieties}
                  <span class="t-muted">{sourceInfo ? sourceInfo.varieties || "aucun" : "…"}</span>
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
          <p class="t-caption reuse-hint">Les accords mets sont ceux du produit : ils valent déjà pour tous ses {kind.lotPlural.toLowerCase()}.</p>
      </fieldset>
    {/if}

    <Field id="production_year" label="Année de mise en bouteille" required>
      <!-- Focus à l'ouverture ici, pas sur la liste du millésime repris (la saisie de l'année y changerait le choix). -->
      <!-- svelte-ignore a11y_autofocus -->
      <input id="production_year" class="ui-control" type="number" autofocus bind:value={lotFormData.production_year} min="1900" max={MAX_YEAR} required />
    </Field>

    <Field id="year" label={kind.yearLabel}>
      <input id="year" class="ui-control" type="number" bind:value={lotFormData.year} min="1900" max={MAX_YEAR} placeholder={kind.yearPlaceholder} />
    </Field>

    <!-- Un lot par contenant : 50 cl et 5 L d'une même huile ont chacun leur prix et leur stock. -->
    <!-- Fixé à la création : changer le contenant d'un lot réécrirait son stock et ses ventes passées. -->
    <Field id="volume_ml" label="Contenant" required>
      <Select id="volume_ml" bind:value={lotFormData.volume_ml} required disabled={!!editingLot}>
        {#each editingLot ? [editingLot.volume_ml] : kind.volumes as ml (ml)}
          <option value={String(ml)}>{formatVolume(ml)}</option>
        {/each}
      </Select>
    </Field>

    <Field id="purchase_price" label="Prix d’achat (€)">
      <input id="purchase_price" class="ui-control" type="number" step="0.01" min="0" bind:value={lotFormData.purchase_price} placeholder="Prix unitaire payé au fournisseur" />
    </Field>

    <Field id="price" label="Prix de vente (€)">
      <input id="price" class="ui-control" type="number" step="0.01" min="0" bind:value={lotFormData.price} placeholder="Prix unitaire de vente" />
    </Field>

    {#if kind.hasAbv}
      <Field id="abv" label="Degré d’alcool (%)">
        <input id="abv" class="ui-control" type="number" step="0.1" min="0" max="20" bind:value={lotFormData.abv} />
      </Field>
    {/if}

    <!-- Image reprise : on la change en décochant « Image » plus haut. -->
    <Field id="image_url" label="URL de l’image" help={imageReused ? "Décochez « Image » pour en mettre une autre." : ""}>
      {#snippet children({ describedby })}
        <input id="image_url" class="ui-control" type="url" bind:value={lotFormData.image_url} disabled={imageReused} aria-describedby={describedby} />
      {/snippet}
    </Field>

    <label class="checkbox-label wide">
      <input type="checkbox" bind:checked={lotFormData.organic} />
      {kind.organicLabel}
    </label>
  </form>
  {#snippet footer()}
      <Button variant="ghost" onclick={closeForm}>Annuler</Button>
      <Button variant="primary" type="submit" form="lot-form" disabled={saving}>{editingLot ? "Mettre à jour" : "Créer"}</Button>
  {/snippet}
</Modal>

<!-- Cépages d'un millésime, variétés d'olives d'un lot -->
<Modal open={showVarietiesModal} title={kind.varieties} maxWidth={520} onclose={closeVarietiesModal}>
  {#if error}<div class="error-message" role="alert">{error}</div>{/if}
  {#if selectedLot}<p class="t-muted varieties-intro">{productTitle(product)} · {lotYearLabel(selectedLot, kind.key)}</p>{/if}
  {#if lotVarieties.length === 0}
    <EmptyState icon={kindIcons.variety} title="{kind.noVariety} pour {kind.thisLot}" compact />
  {:else}
    <ul class="varieties">
      {#each lotVarieties as lotVariety (lotVariety.variety_id)}
        <li>
          <span>{lotVariety.variety.name}{#if lotVariety.percentage}<span class="t-muted"> · {lotVariety.percentage} %</span>{/if}</span>
          <IconButton label="Retirer {lotVariety.variety.name}" onclick={() => (varietyToRemove = lotVariety)}>
            <IconX size={16} strokeWidth={1.75} />
          </IconButton>
        </li>
      {/each}
    </ul>
  {/if}
  <div class="add-variety">
    <select class="ui-control" bind:value={selectedVarietyId} aria-label="{kind.varieties} : ajouter">
      <option value="">{kind.chooseVariety}</option>
      {#each allVarieties as variety (variety.id)}
        <option value={variety.id} disabled={linkedVarietyIds.has(variety.id)}>
          {variety.name}{linkedVarietyIds.has(variety.id) ? " (déjà ajouté)" : ""}
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
      bind:value={varietyPercentage}
      disabled={!selectedVarietyId}
    />
    <Button onclick={addVariety} disabled={!selectedVarietyId}><IconPlus size={16} strokeWidth={1.75} /> Ajouter</Button>
  </div>
  {#snippet footer()}
      <Button variant="primary" onclick={closeVarietiesModal}>Terminé</Button>
  {/snippet}
</Modal>

<ConfirmDialog
  open={!!varietyToRemove}
  title="Retirer de la composition ?"
  message={varietyToRemove ? `« ${varietyToRemove.variety?.name ?? ""} » sera retiré de la composition.` : ""}
  confirmLabel="Oui, retirer"
  action={() => removeVariety(varietyToRemove.variety_id)}
  oncancel={() => (varietyToRemove = null)}
  ondone={() => (varietyToRemove = null)}
/>

<ConfirmDialog
  open={!!deleteTarget}
  title="Supprimer {kind.thisLot} ?"
  message={deleteTarget ? `${kind.lot} ${lotYearLabel(deleteTarget, kind.key)} : suppression avec ${kind.varieties.toLowerCase()} et notes, si aucune vente ni aucun mouvement de stock ne l’utilise.` : ""}
  action={() => deleteLot(deleteTarget!)}
  oncancel={() => (deleteTarget = null)}
  ondone={() => (deleteTarget = null)}
/>

<style>
  .product-description {
    max-width: 72ch;
    margin: 0 0 20px;
    color: var(--ink-2);
    line-height: 1.6;
  }

  /* Millésime retiré : ligne en retrait, actions toujours utilisables. */
  tr.gone td:not(.col-actions) {
    opacity: 0.55;
  }

  .lot-cell {
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

  .varieties-intro {
    margin: 0 0 12px;
  }

  .varieties {
    margin: 0 0 16px;
    padding: 0;
    list-style: none;
  }

  .varieties li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 4px 4px 14px;
    border-bottom: 1px solid var(--border-soft);
  }

  .varieties li:last-child {
    border-bottom: none;
  }

  .add-variety {
    display: flex;
    gap: 8px;
  }

  .add-variety select {
    flex: 1;
  }

  .add-variety .percent {
    width: 84px;
  }
</style>
