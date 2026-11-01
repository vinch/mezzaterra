<script lang="ts">
  import { preventDefault } from "$lib/ui/events";
  import { supabase } from "$lib/supabase";
  import { lotStock } from "$lib/manageData";
  import type { PageData } from "./$types";
  import { isoDateOnly, todayIso } from "$lib/dates";
  import { formatDate } from "$lib/format";
  import type { StockMove } from "$lib/types";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import Modal from "$lib/ui/Modal.svelte";
  import Button from "$lib/ui/Button.svelte";
  import Field from "$lib/ui/Field.svelte";
  import Select from "$lib/ui/Select.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import DataTable from "$lib/ui/DataTable.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import StockBadge from "$lib/ui/StockBadge.svelte";
  import RowMenu from "$lib/ui/RowMenu.svelte";
  import type { MenuItem } from "$lib/ui/Menu.svelte";
  import { IconBox, IconPencil, IconPlus, IconTrash } from "$lib/ui/icons";
  import Spinner from "$lib/ui/Spinner.svelte";
  import { lotYearLabel, productTitle } from "$lib/products";

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  let lot = data.lot;
  let stockMoves = $state(data.stockMoves);
  let currentStock = $state(data.currentStock);
  let loading = $state(false);
  let error = $state("");
  /** Modale unique création / édition (`editingMove` les distingue). */
  let formOpen = $state(false);
  let saving = $state(false);
  let editingMove = $state<any>(null);

  function emptyForm() {
    return { reason: "", quantity: "", date: todayIso(), note: "" };
  }
  let formData = $state(emptyForm());

  // Raisons de mouvement de stock (triées par ordre alphabétique)
  const stockReasons = [
    { value: "purchase_in", label: "Achat", type: "in" },
    { value: "breakage_out", label: "Casse", type: "out" },
    { value: "gift_out", label: "Cadeau", type: "out" },
    { value: "tasting_out", label: "Dégustation", type: "out" },
    { value: "test_out", label: "Test interne", type: "out" },
    { value: "sale_out", label: "Vente payée", type: "out" },
  ];

  /** Relit mouvements et stock après une modification (le premier chargement vient de +page.ts). */
  async function loadStockMoves() {
    loading = true;
    const [{ data: movesData, error: fetchError }, stock] = await Promise.all([
      supabase
        .from("stock_move")
        .select("*")
        .eq("lot_id", lot.id)
        .order("date", { ascending: false }),
      lotStock(lot.id),
    ]);

    if (fetchError) {
      error = fetchError.message;
    } else {
      stockMoves = movesData || [];
    }

    currentStock = stock;

    loading = false;
  }

  function openCreateModal() {
    editingMove = null;
    formData = emptyForm();
    formOpen = true;
  }

  function openEditModal(move: StockMove) {
    editingMove = move;
    formData = {
      reason: move.reason,
      quantity: normalizeQuantityForDisplay(move.quantity, move.reason),
      date: isoDateOnly(move.date),
      note: move.note || "",
    };
    formOpen = true;
  }

  function closeForm() {
    formOpen = false;
    editingMove = null;
    error = "";
  }

  /** Création ou modification (selon `editingMove`) du mouvement. */
  async function submitForm() {
    if (saving) return;
    if (!formData.reason || !formData.quantity || !formData.date) {
      error = "Raison, quantité et date sont obligatoires";
      return;
    }

    // Garde-fou pour les quantités
    let quantity = parseInt(formData.quantity);
    const reasonObj = stockReasons.find((r) => r.value === formData.reason);

    if (reasonObj) {
      if (reasonObj.type === "in" && quantity < 0) {
        // Pour les achats, enlever le signe négatif
        quantity = Math.abs(quantity);
      } else if (reasonObj.type === "out" && quantity > 0) {
        // Pour les sorties, ajouter le signe négatif
        quantity = -Math.abs(quantity);
      }
    }

    const moveData = {
      reason: formData.reason,
      quantity: quantity,
      date: formData.date,
      note: formData.note || null,
    };

    saving = true;
    const { error: saveError } = editingMove
      ? await supabase.from("stock_move").update(moveData).eq("id", editingMove.id)
      : await supabase.from("stock_move").insert({ ...moveData, lot_id: lot.id });
    saving = false;

    if (saveError) {
      error = saveError.message;
      return;
    }

    closeForm();
    await loadStockMoves();
  }

  let deleteTarget = $state<StockMove | null>(null);

  async function deleteMove(move: StockMove) {
    const { error: deleteError } = await supabase.from("stock_move").delete().eq("id", move.id);
    if (deleteError) {
      error = deleteError.message;
      return;
    }
    error = "";
    await loadStockMoves();
  }

  function rowItems(move: StockMove): MenuItem[] {
    return [
      { label: "Modifier", icon: IconPencil, onSelect: () => openEditModal(move) },
      { label: "Supprimer…", icon: IconTrash, danger: true, separator: true, onSelect: () => (deleteTarget = move) },
    ];
  }

  let title = $derived(`${productTitle(lot.product)} ${lotYearLabel(lot)}`);
  let subtitle = $derived(
    currentStock == null
      ? "Stock indisponible"
      : `${currentStock} bouteille${Math.abs(currentStock) > 1 ? "s" : ""} en stock`,
  );

  function getReasonLabel(reason: string) {
    const reasonObj = stockReasons.find((r) => r.value === reason);
    return reasonObj ? reasonObj.label : reason;
  }

  function getReasonType(reason: string) {
    const reasonObj = stockReasons.find((r) => r.value === reason);
    return reasonObj ? reasonObj.type : "out";
  }

  function normalizeQuantityForDisplay(quantity: number, reason: string) {
    const reasonObj = stockReasons.find((r) => r.value === reason);
    if (reasonObj) {
      if (reasonObj.type === "out") {
        // Pour les sorties, afficher la valeur absolue
        return Math.abs(quantity).toString();
      }
    }
    return quantity.toString();
  }
