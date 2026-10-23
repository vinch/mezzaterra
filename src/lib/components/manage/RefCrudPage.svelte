<script lang="ts" context="module">
  export type RefOption = { value: string; label: string };

  /** Champ du formulaire. Les valeurs vides des champs facultatifs sont enregistrées à `null`. */
  export type RefField = {
    key: string;
    label: string;
    type?: "text" | "textarea" | "email" | "tel" | "url" | "number" | "select";
    required?: boolean;
    /** Options d'un `select` (souvent issues d'un autre référentiel, donc réactives). */
    options?: RefOption[];
    /** Libellé de l'option vide d'un `select`. */
    emptyOption?: string;
    /** Occupe toute la largeur (sinon deux champs par ligne). */
    full?: boolean;
    placeholder?: string;
    help?: string;
    step?: string;
  };

  /** Colonne du tableau. */
  export type RefColumn = {
    label: string;
    value: (row: any) => string | null | undefined;
    /** Lien externe ouvert dans un nouvel onglet. */
    href?: (row: any) => string | null | undefined;
    strong?: boolean;
    /** Coupe le texte au-delà de N caractères (texte complet en infobulle). */
    truncate?: number;
  };
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import { supabase } from "$lib/supabase";
  import ManagePageShell from "./ManagePageShell.svelte";
  import Modal from "$lib/ui/Modal.svelte";
  import Button from "$lib/ui/Button.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import DataTable from "$lib/ui/DataTable.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import Field from "$lib/ui/Field.svelte";
  import RowMenu from "$lib/ui/RowMenu.svelte";
  import type { MenuItem } from "$lib/ui/Menu.svelte";
  import { IconPencil, IconPlus, IconTrash } from "$lib/ui/icons";

  /**
   * Page de référentiel (pays, régions, cépages, fournisseurs…) : liste, création, édition et
   * suppression d'une table Supabase, décrites par des colonnes et des champs.
   */
  export let title: string;
  export let table: string;
  /** Sélection PostgREST (jointures pour l'affichage). */
  export let select = "*";
  export let orderBy = "name";
  /** « Nouveau cépage », « Nouvelle région »… */
  export let newLabel: string;
  /** Titre de la modale d'édition : « Modifier le cépage ». */
  export let editLabel: string;
  /** Pour « Aucun … enregistré » et la confirmation de suppression : « ce cépage », « cette région ». */
  export let thisLabel: string;
  export let emptyText: string;
  export let fields: RefField[];
  export let columns: RefColumn[];
  /** Nom affiché d'une ligne (menu d'actions, confirmation). */
  export let rowLabel: (row: any) => string = (row) => row.name;

  let rows: any[] = [];
  let loading = true;
  let error = "";
  let formOpen = false;
  let editing: any = null;
  let form: Record<string, string> = {};
  let saving = false;
  let deleteTarget: any = null;
  let confirmOpen = false;
  let deleting = false;

  onMount(load);

  async function load() {
    const { data, error: fetchError } = await (supabase.from(table as any) as any).select(select).order(orderBy);
    if (fetchError) error = fetchError.message;
    else rows = data || [];
    loading = false;
  }

  function openForm(row: any = null) {
    editing = row;
    form = Object.fromEntries(fields.map((f) => [f.key, row?.[f.key] != null ? String(row[f.key]) : ""]));
    error = "";
    formOpen = true;
  }

  function closeForm() {
    formOpen = false;
    editing = null;
  }

  function toPayload(): Record<string, unknown> {
    return Object.fromEntries(
      fields.map((f) => {
        const raw = (form[f.key] ?? "").trim();
        if (f.type === "number") {
          const n = parseFloat(raw.replace(",", "."));
          return [f.key, Number.isFinite(n) ? n : null];
        }
        return [f.key, raw || (f.required ? raw : null)];
      }),
    );
  }

  async function submit() {
    if (saving) return;
    const missing = fields.find((f) => f.required && !(form[f.key] ?? "").trim());
    if (missing) {
      error = `« ${missing.label} » est obligatoire.`;
      return;
    }
    saving = true;
    const query = supabase.from(table as any) as any;
    const { error: saveError } = editing
      ? await query.update(toPayload()).eq("id", editing.id)
      : await query.insert(toPayload());
    saving = false;
    if (saveError) {
      error = saveError.message;
      return;
    }
    error = "";
    closeForm();
    await load();
  }

  function askDelete(row: any) {
    deleteTarget = row;
    confirmOpen = true;
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    deleting = true;
    const { error: deleteError } = await (supabase.from(table as any) as any).delete().eq("id", deleteTarget.id);
    deleting = false;
    confirmOpen = false;
    if (deleteError) {
      /* Le plus souvent : la ligne est encore utilisée ailleurs (clé étrangère). */
      error = deleteError.message;
      return;
    }
    error = "";
    await load();
  }

  function rowItems(row: any): MenuItem[] {
    return [
      { label: "Modifier", icon: IconPencil, onSelect: () => openForm(row) },
      { label: "Supprimer…", icon: IconTrash, danger: true, separator: true, onSelect: () => askDelete(row) },
    ];
  }

  function cell(col: RefColumn, row: any): string {
    const v = col.value(row);
    if (!v) return "—";
    return col.truncate && v.length > col.truncate ? `${v.slice(0, col.truncate)}…` : v;
  }
