<script lang="ts">
  import { preventDefault } from "$lib/ui/events";
  import { onMount } from "svelte";
  import { replaceState } from "$app/navigation";
  import { page } from "$app/stores";
  import { supabase } from "$lib/supabase";
  import ManagePageShell from "./ManagePageShell.svelte";
  import { KIND_FIELD, type RefColumn, type RefField } from "./refCrud";
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
  import Spinner from "$lib/ui/Spinner.svelte";
  import Tabs from "$lib/ui/Tabs.svelte";
  import { kindFromUrl, kindInfo, kindListHref, kindOf, kindTabItems, type ProductKind, type ProductKindInfo } from "$lib/productKinds";

  /**
   * Page de référentiel (pays, régions, cépages, clients, fournisseurs…) : liste, création, édition et
   * suppression d'une table Supabase, décrites par des colonnes et des champs (refCrud.ts).
   */
  interface Props {
    title: string;
    table: string;
    /** Sélection PostgREST (jointures pour l'affichage). */
    select?: string;
    /** Colonne de tri (côté client) ; `sortRows` la remplace quand le tri dépend de plusieurs colonnes. */
    orderBy?: string;
    sortRows?: ((rows: any[]) => any[]) | null;
    /** « Nouveau cépage », « Nouvelle région »… ; avec `kindTabs`, peut dépendre du type de l'onglet. */
    newLabel: string | ((kind: ProductKindInfo) => string);
    /** Titre de la modale d'édition : « Modifier le cépage ». */
    editLabel: string;
    /** Pour la confirmation de suppression : « ce cépage », « cette région ». */
    thisLabel: string;
    /** Conséquences particulières d'une suppression (données liées supprimées avec la ligne…). */
    deleteNote?: string;
    emptyText: string;
    fields: RefField[];
    columns: RefColumn[];
    /** Nom affiché d'une ligne (menu d'actions, confirmation). */
    rowLabel?: (row: any) => string;
    /** Fiche détaillée : la première colonne devient un lien et le menu propose « Ouvrir la fiche ». */
    rowHref?: ((row: any) => string) | null;
    /** Ouvre directement l'édition de cette ligne après le chargement (lien « Modifier » d'une autre page). */
    editId?: string | null;
    /**
     * Référentiel propre à un type de produit (colonne `kind`) : un onglet par type, avec ce libellé, et
     * le champ « Produit » ajouté au formulaire après le premier (type de l'onglet à la création).
     */
    kindTabs?: ((kind: ProductKindInfo) => string) | null;
  }

  let {
    title,
    table,
    select = "*",
    orderBy = "name",
    sortRows = null,
    newLabel,
    editLabel,
    thisLabel,
    deleteNote = "",
    emptyText,
    fields,
    columns,
    rowLabel = (row) => row.name,
    rowHref = null,
    editId = null,
    kindTabs = null
  }: Props = $props();

  let rows = $state<any[]>([]);
  let loading = $state(true);
  let error = $state("");
  let formOpen = $state(false);
  let editing = $state<any>(null);
  let form = $state<Record<string, string>>({});
  let saving = $state(false);
  let deleteTarget = $state<any>(null);

  /** Type de l'onglet ouvert (avec `kindTabs`). */
  let kind = $state<ProductKind>(kindFromUrl($page.url));
  let newText = $derived(typeof newLabel === "function" ? newLabel(kindInfo(kind)) : newLabel);
  let formFields = $derived(
    kindTabs ? [fields[0], { ...KIND_FIELD, default: kind }, ...fields.slice(1)] : fields,
  );
  let shownRows = $derived(kindTabs ? rows.filter((r) => kindOf(r) === kind) : rows);
  let tabItems = $derived(kindTabs ? kindTabItems(rows, loading, kindTabs) : []);

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
    if (toEdit) {
      showKind(kindOf(toEdit));
      openForm(toEdit);
    }
  });

  /** Onglet ouvert, gardé dans l'URL (avec `kindTabs`). */
  function showKind(next: ProductKind) {
    if (!kindTabs || next === kind) return;
    kind = next;
    replaceState(kindListHref($page.url.pathname, next), {});
  }

  function sorted(list: any[]): any[] {
    if (sortRows) return sortRows(list);
    return [...list].sort((a, b) => String(a[orderBy] ?? "").localeCompare(String(b[orderBy] ?? ""), "fr"));
  }

  function openForm(row: any = null) {
    editing = row;
    form = Object.fromEntries(
      formFields.map((f) => [f.key, row?.[f.key] != null ? String(row[f.key]) : row ? "" : (f.default ?? "")]),
    );
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
      formFields.map((f) => {
        const raw = (form[f.key] ?? "").trim();
        if (f.type === "number") return [f.key, raw ? Number(raw.replace(",", ".")) : null];
        if (f.type === "checkbox") return [f.key, raw === "true"];
        return [f.key, raw && f.normalize ? f.normalize(raw) : raw || null];
      }),
    );
  }

  async function submit() {
    if (saving) return;
    const missing = formFields.find((f) => f.required && !(form[f.key] ?? "").trim());
    if (missing) {
      error = `« ${missing.label} » est obligatoire.`;
      return;
    }
    const notNumber = formFields.find(
      (f) => f.type === "number" && (form[f.key] ?? "").trim() && !NUMBER.test(form[f.key].trim()),
    );
    if (notNumber) {
      error = `« ${notNumber.label} » doit être un nombre (ex. 42.35).`;
      return;
    }
    const refused = formFields.find((f) => f.normalize && (form[f.key] ?? "").trim() && !f.normalize(form[f.key].trim()));
    if (refused) {
      error = refused.invalid ?? `« ${refused.label} » n’est pas valide.`;
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
    if (formOpen && editing === target) {
      closeForm();
      /* Montre la ligne, même enregistrée sous un autre type de produit. */
      showKind(kindOf(saved));
    }
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

{#snippet kindTabsBar()}
  <Tabs label="Type de produit" items={tabItems} bind:value={() => kind, showKind} />
{/snippet}

<ManagePageShell {title} tabs={kindTabs ? kindTabsBar : undefined}>
  {#snippet actions()}
      <Button variant="primary" onclick={() => openForm()}><IconPlus size={16} strokeWidth={1.75} /> {newText}</Button>
  {/snippet}

  {#if error && !formOpen}
    <div class="error-message" role="alert">{error}</div>
  {/if}

  {#if loading}
    <Spinner />
  {:else if shownRows.length === 0}
    <EmptyState title="Aucun élément pour l’instant" text={emptyText}>
      <Button onclick={() => openForm()}><IconPlus size={16} strokeWidth={1.75} /> {newText}</Button>
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
        {#each shownRows as row (row.id)}
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

<Modal open={formOpen} title={editing ? editLabel : newText} onclose={closeForm}>
  {#if error}
    <div class="error-message" role="alert">{error}</div>
  {/if}
  <form id={formId} class="form-grid" onsubmit={preventDefault(submit)}>
    {#each formFields as f (f.key)}
      {@const id = `${table}-${f.key}`}
      {#if f.type === "checkbox"}
        <!-- Valeur gardée en texte comme les autres champs : « true » ou non. -->
        <div class="form-group full-width">
          <label class="checkbox-label">
            <input
              {id}
              type="checkbox"
              bind:checked={() => form[f.key] === "true", (on) => (form[f.key] = on ? "true" : "false")}
              aria-describedby={f.help ? `${id}-help` : undefined}
            />
            {f.label}
          </label>
          {#if f.help}<small id="{id}-help" class="t-caption">{f.help}</small>{/if}
        </div>
      {:else}
      <div class="form-group" class:full-width={f.full || f.type === "textarea"}>
        <Field {id} label={f.label} required={f.required} help={f.help ?? ""} >
          {#snippet children({ describedby })}
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
                            {/snippet}
                </Field>
      </div>
      {/if}
    {/each}
  </form>
  {#snippet footer()}
      <Button variant="ghost" onclick={closeForm}>Annuler</Button>
      <Button variant="primary" type="submit" form={formId} disabled={saving}>{editing ? "Enregistrer" : "Créer"}</Button>
  {/snippet}
</Modal>

<ConfirmDialog
  open={!!deleteTarget}
  title="Supprimer {thisLabel} ?"
  message={deleteTarget ? `« ${rowLabel(deleteTarget)} » sera définitivement supprimé. ${deleteNote}` : ""}
  action={() => remove(deleteTarget)}
  oncancel={() => (deleteTarget = null)}
  ondone={() => (deleteTarget = null)}
/>
