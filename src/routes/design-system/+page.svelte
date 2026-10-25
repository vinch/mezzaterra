<script lang="ts">
  /**
   * Vitrine du design system : chaque composant de src/lib/ui/ avec ses variantes, les tokens et
   * les classes utilitaires. Page publique sans données (consultable sans connexion, non indexée).
   * Tout nouveau composant partagé y est ajouté.
   */
  import "$lib/styles/manage-shared.css";
  import { onMount } from "svelte";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";
  import AmountTypeInput from "$lib/ui/AmountTypeInput.svelte";
  import Button from "$lib/ui/Button.svelte";
  import Card from "$lib/ui/Card.svelte";
  import Combobox, { type ComboOption } from "$lib/ui/Combobox.svelte";
  import ConfirmDialog from "$lib/ui/ConfirmDialog.svelte";
  import DataTable from "$lib/ui/DataTable.svelte";
  import EmptyState from "$lib/ui/EmptyState.svelte";
  import Field from "$lib/ui/Field.svelte";
  import IconButton from "$lib/ui/IconButton.svelte";
  import KpiCard from "$lib/ui/KpiCard.svelte";
  import Menu, { type MenuItem } from "$lib/ui/Menu.svelte";
  import Modal from "$lib/ui/Modal.svelte";
  import PageHeader from "$lib/ui/PageHeader.svelte";
  import RowMenu from "$lib/ui/RowMenu.svelte";
  import Select from "$lib/ui/Select.svelte";
  import Sidebar, { type NavSection } from "$lib/ui/Sidebar.svelte";
  import StatusBadge from "$lib/ui/StatusBadge.svelte";
  import Stepper from "$lib/ui/Stepper.svelte";
  import StockBadge from "$lib/ui/StockBadge.svelte";
  import WineDot from "$lib/ui/WineDot.svelte";
  import * as icons from "$lib/ui/icons";
  import {
    IconBox,
    IconCheck,
    IconDownload,
    IconEuro,
    IconHome,
    IconInbox,
    IconPencil,
    IconPlus,
    IconReceipt,
    IconSearch,
    IconTrash,
    IconUsers,
    IconWine,
  } from "$lib/ui/icons";
  import { preventDefault } from "$lib/ui/events";
  import {
    CHANGEABLE_STATUSES,
    KIND_META,
    SALE_STATUS_ACTIONS,
    SALE_TRANSITIONS,
    STATUS_META,
    type SaleStatus,
    type StatusKind,
  } from "$lib/status";
  import { allWineStyles } from "$lib/wine";
  import { formatEUR } from "$lib/format";

  const SECTIONS = [
    ["principes", "Principes"],
    ["couleurs", "Couleurs"],
    ["typo", "Typographie"],
    ["boutons", "Boutons"],
    ["badges", "Badges et pastilles"],
    ["champs", "Champs"],
    ["cartes", "Cartes et indicateurs"],
    ["tableaux", "Tableaux"],
    ["etats", "États"],
    ["superpositions", "Modales et menus"],
    ["navigation", "Navigation"],
    ["icones", "Icônes"],
    ["site", "Site public"],
  ] as const;

  type Token = { name: string; note: string };
  const COLOR_GROUPS: { title: string; tokens: Token[] }[] = [
    {
      title: "Marque et actions",
      tokens: [
        { name: "--teal-600", note: "Actions, liens, focus" },
        { name: "--teal-700", note: "Survol" },
        { name: "--title", note: "Titre de page" },
        { name: "--mist", note: "Sélection, fonds d’icônes" },
        { name: "--gold", note: "Compteurs de la barre latérale" },
      ],
    },
    {
      title: "Surfaces et bordures",
      tokens: [
        { name: "--paper", note: "Fond de l’app" },
        { name: "--card", note: "Cartes, tableaux, modales" },
        { name: "--table-head", note: "En-têtes, pieds de modale" },
        { name: "--row-hover", note: "Survol d’une ligne" },
        { name: "--border", note: "Bordure des cartes" },
        { name: "--border-soft", note: "Séparateurs internes" },
        { name: "--input-border", note: "Champs" },
        { name: "--btn-border", note: "Boutons secondaires" },
      ],
    },
    {
      title: "Texte et états",
      tokens: [
        { name: "--ink", note: "Texte principal" },
        { name: "--ink-2", note: "Texte secondaire (≥ 4,5:1)" },
        { name: "--danger", note: "Destructif, rupture, erreur" },
        { name: "--warn", note: "Stock bas (texte)" },
      ],
    },
    {
      title: "Barre latérale",
      tokens: [
        { name: "--night", note: "Fond, puce active" },
        { name: "--night-active", note: "Lien actif" },
        { name: "--night-label", note: "Titres de groupe" },
      ],
    },
  ];
  const STATUS_TONES = Object.keys(STATUS_META);
  const WINE_STYLES = allWineStyles();
  const SHAPES: Token[] = [
    { name: "--r-sm", note: "Champs, boutons (6 px)" },
    { name: "--r-md", note: "Cartes, modales (10 px)" },
    { name: "--r-pill", note: "Badges, puces" },
  ];

  /* Valeurs réelles des tokens, lues dans la feuille de style (aucune copie à tenir à jour). */
  let values = $state<Record<string, string>>({});
  onMount(() => {
    const css = getComputedStyle(document.documentElement);
    const names = [
      ...COLOR_GROUPS.flatMap((g) => g.tokens.map((t) => t.name)),
      ...STATUS_TONES.flatMap((t) => [`--st-${t}-bg`, `--st-${t}-fg`]),
      ...SHAPES.map((s) => s.name),
    ];
    values = Object.fromEntries(names.map((n) => [n, css.getPropertyValue(n).trim()]));
  });

  const ICONS = Object.entries(icons).sort(([a], [b]) => a.localeCompare(b));

  /* Démos interactives */
  let name = $state("");
  let robe = $state("");
  let customer = $state("");
  let discount = $state("10");
  let discountType = $state<"amount" | "percent">("percent");
  let quantity = $state(6);
  let robeFilter = $state("");
  let modalOpen = $state(false);
  let confirmOpen = $state(false);
  let statusOpen = $state(false);
  let statusAnchor = $state<HTMLElement | null>(null);
  let demoStatus = $state<SaleStatus>("pending");

  const customers: ComboOption[] = [
    { id: "1", label: "Giulia Rossi", searchText: "giulia rossi bruxelles" },
    { id: "2", label: "Marc Dupont", searchText: "marc dupont liege" },
    { id: "3", label: "Restaurant Il Forno", searchText: "restaurant il forno namur", disabled: true },
  ];

  const rowItems: MenuItem[] = [
    { label: "Modifier", icon: IconPencil, onSelect: () => (modalOpen = true) },
    { label: "Télécharger la facture", icon: IconDownload },
    { label: "Supprimer…", icon: IconTrash, danger: true, separator: true, onSelect: () => (confirmOpen = true) },
  ];

  /* Mêmes transitions et libellés que la page Ventes. */
  let statusItems = $derived<MenuItem[]>(
    (SALE_TRANSITIONS[demoStatus] ?? []).map((st) => ({ ...SALE_STATUS_ACTIONS[st], onSelect: () => (demoStatus = st) })),
  );

  const rows = [
    { id: "a", wine: "Montepulciano d’Abruzzo", robe: "red", winery: "Filomusi Guelfi", stock: 0, price: 14.5 },
    { id: "b", wine: "Trebbiano d’Abruzzo", robe: "white", winery: "Tiberio", stock: 4, price: 18 },
    { id: "c", wine: "Cerasuolo", robe: "rose", winery: "Praesidium", stock: 36, price: 16.9 },
  ] as const;

  const sidebarSections: NavSection[] = [
    { title: null, links: [{ href: "#navigation", label: "Tableau de bord", icon: IconHome }] },
    {
      title: "Ventes",
      links: [
        { href: "#navigation", label: "Demandes", icon: IconInbox, count: 3 },
        { href: "/design-system", label: "Ventes", icon: IconReceipt },
        { href: "#navigation", label: "Clients", icon: IconUsers },
      ],
    },
  ];

  const kinds = Object.entries(KIND_META) as [StatusKind, (typeof KIND_META)[StatusKind]][];