</script>

<ManagePageShell {title}>
  <svelte:fragment slot="actions">
    <Button variant="primary" on:click={() => openForm()}><IconPlus size={16} strokeWidth={1.75} /> {newLabel}</Button>
  </svelte:fragment>

  {#if error && !formOpen}
    <div class="error-message" role="alert">{error}</div>
  {/if}

  {#if loading}
    <div class="loading">Chargement…</div>
  {:else if rows.length === 0}
    <EmptyState title="Aucun élément pour l’instant" text={emptyText}>
      <Button on:click={() => openForm()}><IconPlus size={16} strokeWidth={1.75} /> {newLabel}</Button>
    </EmptyState>
  {:else}
    <DataTable caption={title}>
      <thead>
        <tr>
          {#each columns as col}
            <th scope="col">{col.label}</th>
          {/each}
          <th scope="col" class="col-actions"><span class="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row (row.id)}
          <tr>
            {#each columns as col}
              {@const href = col.href?.(row)}
              <td title={col.truncate ? col.value(row) ?? "" : undefined}>
                {#if href}
                  <a {href} target="_blank" rel="noopener noreferrer">{cell(col, row)}</a>
                {:else if col.strong}
                  <strong>{cell(col, row)}</strong>
                {:else}
                  {cell(col, row)}
                {/if}
              </td>
            {/each}
            <td class="col-actions"><RowMenu items={rowItems(row)} label="Actions pour {rowLabel(row)}" /></td>
          </tr>
        {/each}
      </tbody>
    </DataTable>
  {/if}
</ManagePageShell>

<Modal open={formOpen} title={editing ? editLabel : newLabel} maxWidth={640} on:close={closeForm}>
  {#if error}
    <div class="error-message" role="alert">{error}</div>
  {/if}
  <form class="ref-form" on:submit|preventDefault={submit}>
    {#each fields as f (f.key)}
      {@const id = `${table}-${f.key}`}
      <div class:full={f.full || f.type === "textarea"}>
        <Field {id} label={f.label} required={f.required} help={f.help ?? ""}>
          {#if f.type === "select"}
            <select {id} class="ui-control" bind:value={form[f.key]} required={f.required}>
              <option value="">{f.emptyOption ?? "Aucun"}</option>
              {#each f.options ?? [] as o (o.value)}
                <option value={o.value}>{o.label}</option>
              {/each}
            </select>
          {:else if f.type === "textarea"}
            <textarea {id} class="ui-control" rows="3" bind:value={form[f.key]} placeholder={f.placeholder ?? ""}></textarea>
          {:else}
            <input
              {id}
              class="ui-control"
              type={f.type === "number" ? "text" : f.type ?? "text"}
              inputmode={f.type === "number" ? "decimal" : undefined}
              bind:value={form[f.key]}
              required={f.required}
              placeholder={f.placeholder ?? ""}
            />
          {/if}
        </Field>
      </div>
    {/each}
  </form>
  <svelte:fragment slot="footer">
    <Button variant="ghost" on:click={closeForm}>Annuler</Button>
    <Button variant="primary" disabled={saving} on:click={submit}>{editing ? "Enregistrer" : "Créer"}</Button>
  </svelte:fragment>
</Modal>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Supprimer {thisLabel} ?"
  message={deleteTarget ? `« ${rowLabel(deleteTarget)} » sera définitivement supprimé. Impossible s’il est encore utilisé ailleurs.` : ""}
  busy={deleting}
  on:confirm={confirmDelete}
/>

<style>
  .ref-form {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .ref-form .full {
    grid-column: 1 / -1;
  }

  @media (max-width: 767px) {
    .ref-form {
      grid-template-columns: 1fr;
    }
  }
</style>