</script>

<svelte:head>
  <title>Stock - {title}</title>
</svelte:head>

<ManagePageShell {title} {subtitle} back={{ href: `/manage/products/${lot.product.id}`, label: productTitle(lot.product) }}>
  {#snippet badge()}
      {#if currentStock != null && currentStock < 0}<StockBadge kind="out" label="Stock négatif" />{/if}
  {/snippet}
  {#snippet actions()}
      <Button variant="primary" onclick={openCreateModal}><IconPlus size={16} strokeWidth={1.75} /> Nouveau mouvement</Button>
  {/snippet}

  {#if error && !formOpen}
    <div class="error-message" role="alert">{error}</div>
  {/if}

  {#if loading}
    <Spinner />
  {:else if stockMoves.length === 0}
    <EmptyState icon={IconBox} title="Aucun mouvement de stock" text="Les réceptions de transport et les ventes payées ou livrées s’inscrivent ici automatiquement.">
      <Button onclick={openCreateModal}><IconPlus size={16} strokeWidth={1.75} /> Nouveau mouvement</Button>
    </EmptyState>
  {:else}
    <DataTable caption="Mouvements de stock">
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th scope="col">Raison</th>
          <th scope="col" class="num">Quantité</th>
          <th scope="col">Note</th>
          <th scope="col" class="col-actions"><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {#each stockMoves as move (move.id)}
          {@const type = getReasonType(move.reason)}
          <tr>
            <td>{formatDate(move.date)}</td>
            <td>{getReasonLabel(move.reason)}</td>
            <td class="num"><strong class="quantity {type}">{type === "in" ? "+" : "−"}{Math.abs(move.quantity)}</strong></td>
            <td>{move.note || "—"}</td>
            <td class="col-actions"><RowMenu items={rowItems(move)} label="Actions pour le mouvement du {formatDate(move.date)}" /></td>
          </tr>
        {/each}
      </tbody>
    </DataTable>
  {/if}
</ManagePageShell>

<!-- Modal de création / édition -->
<Modal open={formOpen} title={editingMove ? "Modifier le mouvement de stock" : "Nouveau mouvement de stock"} onclose={closeForm}>
  {#if error}<div class="error-message" role="alert">{error}</div>{/if}
  <form id="move-form" class="ui-grid-2" onsubmit={preventDefault(submitForm)}>
    <Field id="reason" label="Raison" required>
      <Select id="reason" bind:value={formData.reason} required>
        <option value="">Sélectionner une raison</option>
        {#each stockReasons as reason}
          <option value={reason.value}>{reason.label}</option>
        {/each}
      </Select>
    </Field>

    <Field id="quantity" label="Quantité" required>
      <input id="quantity" class="ui-control" type="number" min="1" placeholder="Entrez un nombre" bind:value={formData.quantity} required />
    </Field>

    <Field id="date" label="Date" required>
      <input id="date" class="ui-control" type="date" bind:value={formData.date} required />
    </Field>

    <div class="wide">
      <Field id="note" label="Note">
        <textarea id="note" class="ui-control" rows="3" placeholder="Commentaires sur ce mouvement…" bind:value={formData.note}></textarea>
      </Field>
    </div>
  </form>
  {#snippet footer()}
      <Button variant="ghost" onclick={closeForm}>Annuler</Button>
      <Button variant="primary" type="submit" form="move-form" disabled={saving}>{editingMove ? "Mettre à jour" : "Créer le mouvement"}</Button>
  {/snippet}
</Modal>

<ConfirmDialog
  open={!!deleteTarget}
  title="Supprimer ce mouvement ?"
  message={deleteTarget ? `Le mouvement du ${formatDate(deleteTarget.date)} (${getReasonLabel(deleteTarget.reason)}, ${Math.abs(deleteTarget.quantity)} bt.) sera supprimé et le stock recalculé.` : ""}
  action={() => deleteMove(deleteTarget!)}
  oncancel={() => (deleteTarget = null)}
  ondone={() => (deleteTarget = null)}
/>

<style>
  .quantity.in {
    color: var(--st-paid-fg);
  }

  .quantity.out {
    color: var(--danger);
  }
</style>