</script>

<svelte:head>
  <title>Design system - Mezzaterra</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="app ds">
  <ManagePageShell
    title="Design system"
    subtitle="Composants de src/lib/ui/, tokens de src/app.css et lib/styles/tokens.css. Toute nouvelle fonctionnalité les réutilise."
  >
    <div class="ds-layout">
      <nav class="ds-toc" aria-label="Sommaire">
        {#each SECTIONS as [id, label]}
          <a href="#{id}">{label}</a>
        {/each}
      </nav>

      <div class="ds-main">
        <!-- ——— Principes ——— -->
        <section id="principes" class="ds-section">
          <h2 class="t-card-title">Principes</h2>
          <ul class="ds-rules">
            <li><strong>Réutiliser avant de créer.</strong> Un composant de <code>src/lib/ui/</code> existe pour les boutons, champs, tableaux, badges, modales, menus, cartes et états vides.</li>
            <li><strong>Tokens uniquement.</strong> Couleurs, rayons et ombres viennent des variables CSS : jamais de hex en dur dans une page.</li>
            <li><strong>Un seul bouton <code>primary</code></strong> par écran ou par modale. <code>danger-solid</code> est réservé à <code>ConfirmDialog</code>.</li>
            <li><strong>Pages de gestion</strong> : <code>ManagePageShell</code> (titre, contexte, actions à droite), puis le contenu.</li>
            <li><strong>Actions d’une ligne</strong> dans un <code>RowMenu</code> « … » : seulement celles permises par l’état, « Supprimer… » en dernier, qui ouvre un <code>ConfirmDialog</code>.</li>
            <li><strong>Icônes</strong> importées depuis <code>$lib/ui/icons</code>, jamais directement depuis <code>@lucide/svelte</code>.</li>
            <li><strong>Chiffres</strong> alignés à droite (<code>.num</code>, y compris l’en-tête de colonne), montants avec <code>formatEUR</code>, dates avec <code>formatDate</code>.</li>
            <li><strong>Accessibilité</strong> : chaque champ a un libellé (<code>Field</code>), chaque bouton icône un <code>label</code>, cibles de 44 px sur mobile (déjà géré par les composants).</li>
            <li><strong>Textes en français</strong>, phrases courtes, guillemets « » et apostrophe typographique ’.</li>
          </ul>
        </section>

        <!-- ——— Couleurs ——— -->
        <section id="couleurs" class="ds-section">
          <h2 class="t-card-title">Couleurs</h2>
          <p class="t-muted">Variables de <code>src/app.css</code> (alias courts de l’admin, définis à partir des <code>--mz-*</code> de <code>tokens.css</code>).</p>
          {#each COLOR_GROUPS as group}
            <h3 class="ds-h3">{group.title}</h3>
            <div class="swatches">
              {#each group.tokens as t}
                <div class="swatch">
                  <span class="swatch-color" style="background: var({t.name})"></span>
                  <code>{t.name}</code>
                  <span class="t-caption">{t.note}</span>
                  <span class="t-caption mono">{values[t.name] ?? ""}</span>
                </div>
              {/each}
            </div>
          {/each}

          <h3 class="ds-h3">Statuts</h3>
          <p class="t-muted">Couples <code>--st-*-bg</code> / <code>--st-*-fg</code>, utilisés par <code>StatusBadge</code> et <code>StockBadge</code>.</p>
          <div class="swatches">
            {#each STATUS_TONES as tone}
              <div class="swatch">
                <span class="swatch-color tone" style="background: var(--st-{tone}-bg); color: var(--st-{tone}-fg)">Aa</span>
                <code>--st-{tone}-*</code>
                <span class="t-caption mono">{values[`--st-${tone}-bg`] ?? ""} / {values[`--st-${tone}-fg`] ?? ""}</span>
              </div>
            {/each}
          </div>

          <h3 class="ds-h3">Robes</h3>
          <p class="t-muted">Dans <code>STYLES</code> (<code>src/lib/wine.ts</code>) : passer par <code>WineDot</code>, <code>wineRobe()</code> ou <code>swatchStyle()</code>.</p>
          <div class="row">
            {#each WINE_STYLES as s}
              <span class="inline"><WineDot robe={s.key} size={14} />{s.label}</span>
            {/each}
          </div>

          <h3 class="ds-h3">Formes</h3>
          <div class="row">
            {#each SHAPES as s}
              <div class="shape" style="border-radius: var({s.name})"><code>{s.name}</code><span class="t-caption">{s.note}</span></div>
            {/each}
            <div class="shape" style="box-shadow: var(--shadow-pop)"><code>--shadow-pop</code><span class="t-caption">Menus, modales</span></div>
          </div>
        </section>

        <!-- ——— Typographie ——— -->
        <section id="typo" class="ds-section">
          <h2 class="t-card-title">Typographie</h2>
          <p class="t-muted">Fraunces (<code>--font-serif</code>) pour les titres et les chiffres clés, Inter (<code>--font-sans</code>) pour le reste, 14/20 px, chiffres tabulaires.</p>
          <Card>
            <div class="type-specimens">
            <div><code>.t-page-title</code><span class="t-page-title">Ventes</span></div>
            <div><code>.t-card-title</code><span class="t-card-title">Top 5 des vins</span></div>
            <div><code>.t-figure</code><span class="t-figure">{formatEUR(12480)}</span></div>
            <div><code>.t-label</code><span class="t-label">Mode de paiement</span></div>
            <div><code>corps</code><span>Texte courant en Inter 14 px.</span></div>
            <div><code>.t-caption</code><span class="t-caption">Ligne de contexte, aide, date.</span></div>
            <div><code>.t-muted</code><span class="t-muted">Texte secondaire.</span></div>
            <div><code>.t-warn</code><span class="t-warn">Plus que 4 bouteilles.</span></div>
            <div><code>.t-danger</code><span class="t-danger">Paiement en retard.</span></div>
            </div>
          </Card>
        </section>

        <!-- ——— Boutons ——— -->
        <section id="boutons" class="ds-section">
          <h2 class="t-card-title">Boutons</h2>
          <h3 class="ds-h3"><code>Button</code> · variantes</h3>
          <div class="row">
            <Button variant="primary"><IconPlus size={16} strokeWidth={2} />Nouvelle vente</Button>
            <Button>Secondaire</Button>
            <Button variant="ghost">Annuler</Button>
            <Button variant="danger">Supprimer</Button>
            <Button variant="danger-solid">Oui, supprimer</Button>
            <Button variant="primary" disabled>Désactivé</Button>
          </div>
          <h3 class="ds-h3">Tailles</h3>
          <div class="row">
            <Button size="sm">Petit (32)</Button>
            <Button>Moyen (40)</Button>
            <Button size="lg">Grand (48)</Button>
            <Button href="#boutons" size="sm">Lien (href)</Button>
          </div>
          <pre class="code"><code>{`<Button variant="primary" onclick={save}>Enregistrer</Button>
<Button href="/manage/sales">Voir les ventes</Button>
<Button type="submit" form="sale-form" variant="primary">Créer</Button>  <!-- pied de modale -->`}</code></pre>

          <h3 class="ds-h3"><code>IconButton</code> · <code>label</code> obligatoire</h3>
          <div class="row">
            <IconButton label="Modifier"><IconPencil size={18} strokeWidth={1.75} /></IconButton>
            <IconButton label="Télécharger" variant="outline"><IconDownload size={18} strokeWidth={1.75} /></IconButton>
            <IconButton label="Supprimer" disabled><IconTrash size={18} strokeWidth={1.75} /></IconButton>
            <span class="night-box"><IconButton label="Rechercher" variant="dark"><IconSearch size={18} strokeWidth={1.75} /></IconButton></span>
          </div>
        </section>

        <!-- ——— Badges ——— -->
        <section id="badges" class="ds-section">
          <h2 class="t-card-title">Badges et pastilles</h2>
          <h3 class="ds-h3"><code>StatusBadge</code> · par type (<code>kind</code>)</h3>
          {#each kinds as [kind, metas]}
            <div class="row labelled">
              <code class="row-label">{kind}</code>
              {#each Object.keys(metas) as status}
                <StatusBadge {kind} {status} />
              {/each}
            </div>
          {/each}
          <div class="row labelled">
            <code class="row-label">interactive</code>
            <StatusBadge
              status={demoStatus}
              interactive={CHANGEABLE_STATUSES.includes(demoStatus)}
              expanded={statusOpen}
              bind:el={statusAnchor}
              onclick={() => (statusOpen = !statusOpen)}
            />
            <span class="t-caption">Ouvre un <code>Menu</code> des transitions permises (<code>SALE_TRANSITIONS</code>, <code>SALE_STATUS_ACTIONS</code>).</span>
            {#if !CHANGEABLE_STATUSES.includes(demoStatus)}
              <Button size="sm" variant="ghost" onclick={() => (demoStatus = "pending")}>Recommencer</Button>
            {/if}
          </div>
          <Menu bind:open={statusOpen} anchor={statusAnchor} items={statusItems} label="Changer le statut" align="start" />

          <h3 class="ds-h3"><code>StockBadge</code></h3>
          <div class="row">
            <StockBadge kind="out" />
            <StockBadge kind="low" />
            <StockBadge kind="dormant" days={142} />
            <StockBadge kind="gone" />
            <StockBadge kind="low" label="2 bt." />
          </div>

          <h3 class="ds-h3"><code>.ui-chip</code> · puces de filtre</h3>
          <div class="row">
            <button type="button" class="ui-chip" aria-pressed={!robeFilter} onclick={() => (robeFilter = "")}>Toutes</button>
            {#each WINE_STYLES.slice(0, 4) as s}
              <button type="button" class="ui-chip" aria-pressed={robeFilter === s.key} onclick={() => (robeFilter = robeFilter === s.key ? "" : s.key)}>
                <WineDot robe={s.key} />{s.label}<span class="count">12</span>
              </button>
            {/each}
          </div>
        </section>

        <!-- ——— Champs ——— -->
        <section id="champs" class="ds-section">
          <h2 class="t-card-title">Champs</h2>
          <p class="t-muted"><code>Field</code> porte le libellé, l’aide et l’erreur ; le contrôle reçoit <code>describedby</code> et <code>invalid</code> du snippet. Les contrôles natifs prennent la classe <code>.ui-control</code>.</p>
          <Card>
            <div class="form-demo">
              <Field id="ds-name" label="Nom du vin" help="Laisser vide pour utiliser le nom de l’appellation.">
                {#snippet children({ describedby, invalid })}
                  <input id="ds-name" class="ui-control" type="text" bind:value={name} aria-describedby={describedby} aria-invalid={invalid || undefined} />
                {/snippet}
              </Field>
              <Field id="ds-email" label="Email" error="Adresse invalide.">
                {#snippet children({ describedby, invalid })}
                  <input id="ds-email" class="ui-control" type="email" value="giulia@" aria-describedby={describedby} aria-invalid={invalid || undefined} />
                {/snippet}
              </Field>
              <Field id="ds-robe" label="Robe" required>
                {#snippet children({ describedby, invalid })}
                  <Select id="ds-robe" bind:value={robe} required {describedby} {invalid}>
                    <option value="">Sélectionner une robe</option>
                    {#each WINE_STYLES as s}<option value={s.key}>{s.label}</option>{/each}
                  </Select>
                {/snippet}
              </Field>
              <Field id="ds-customer" label="Client" help="Combobox : taper, ↑ ↓ puis Entrée.">
                {#snippet children({ describedby, invalid })}
                  <Combobox id="ds-customer" bind:value={customer} options={customers} {describedby} {invalid} placeholder="Rechercher un client…" />
                {/snippet}
              </Field>
              <Field id="ds-discount" label="Ristourne" optional>
                {#snippet children({ describedby })}
                  <AmountTypeInput id="ds-discount" bind:amount={discount} bind:type={discountType} {describedby} />
                {/snippet}
              </Field>
              <Field id="ds-disabled" label="N° de facture" help="Attribué au passage en « Payée ».">
                {#snippet children({ describedby })}
                  <input id="ds-disabled" class="ui-control" type="text" value="2026-0042" disabled aria-describedby={describedby} />
                {/snippet}
              </Field>
              <Field id="ds-notes" label="Notes" optional>
                {#snippet children({ describedby })}
                  <textarea id="ds-notes" class="ui-control" rows="3" aria-describedby={describedby}></textarea>
                {/snippet}
              </Field>
              <div class="field-col">
                <span class="t-label">Quantité · <code>Stepper</code></span>
                <div class="row">
                  <Stepper bind:value={quantity} label="Bouteilles" />
                  <Stepper bind:value={quantity} label="Bouteilles (tactile)" size="lg" />
                </div>
                <label class="checkbox-label"><input type="checkbox" checked /> Case à cocher (<code>.checkbox-label</code>)</label>
              </div>
            </div>
          </Card>
        </section>

        <!-- ——— Cartes ——— -->
        <section id="cartes" class="ds-section">
          <h2 class="t-card-title">Cartes et indicateurs</h2>
          <div class="kpis">
            <KpiCard label="Chiffre d’affaires" value={formatEUR(12480)} icon={IconEuro} href="#cartes">+12 % sur 12 mois</KpiCard>
            <KpiCard label="Bouteilles en stock" value="418" icon={IconBox}>Dont 3 vins en rupture</KpiCard>
            <KpiCard label="Vins au catalogue" value="64" icon={IconWine} />
          </div>
          <div class="cards">
            <Card title="Coordonnées" subtitle="Carte avec titre, sous-titre et actions">
              {#snippet actions()}
                <Button size="sm">Modifier</Button>
              {/snippet}
              <p class="flush">Contenu de la carte : fond <code>--card</code>, bordure 1 px, sans ombre.</p>
            </Card>
            <Card title="Historique" padded={false}>
              <p class="flush padded-text t-muted"><code>padded={"{false}"}</code> pour coller un tableau ou une liste aux bords.</p>
            </Card>
          </div>
        </section>

        <!-- ——— Tableaux ——— -->
        <section id="tableaux" class="ds-section">
          <h2 class="t-card-title">Tableaux</h2>
          <p class="t-muted"><code>DataTable</code> avec <code>caption</code> ; en-têtes <code>scope="col"</code>, colonnes chiffrées <code>.num</code>, nom cliquable <code>.row-link</code>, actions dans <code>.col-actions</code> avec un <code>RowMenu</code>.</p>
          <DataTable caption="Exemple de tableau">
            <thead>
              <tr>
                <th scope="col">Vin</th>
                <th scope="col">Domaine</th>
                <th scope="col" class="num">Stock</th>
                <th scope="col" class="num">Prix</th>
                <th scope="col" class="col-actions"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {#each rows as row (row.id)}
                <tr>
                  <td><span class="inline"><WineDot robe={row.robe} /><a class="row-link" href="#tableaux">{row.wine}</a></span></td>
                  <td>{row.winery}</td>
                  <td class="num">
                    <span class="inline">
                      {#if row.stock === 0}<StockBadge kind="out" />{:else if row.stock < 6}<StockBadge kind="low" />{/if}
                      <strong>{row.stock} bt.</strong>
                    </span>
                  </td>
                  <td class="num">{formatEUR(row.price)}</td>
                  <td class="col-actions"><RowMenu items={rowItems} label="Actions pour {row.wine}" /></td>
                </tr>
              {/each}
            </tbody>
          </DataTable>
        </section>

        <!-- ——— États ——— -->
        <section id="etats" class="ds-section">
          <h2 class="t-card-title">États</h2>
          <div class="cards">
            <Card padded={false}>
              <EmptyState icon={IconReceipt} title="Aucune vente pour l’instant" text="Créez la première vente : elle sera enregistrée « En attente ».">
                <Button>Créer la première vente</Button>
              </EmptyState>
            </Card>
            <div class="states">
              <div class="loading">Chargement…</div>
              <div class="error-message" role="alert">Impossible d’enregistrer la vente.</div>
              <div class="success-message"><IconCheck size={16} strokeWidth={1.75} /> Vente enregistrée.</div>
            </div>
          </div>
        </section>

        <!-- ——— Superpositions ——— -->
        <section id="superpositions" class="ds-section">
          <h2 class="t-card-title">Modales et menus</h2>
          <p class="t-muted"><code>Modal</code> : pied avec « Annuler » (ghost) à gauche du primary. <code>ConfirmDialog</code> pour toute suppression. <code>RowMenu</code> / <code>Menu</code> rendus dans <code>&lt;body&gt;</code>, navigables au clavier.</p>
          <div class="row">
            <Button onclick={() => (modalOpen = true)}>Ouvrir une modale</Button>
            <Button variant="danger" onclick={() => (confirmOpen = true)}>Supprimer…</Button>
            <RowMenu items={rowItems} label="Menu de démonstration" />
          </div>
          <pre class="code"><code>{`<Modal open={showModal} title="Nouveau vin" onclose={close}>
  <form id="wine-form" onsubmit={preventDefault(save)}>…</form>
  {#snippet footer()}
    <Button variant="ghost" onclick={close}>Annuler</Button>
    <Button type="submit" form="wine-form" variant="primary">Créer le vin</Button>
  {/snippet}
</Modal>

<ConfirmDialog bind:open={confirmOpen} title="Supprimer ce vin ?" message="…" action={remove} ondone={reload} />`}</code></pre>
        </section>

        <!-- ——— Navigation ——— -->
        <section id="navigation" class="ds-section">
          <h2 class="t-card-title">Navigation</h2>
          <h3 class="ds-h3"><code>PageHeader</code> (via <code>ManagePageShell</code>)</h3>
          <div class="frame">
            <PageHeader title="Giulia Rossi" subtitle="Cliente depuis mars 2025 · 12 achats" back={{ href: "#navigation", label: "Clients" }}>
              {#snippet badge()}<StatusBadge status="paid" />{/snippet}
              {#snippet actions()}
                <Button>Modifier</Button>
                <Button variant="primary">Nouvelle vente</Button>
              {/snippet}
            </PageHeader>
          </div>
          <h3 class="ds-h3"><code>Sidebar</code> (fournie par le layout de <code>/manage</code>)</h3>
          <div class="sidebar-frame">
            <Sidebar sections={sidebarSections} path="/design-system" email="gianni@mezzaterra.be" id="ds-sidebar" />
          </div>
        </section>

        <!-- ——— Icônes ——— -->
        <section id="icones" class="ds-section">
          <h2 class="t-card-title">Icônes</h2>
          <p class="t-muted">Lucide, importées depuis <code>$lib/ui/icons</code> (en ajouter une là, jamais directement depuis <code>@lucide/svelte</code>). 18 px, <code>strokeWidth={"{1.75}"}</code> ; 16 px dans les boutons et champs.</p>
          <div class="icons">
            {#each ICONS as [iconName, Icon]}
              <div class="icon-cell">
                <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                <code>{iconName}</code>
              </div>
            {/each}
          </div>
        </section>

        <!-- ——— Site public ——— -->
        <section id="site" class="ds-section">
          <h2 class="t-card-title">Site public</h2>
          <p class="t-muted">Le site public a ses primitives préfixées <code>mz-</code> dans <code>src/lib/styles/site.css</code> (<code>.mz-container</code>, <code>.mz-display</code>, <code>.mz-btn</code>, <code>.mz-field</code>, <code>.mz-card</code>…) et les tokens <code>--mz-*</code> de <code>tokens.css</code>. Ne pas mélanger : les composants de <code>src/lib/ui/</code> sont pour la gestion, les <code>mz-</code> pour le site. Le mode live utilise les tokens <code>--mz-cave-*</code> (thème sombre).</p>
        </section>
      </div>
    </div>
  </ManagePageShell>

  <!-- Dans .app, comme les modales des pages de gestion (focus, interlignage). -->
  <Modal open={modalOpen} title="Modifier le vin" onclose={() => (modalOpen = false)}>
    <form id="ds-form" class="modal-form" onsubmit={preventDefault(() => (modalOpen = false))}>
      <Field id="ds-modal-name" label="Nom du vin" required>
        {#snippet children({ describedby, invalid })}
          <input id="ds-modal-name" class="ui-control" type="text" value="Montepulciano d’Abruzzo" required aria-describedby={describedby} aria-invalid={invalid || undefined} />
        {/snippet}
      </Field>
      <Field id="ds-modal-price" label="Prix de vente" help="TVA comprise.">
        {#snippet children({ describedby })}
          <input id="ds-modal-price" class="ui-control" type="text" inputmode="decimal" value="14,50" aria-describedby={describedby} />
        {/snippet}
      </Field>
    </form>
    {#snippet footer()}
      <Button variant="ghost" onclick={() => (modalOpen = false)}>Annuler</Button>
      <Button type="submit" form="ds-form" variant="primary">Enregistrer</Button>
    {/snippet}
  </Modal>

  <ConfirmDialog
    bind:open={confirmOpen}
    title="Supprimer ce vin ?"
    message="« Montepulciano d’Abruzzo » sera supprimé du catalogue. Les ventes passées ne sont pas modifiées."
    onconfirm={() => (confirmOpen = false)}
  />
</div>

<style>
  .ds {
    min-height: 100vh;
    background: var(--paper);
  }

  .ds-layout {
    display: grid;
    grid-template-columns: 180px minmax(0, 1fr);
    gap: 32px;
    align-items: start;
  }

  .ds-toc {
    position: sticky;
    top: 24px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .ds-toc a {
    padding: 6px 10px;
    border-radius: var(--r-sm);
    color: var(--ink-2);
    text-decoration: none;
  }

  .ds-toc a:hover {
    background: var(--mist);
    color: var(--teal-700);
  }

  .ds-main {
    display: flex;
    flex-direction: column;
    gap: 40px;
    min-width: 0;
  }

  .ds-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    scroll-margin-top: 24px;
  }

  .ds-section > p {
    margin: 0;
    max-width: 52rem;
  }

  .ds-h3 {
    margin: 12px 0 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--ink);
  }

  code,
  .mono {
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
  }

  code {
    font-size: 12px;
  }

  .ds-rules {
    margin: 0;
    padding-left: 20px;
    max-width: 52rem;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }

  .row.labelled {
    gap: 8px;
  }

  .row-label {
    width: 88px;
    color: var(--ink-2);
  }

  .inline {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .swatches {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 12px;
  }

  .swatch {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
  }

  .swatch-color {
    display: grid;
    place-items: center;
    height: 48px;
    margin-bottom: 6px;
    border-radius: var(--r-sm);
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
  }

  .swatch-color.tone {
    font-weight: 600;
  }

  .shape {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 2px;
    width: 160px;
    height: 80px;
    padding: 10px;
    background: var(--card);
    border: 1px solid var(--border);
  }

  .type-specimens {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .type-specimens > div {
    display: grid;
    grid-template-columns: 120px 1fr;
    align-items: baseline;
    gap: 16px;
  }

  .type-specimens code {
    color: var(--ink-2);
  }

  .code {
    margin: 0;
    padding: 12px 16px;
    overflow-x: auto;
    background: var(--night);
    color: #e9f0ef;
    border-radius: var(--r-md);
    line-height: 18px;
  }

  .night-box {
    display: inline-flex;
    padding: 4px;
    background: var(--night);
    border-radius: var(--r-sm);
  }

  .form-demo {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }

  .field-col {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .kpis {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    align-items: start;
  }

  .flush {
    margin: 0;
  }

  .padded-text {
    padding: 16px 24px 20px;
  }

  .states {
    display: flex;
    flex-direction: column;
  }

  .frame {
    background: var(--paper);
    border: 1px dashed var(--border);
    border-radius: var(--r-md);
    overflow: hidden;
  }

  .sidebar-frame {
    width: 240px;
    height: 420px;
    border-radius: var(--r-md);
    overflow: hidden;
  }

  .icons {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 8px;
  }

  .icon-cell {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    background: var(--card);
    border: 1px solid var(--border-soft);
    border-radius: var(--r-sm);
    color: var(--ink);
    min-width: 0;
  }

  .icon-cell code {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .modal-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  @media (max-width: 900px) {
    .ds-layout {
      grid-template-columns: 1fr;
    }

    .ds-toc {
      position: static;
      flex-direction: row;
      flex-wrap: wrap;
    }

    .form-demo,
    .kpis,
    .cards {
      grid-template-columns: 1fr;
    }
  }
</style>
