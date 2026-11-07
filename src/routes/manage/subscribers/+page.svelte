<script lang="ts">
  import { onMount } from "svelte";
  import { errorMessage } from "$lib/async";
  import { fetchAllRows, supabase } from "$lib/supabase";
  import { mailtoHref } from "$lib/contact";
  import { localIsoDate, todayIso } from "$lib/dates";
  import { downloadTextFile } from "$lib/download";
  import { fold, formatDate } from "$lib/format";
  import { sortedBy, type SortState } from "$lib/sort";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import Button from "$lib/ui/Button.svelte";
  import Card from "$lib/ui/Card.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import DataTable from "$lib/ui/DataTable.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import type { MenuItem } from "$lib/ui/Menu.svelte";
  import RowMenu from "$lib/ui/RowMenu.svelte";
  import SortHeader from "$lib/ui/SortHeader.svelte";
  import Spinner from "$lib/ui/Spinner.svelte";
  import { IconDownload, IconMail, IconMailCheck, IconSearch, IconTrash } from "$lib/ui/icons";
  import type { Tables } from "$lib/database.types";

  /**
   * Abonnés de `email_subscriber` : le formulaire de l'accueil (`homepage`) et chaque
   * inscription à une dégustation (`registration`). Ce sont eux que vise « Abonnés newsletter »
   * dans Campagnes.
   */
  type Subscriber = Pick<Tables<"email_subscriber">, "id" | "email" | "source" | "created_at">;
  type SortKey = "email" | "source" | "created_at";

  const SOURCES: Record<string, string> = {
    homepage: "Accueil",
    registration: "Dégustation",
  };
  const sourceLabel = (s: string) => SOURCES[s] ?? s;

  let loading = $state(true);
  let error = $state("");
  let subscribers = $state.raw<Subscriber[]>([]);
  let search = $state("");
  /** Source affichée ; vide = toutes. */
  let source = $state("");
  let sort = $state<SortState<SortKey>>({ key: "created_at", dir: "desc" });

  onMount(async () => {
    try {
      subscribers = await fetchAllRows<Subscriber>((a, b) =>
        supabase
          .from("email_subscriber")
          .select("id, email, source, created_at")
          .order("created_at", { ascending: false })
          .order("id")
          .range(a, b),
      );
    } catch (e) {
      error = errorMessage(e);
    } finally {
      loading = false;
    }
  });

  /* « Tous », les sources connues, puis celles qui existeraient en base sans libellé. */
  let sourceFilters = $derived.by(() => {
    const counts = new Map<string, number>([["", subscribers.length], ...Object.keys(SOURCES).map((k): [string, number] => [k, 0])]);
    for (const s of subscribers) counts.set(s.source, (counts.get(s.source) ?? 0) + 1);
    return [...counts].map(([key, count]) => ({ key, label: key ? sourceLabel(key) : "Tous", count }));
  });
  let shown = $derived.by(() => {
    const q = fold(search.trim());
    const rows = subscribers.filter((s) => (!source || s.source === source) && (!q || fold(s.email).includes(q)));
    return sortedBy(rows, sort, {
      email: (s) => s.email,
      source: (s) => sourceLabel(s.source),
      created_at: (s) => s.created_at,
    });
  });

  function exportCsv() {
    /* Point-virgule et BOM : Excel en français ouvre le fichier directement, accents compris. */
    /* « ' » devant =, +, -, @ : le tableur ne doit pas exécuter une formule glissée dans un email. */
    const cell = (v: string) => `"${v.replace(/^[=+\-@\t\r]/, "'$&").replaceAll('"', '""')}"`;
    const lines = [
      ["Email", "Source", "Inscrit le"],
      ...shown.map((s) => [s.email, sourceLabel(s.source), formatDate(localIsoDate(s.created_at))]),
    ].map((row) => row.map(cell).join(";"));
    downloadTextFile(`abonnes-${todayIso()}.csv`, `\uFEFF${lines.join("\r\n")}`, "text/csv;charset=utf-8");
  }

  let deleteTarget = $state<Subscriber | null>(null);
  let confirmOpen = $state(false);

  function rowItems(s: Subscriber): MenuItem[] {
    return [
      { label: "Écrire", icon: IconMail, href: mailtoHref(s.email) },
      {
        label: "Supprimer…",
        icon: IconTrash,
        danger: true,
        separator: true,
        onSelect: () => {
          deleteTarget = s;
          confirmOpen = true;
        },
      },
    ];
  }

  /* Même désinscription que le lien des campagnes. */
  async function remove(s: Subscriber) {
    error = "";
    const { error: e } = await supabase.rpc("unsubscribe_email", { p_id: s.id });
    if (e) error = e.message;
    else subscribers = subscribers.filter((x) => x.id !== s.id);
  }
