<script lang="ts">
  import { onMount } from "svelte";
  import { supabase } from "$lib/supabase";
  import ManagePageShell from "./ManagePageShell.svelte";
  import type { RefColumn, RefField } from "./refCrud";
  import Modal from "$lib/ui/Modal.svelte";
  import Button from "$lib/ui/Button.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import DataTable from "$lib/ui/DataTable.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import Field from "$lib/ui/Field.svelte";
  import RowMenu from "$lib/ui/RowMenu.svelte";
  import Select from "$lib/ui/Select.svelte";
  import type { MenuItem } from "$lib/ui/Menu.svelte";
  import { IconEye, IconPencil, IconPlus, IconTrash } from "$lib/ui/icons";

  /**
   * Page de référentiel (pays, régions, cépages, clients, fournisseurs…) : liste, création, édition et
   * suppression d'une table Supabase, décrites par des colonnes et des champs (refCrud.ts).
   */
  export let title: string;
  export let table: string;
  /** Sélection PostgREST (jointures pour l'affichage). */
  export let select = "*";
  /** Colonne de tri (côté client) ; `sortRows` la remplace quand le tri dépend de plusieurs colonnes. */
  export let orderBy = "name";
  export let sortRows: ((rows: any[]) => any[]) | null = null;
  /** « Nouveau cépage », « Nouvelle région »… */
  export let newLabel: string;
  /** Titre de la modale d'édition : « Modifier le cépage ». */
  export let editLabel: string;
  /** Pour la confirmation de suppression : « ce cépage », « cette région ». */
  export let thisLabel: string;
  /** Conséquences particulières d'une suppression (données liées supprimées avec la ligne…). */
  export let deleteNote = "";
  export let emptyText: string;
  export let fields: RefField[];
  export let columns: RefColumn[];
  /** Nom affiché d'une ligne (menu d'actions, confirmation). */
  export let rowLabel: (row: any) => string = (row) => row.name;
  /** Fiche détaillée : la première colonne devient un lien et le menu propose « Ouvrir la fiche ». */
  export let rowHref: ((row: any) => string) | null = null;
  /** Ouvre directement l'édition de cette ligne après le chargement (lien « Modifier » d'une autre page). */
  export let editId: string | null = null;

  let rows: any[] = [];
  let loading = true;
  let error = "";
  let formOpen = false;
  let editing: any = null;
  let form: Record<string, string> = {};
  let saving = false;
  let deleteTarget: any = null;

  const formId = `ref-form-${table}`;
  const query = () => supabase.from(table as any) as any;
  const NUMBER = /^-?\d+([.,]\d+)?$/;

  onMount(async () => {
    const { data, error: fetchError } = await query().select(select);
    if (fetchError) error = fetchError.message;
    /* Une ligne créée pendant le chargement est gardée. */
    else rows = sorted([...(data || []).filter((d: any) => !rows.some((r) => r.id === d.id)), ...rows]);
    loading = false;
    const toEdit = editId ? rows.find((r) => r.id === editId) : null;
    if (toEdit) openForm(toEdit);
  });

  function sorted(list: any[]): any[] {
    if (sortRows) return sortRows(list);
    return [...list].sort((a, b) => String(a[orderBy] ?? "").localeCompare(String(b[orderBy] ?? ""), "fr"));
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
    error = "";
  }

  function toPayload(): Record<string, unknown> {
    return Object.fromEntries(
      fields.map((f) => {
        const raw = (form[f.key] ?? "").trim();
        if (f.type === "number") return [f.key, raw ? Number(raw.replace(",", ".")) : null];
        return [f.key, raw || null];
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
    const notNumber = fields.find(
      (f) => f.type === "number" && (form[f.key] ?? "").trim() && !NUMBER.test(form[f.key].trim()),
    );
    if (notNumber) {
      error = `« ${notNumber.label} » doit être un nombre (ex. 42.35).`;
      return;
    }
    const target = editing;
    saving = true;
    /* La ligne enregistrée revient avec ses jointures : la liste se met à jour sans tout relire. */
    const { data: saved, error: saveError } = editing
      ? await query().update(toPayload()).eq("id", editing.id).select(select).single()
      : await query().insert(toPayload()).select(select).single();
    saving = false;
    if (saveError) {
      error = saveError.message;
      return;
    }
    rows = sorted([...rows.filter((r) => r.id !== saved.id), saved]);
    /* Ne ferme que le formulaire de cet enregistrement (l'utilisateur a pu en ouvrir un autre). */
    if (formOpen && editing === target) closeForm();
  }

  async function remove(row: any) {
    const { error: deleteError } = await query().delete().eq("id", row.id);
    /* Le plus souvent : la ligne est encore utilisée ailleurs (clé étrangère). */
    if (deleteError) {
      error = deleteError.message;
      return;
    }
    rows = rows.filter((r) => r.id !== row.id);
    error = "";
  }

  function rowItems(row: any): MenuItem[] {
    return [
      ...(rowHref ? [{ label: "Ouvrir la fiche", icon: IconEye, href: rowHref(row) }] : []),
      { label: "Modifier", icon: IconPencil, onSelect: () => openForm(row) },
      { label: "Supprimer…", icon: IconTrash, danger: true, separator: true, onSelect: () => (deleteTarget = row) },
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
            {#each columns as col, i}
              {@const text = cell(col, row)}
              {@const href = col.href?.(row)}
              <td title={col.truncate ? col.value(row) ?? "" : undefined}>
                {#if i === 0 && rowHref}
                  <a class="row-link" href={rowHref(row)}>{text}</a>
                {:else if i === 0}
                  <strong>{text}</strong>
                {:else if href}
                  <a {href} target="_blank" rel="noopener noreferrer">{text}</a>
                {:else}
                  {text}
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

<Modal open={formOpen} title={editing ? editLabel : newLabel} on:close={closeForm}>
  {#if error}
    <div class="error-message" role="alert">{error}</div>
  {/if}
  <form id={formId} class="form-grid" on:submit|preventDefault={submit}>
    {#each fields as f (f.key)}
      {@const id = `${table}-${f.key}`}
      <div class="form-group" class:full-width={f.full || f.type === "textarea"}>
        <Field {id} label={f.label} required={f.required} help={f.help ?? ""} let:describedby>
          {#if f.type === "select"}
            <Select {id} bind:value={form[f.key]} required={f.required} {describedby}>
              <option value="">Aucun</option>
              {#each f.options ?? [] as o (o.value)}
                <option value={o.value}>{o.label}</option>
              {/each}
            </Select>
          {:else if f.type === "textarea"}
            <textarea {id} class="ui-control" rows="3" bind:value={form[f.key]} placeholder={f.placeholder ?? ""} aria-describedby={describedby}></textarea>
          {:else}
            <input
              {id}
              class="ui-control"
              type={f.type === "number" ? "text" : f.type ?? "text"}
              inputmode={f.type === "number" ? "decimal" : undefined}
              bind:value={form[f.key]}
              required={f.required}
              placeholder={f.placeholder ?? ""}
              maxlength={f.maxlength}
              aria-describedby={describedby}
            />
          {/if}
        </Field>
      </div>
    {/each}
  </form>
  <svelte:fragment slot="footer">
    <Button variant="ghost" on:click={closeForm}>Annuler</Button>
    <Button variant="primary" type="submit" form={formId} disabled={saving}>{editing ? "Enregistrer" : "Créer"}</Button>
  </svelte:fragment>
</Modal>

<ConfirmDialog
  open={!!deleteTarget}
  title="Supprimer {thisLabel} ?"
  message={deleteTarget ? `« ${rowLabel(deleteTarget)} » sera définitivement supprimé. ${deleteNote}` : ""}
  onConfirm={() => remove(deleteTarget)}
  on:cancel={() => (deleteTarget = null)}
  on:done={() => (deleteTarget = null)}
/>
