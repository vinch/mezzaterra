<script lang="ts" context="module">
  export type NavLink = { href: string; label: string; icon: any; count?: number };
  export type NavSection = { title: string | null; links: NavLink[]; collapsible?: string };

  /** Lien actif pour `path` (le tableau de bord ne l'est que sur sa propre page). */
  export function isActiveLink(href: string, path: string): boolean {
    if (href === "/manage") return path === "/manage";
    return path === href || path.startsWith(href + "/");
  }
</script>

<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import IconButton from "./IconButton.svelte";
  import { IconChevronDown, IconLayers, IconLogout, IconSearch } from "./icons";

  /**
   * Barre latérale : fond --night, logo Fraunces, loupe (ouvre la recherche ⌘K),
   * groupes en petites capitales, élément actif (aria-current), compteurs dorés,
   * groupe « Référentiels » repliable, email + déconnexion en bas.
   */
  export let sections: NavSection[] = [];
  export let path = "";
  export let email = "";
  export let id = "manage-sidebar";

  const dispatch = createEventDispatcher<{ search: void; logout: void }>();

  let expanded: Record<string, boolean> = {};
  $: for (const s of sections) {
    if (s.collapsible && expanded[s.collapsible] === undefined) {
      expanded[s.collapsible] = s.links.some((l) => isActiveLink(l.href, path));
    }
  }
</script>

<nav {id} class="sidebar" aria-label="Navigation de la gestion">
  <div class="brand-row">
    <a href="/manage" class="brand" aria-label="Mezzaterra — tableau de bord">
      <span class="brand-mezza">Mezza</span>
      <span class="brand-terra">TERRA</span>
    </a>
    <IconButton label="Rechercher (⌘K)" variant="dark" on:click={() => dispatch("search")}>
      <IconSearch size={18} strokeWidth={1.75} />
    </IconButton>
  </div>

  <div class="nav-scroll">
    {#each sections as section}
      {#if section.collapsible}
        <hr class="nav-sep" />
        <button
          type="button"
          class="nav-item collapse-toggle"
          aria-expanded={expanded[section.collapsible]}
          aria-controls="nav-{section.collapsible}"
          on:click={() => (expanded[section.collapsible!] = !expanded[section.collapsible!])}
        >
          <IconLayers size={18} strokeWidth={1.75} aria-hidden="true" />
          <span class="nav-label">{section.collapsible}</span>
          <span class="chev" class:open={expanded[section.collapsible]}><IconChevronDown size={16} strokeWidth={1.75} /></span>
        </button>
        {#if expanded[section.collapsible]}
          <ul id="nav-{section.collapsible}" class="nav-list sub">
            {#each section.links as link}
              <li>
                <a href={link.href} class="nav-item" class:active={isActiveLink(link.href, path)} aria-current={isActiveLink(link.href, path) ? "page" : undefined}>
                  <svelte:component this={link.icon} size={18} strokeWidth={1.75} aria-hidden="true" />
                  <span class="nav-label">{link.label}</span>
                </a>
              </li>
            {/each}
          </ul>
        {/if}
      {:else}
        {#if section.title}<p class="group-title">{section.title}</p>{/if}
        <ul class="nav-list">
          {#each section.links as link}
            <li>
              <a href={link.href} class="nav-item" class:active={isActiveLink(link.href, path)} aria-current={isActiveLink(link.href, path) ? "page" : undefined}>
                <svelte:component this={link.icon} size={18} strokeWidth={1.75} aria-hidden="true" />
                <span class="nav-label">{link.label}</span>
                {#if link.count}
                  <span class="count" aria-label="{link.count} en attente">{link.count}</span>
                {/if}
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    {/each}
  </div>

  <div class="foot">
    <span class="email">{email}</span>
    <button type="button" class="logout" on:click={() => dispatch("logout")}>
      <IconLogout size={16} strokeWidth={1.75} aria-hidden="true" />
      Se déconnecter
    </button>
  </div>
</nav>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    width: 240px;
    height: 100%;
    background: var(--night);
    color: #fff;
    font-family: var(--font-sans);
    font-size: 14px;
  }

  .brand-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 20px 12px 16px 24px;
  }

  .brand {
    display: flex;
    flex-direction: column;
    line-height: 1;
    color: #fff;
    text-decoration: none;
  }

  .brand-mezza {
    font-family: var(--font-serif);
    font-style: italic;
    font-weight: 600;
    font-size: 26px;
    letter-spacing: -0.01em;
  }

  .brand-terra {
    margin-top: 2px;
    padding-left: 16px;
    font-family: var(--font-serif);
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.32em;
  }

  .nav-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 0 12px 12px;
  }

  .group-title {
    margin: 16px 12px 6px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--night-label);
  }

  /* Sépare les référentiels des groupes métier (sinon ils semblent faire partie des Achats). */
  .nav-sep {
    margin: 16px 12px 12px;
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
  }

  .nav-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .nav-list.sub {
    margin-top: 2px;
    padding-left: 8px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 36px;
    padding: 6px 12px;
    border: none;
    border-radius: var(--r-sm);
    background: none;
    color: rgba(255, 255, 255, 0.86);
    font: inherit;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
  }

  .nav-item:hover {
    background: rgba(255, 255, 255, 0.07);
    color: #fff;
  }

  .nav-item.active {
    background: var(--night-active);
    color: #fff;
    font-weight: 600;
  }

  .nav-item :global(svg) {
    flex-shrink: 0;
    opacity: 0.9;
  }

  .nav-item:focus-visible {
    outline: 2px solid #fff;
    outline-offset: -2px;
  }

  .nav-label {
    flex: 1;
    min-width: 0;
    line-height: 18px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .count {
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    border-radius: var(--r-pill);
    background: var(--gold);
    color: #3b2a00;
    font-size: 11px;
    font-weight: 700;
    display: inline-grid;
    place-items: center;
  }

  .chev {
    display: flex;
    transition: transform 0.15s ease;
  }

  .chev.open {
    transform: rotate(180deg);
  }

  .foot {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding: 14px 12px 14px;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
  }

  .email {
    max-width: 100%;
    padding: 0 12px;
    font-size: 13px;
    line-height: 18px;
    color: rgba(255, 255, 255, 0.86);
    overflow-wrap: anywhere;
  }

  .logout {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 36px;
    padding: 0 12px;
    border: none;
    border-radius: var(--r-sm);
    background: none;
    color: rgba(255, 255, 255, 0.86);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }

  .logout:hover {
    background: rgba(255, 255, 255, 0.07);
    color: #fff;
  }

  .logout:focus-visible {
    outline: 2px solid #fff;
    outline-offset: -2px;
  }

  @media (max-width: 767px) {
    .logout {
      min-height: 44px;
    }
  }
</style>