</script>

<svelte:head>
  <title>Abonnés - Gestion</title>
</svelte:head>

<ManagePageShell title="Abonnés" subtitle="Emails laissés sur l’accueil du site ou lors d’une inscription à une dégustation">
  {#snippet actions()}
    <Button onclick={exportCsv} disabled={loading || shown.length === 0}>
      <IconDownload size={16} strokeWidth={1.75} /> {shown.length === subscribers.length ? "Exporter en CSV" : `Exporter la sélection (${shown.length})`}
    </Button>
  {/snippet}

  {#if loading}
    <Spinner />
  {:else}
    {#if error}<div class="error-message" role="alert">{error}</div>{/if}

    <div class="toolbar">
      <label class="search">
        <span class="sr-only">Rechercher un email</span>
        <IconSearch size={16} strokeWidth={1.75} aria-hidden="true" />
        <input class="ui-control" type="search" placeholder="Rechercher un email…" bind:value={search} />
      </label>
      <div class="chips" role="group" aria-label="Filtrer par source">
        {#each sourceFilters as f (f.key)}
          <button type="button" class="ui-chip" aria-pressed={source === f.key} onclick={() => (source = source === f.key ? "" : f.key)}>
            {f.label}<span class="count">{f.count}</span>
          </button>
        {/each}
      </div>
    </div>

    {#if shown.length === 0 && !error}
      <Card>
        <EmptyState
          icon={IconMailCheck}
          title={subscribers.length ? "Aucun abonné ne correspond" : "Aucun abonné pour l’instant"}
          text="Les emails laissés sur l’accueil du site et ceux des inscrits aux dégustations arrivent ici."
        />
      </Card>
    {:else if shown.length}
      <DataTable caption="Abonnés">
        <thead>
          <tr>
            <SortHeader column="email" label="Email" bind:sort />
            <SortHeader column="source" label="Source" bind:sort />
            <SortHeader column="created_at" label="Inscrit le" firstDir="desc" bind:sort />
            <th scope="col" class="col-actions"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {#each shown as s (s.id)}
            <tr>
              <td><strong>{s.email}</strong></td>
              <td>{sourceLabel(s.source)}</td>
              <td>{formatDate(localIsoDate(s.created_at))}</td>
              <td class="col-actions">
                <RowMenu label="Actions pour {s.email}" items={rowItems(s)} />
              </td>
            </tr>
          {/each}
        </tbody>
      </DataTable>
    {/if}
  {/if}
</ManagePageShell>

<ConfirmDialog
  bind:open={confirmOpen}
  title="Supprimer cet abonné ?"
  message={deleteTarget ? `${deleteTarget.email} sera retiré de la liste des abonnés (une nouvelle inscription à une dégustation l’y remettra).` : ""}
  action={() => remove(deleteTarget!)}
/>

<style>
  .toolbar {
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
    flex-wrap: wrap;
    gap: 8px;
  }

  @media (max-width: 720px) {
    .search {
      flex: 1 1 100%;
    }
  }
</style>
