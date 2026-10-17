<script lang="ts">
  import "$lib/styles/manage-shared.css";
  import { supabase } from "$lib/supabase";
  import { afterNavigate, goto } from "$app/navigation";
  import { onMount, setContext } from "svelte";
  import { writable } from "svelte/store";
  import { page } from "$app/stores";
  import Icon, { type IconName } from "$lib/components/Icon.svelte";
  import CommandPalette from "$lib/components/manage/CommandPalette.svelte";
  import { hasTable } from "$lib/features";

  const userStore = writable<any>(null);
  const checkingAuthStore = writable(true);
  /** `false` uniquement si la base confirme que l'utilisateur n'est pas admin. */
  const isAdminStore = writable<boolean | null>(null);

  let mobileNavOpen = false;
  let paletteOpen = false;
  let newRequests = 0;

  setContext("auth", {
    user: userStore,
    checkingAuth: checkingAuthStore,
  });

  type NavLink = { href: string; label: string; icon: IconName; badge?: "requests" };
  type NavSection = { title: string | null; links: NavLink[] };

  const NAV: NavSection[] = [
    { title: null, links: [{ href: "/manage", label: "Tableau de bord", icon: "home" }] },
    {
      title: "Produits",
      links: [
        { href: "/manage/wines", label: "Vins", icon: "wine" },
        { href: "/manage/stock", label: "Stock", icon: "box" },
      ],
    },
    {
      title: "Dégustations",
      links: [
        { href: "/manage/tastings", label: "Dégustations", icon: "glasses" },
        { href: "/manage/documents", label: "Documents", icon: "file" },
        { href: "/manage/tasting-flyer", label: "Visuel dégustation", icon: "image" },
      ],
    },
    {
      title: "Ventes",
      links: [
        { href: "/manage/requests", label: "Demandes", icon: "inbox", badge: "requests" },
        { href: "/manage/customers", label: "Clients", icon: "users" },
        { href: "/manage/sales", label: "Ventes", icon: "cash" },
        { href: "/manage/campaigns", label: "Campagnes", icon: "mail" },
      ],
    },
    {
      title: "Pilotage",
      links: [{ href: "/manage/insights", label: "Analyses", icon: "chart" }],
    },
    {
      title: "Achats",
      links: [
        { href: "/manage/orders", label: "Commandes", icon: "clipboard" },
        { href: "/manage/suppliers", label: "Fournisseurs", icon: "factory" },
        { href: "/manage/transports", label: "Transports", icon: "route" },
        { href: "/manage/transporters", label: "Transporteurs", icon: "truck" },
      ],
    },
    {
      title: "Références",
      links: [
        { href: "/manage/appellations", label: "Appellations", icon: "pin" },
        { href: "/manage/grapes", label: "Cépages", icon: "grape" },
        { href: "/manage/labels", label: "Labels", icon: "tag" },
        { href: "/manage/pairings", label: "Accords", icon: "plate" },
        { href: "/manage/wineries", label: "Vignobles", icon: "castle" },
      ],
    },
    {
      title: "Géographie",
      links: [
        { href: "/manage/countries", label: "Pays", icon: "globe" },
        { href: "/manage/regions", label: "Régions", icon: "map" },
      ],
    },
  ];

  const allLinks = NAV.flatMap((s) => s.links);

  function isActive(href: string, path: string): boolean {
    if (href === "/manage") return path === "/manage";
    return path === href || path.startsWith(href + "/");
  }

  afterNavigate(() => {
    mobileNavOpen = false;
    void refreshRequestBadge();
  });

  function toggleMobileNav() {
    mobileNavOpen = !mobileNavOpen;
  }

  function closeMobileNav() {
    mobileNavOpen = false;
  }

  async function checkAdmin(user: any) {
    if (!user) {
      isAdminStore.set(null);
      return;
    }
    try {
      const { data, error } = await supabase.rpc("is_admin");
      /* En cas d'erreur on ne bloque pas : la RLS protège de toute façon les données. */
      isAdminStore.set(error ? null : data === false ? false : true);
    } catch {
      isAdminStore.set(null);
    }
  }

  async function refreshRequestBadge() {
    if (!$userStore || $isAdminStore === false) return;
    if (!(await hasTable("wish_request"))) return;
    const { count } = await supabase
      .from("wish_request")
      .select("id", { count: "exact", head: true })
      .eq("status", "new");
    newRequests = count ?? 0;
  }

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobileNav();
    };
    window.addEventListener("keydown", onKey);

    void (async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      userStore.set(currentUser);
      await checkAdmin(currentUser);

      if (!currentUser && $page.url.pathname !== "/manage") {
        goto("/manage");
      }

      checkingAuthStore.set(false);
      void refreshRequestBadge();

      supabase.auth.onAuthStateChange((event, session) => {
        const user = session?.user ?? null;
        userStore.set(user);
        void checkAdmin(user).then(refreshRequestBadge);
        if (!user && $page.url.pathname !== "/manage") {
          goto("/manage");
        }
      });
    })();

    return () => window.removeEventListener("keydown", onKey);
  });

  async function handleLogout() {
    await supabase.auth.signOut();
    goto("/manage");
  }
</script>

{#if $checkingAuthStore}
  <div class="loading-container">
    <div class="spinner"></div>
    <p>Chargement...</p>
  </div>
{:else if $userStore && $isAdminStore === false}
  <div class="loading-container denied">
    <h1>Accès réservé</h1>
    <p>Le compte <strong>{$userStore.email}</strong> n’a pas accès à la gestion.</p>
    <p><a href="/carnet">Voir mon carnet de dégustation</a></p>
    <button class="logout-btn denied-logout" on:click={handleLogout}>Se déconnecter</button>
  </div>
{:else if $userStore}
  <div class="admin-layout" class:nav-open={mobileNavOpen}>
    <button
      type="button"
      class="nav-backdrop"
      aria-label="Fermer le menu"
      on:click={closeMobileNav}
    ></button>
    <nav
      id="manage-sidebar"
      class="sidebar"
      class:open={mobileNavOpen}
    >
      <div class="sidebar-header">
        <a href="/" class="sidebar-brand" target="_blank" rel="noopener noreferrer" title="Voir le site">
          <img src="/flyer/logo-text.svg" alt="Mezzaterra" />
        </a>
        <button type="button" class="search-trigger" on:click={() => (paletteOpen = true)}>
          <Icon name="search" size="1rem" />
          <span>Rechercher…</span>
          <kbd>⌘K</kbd>
        </button>
      </div>
      <ul class="nav-list">
        {#each NAV as section}
          {#if section.title}
            <li class="nav-divider">
              <span class="nav-divider-text">{section.title}</span>
            </li>
          {/if}
          {#each section.links as link}
            <li>
              <a href={link.href} class:active={isActive(link.href, $page.url.pathname)}>
                <span class="icon"><Icon name={link.icon} /></span>
                <span class="nav-label">{link.label}</span>
                {#if link.badge === "requests" && newRequests > 0}
                  <span class="nav-badge">{newRequests}</span>
                {/if}
              </a>
            </li>
          {/each}
        {/each}
      </ul>
      <div class="sidebar-footer">
        <div class="user-info">
          <span class="user-email">{$userStore?.email}</span>
        </div>
        <button class="logout-btn" on:click={handleLogout}>
          <span class="icon"><Icon name="logout" size="1rem" /></span>
          Déconnexion
        </button>
      </div>
    </nav>
    <div class="main-column">
      <header class="mobile-topbar">
        <button
          type="button"
          class="menu-toggle"
          aria-label={mobileNavOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={mobileNavOpen}
          aria-controls="manage-sidebar"
          on:click={toggleMobileNav}
        >
          <span class="menu-toggle-bar" aria-hidden="true"></span>
          <span class="menu-toggle-bar" aria-hidden="true"></span>
          <span class="menu-toggle-bar" aria-hidden="true"></span>
        </button>
        <span class="mobile-topbar-title">Gestion</span>
        <button type="button" class="mobile-search" on:click={() => (paletteOpen = true)} aria-label="Rechercher">
          <Icon name="search" />
        </button>
      </header>
      <main class="main-content">
        <slot />
      </main>
    </div>
  </div>
  <CommandPalette bind:open={paletteOpen} pages={allLinks} />
{:else}
  <slot />
{/if}

<style>
  .loading-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #f5f5f5;
  }

  .loading-container p {
    margin-top: 1rem;
    color: #666;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #256169;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .admin-layout {
    display: flex;
    min-height: 100vh;
  }

  .nav-backdrop {
    display: none;
  }

  .main-column {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .mobile-topbar {
    display: none;
  }

  .menu-toggle {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 5px;
    width: 2.5rem;
    height: 2.5rem;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: #f1f3f5;
    cursor: pointer;
    flex-shrink: 0;
  }

  .menu-toggle:hover {
    background: #e9ecef;
  }

  .menu-toggle-bar {
    display: block;
    height: 2px;
    width: 1.25rem;
    margin: 0 auto;
    background: #2c3e50;
    border-radius: 1px;
  }

  .mobile-topbar-title {
    font-weight: 600;
    font-size: 1.1rem;
    color: #333;
  }

  .sidebar {
    width: 250px;
    background: linear-gradient(180deg, #1a474d 0%, #143a3f 100%);
    color: white;
    position: fixed;
    height: 100vh;
    display: flex;
    flex-direction: column;
    left: 0;
    top: 0;
  }

  .sidebar-header {
    padding: 1.25rem 1.25rem 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }

  .sidebar-brand img {
    display: block;
    height: 2.1rem;
    width: auto;
    filter: brightness(0) invert(0.95);
  }

  .search-trigger {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.65rem;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.7);
    font: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    text-align: left;
  }

  .search-trigger:hover {
    background: rgba(255, 255, 255, 0.12);
    color: white;
  }

  .search-trigger span {
    flex: 1;
  }

  .search-trigger kbd {
    font-family: inherit;
    font-size: 0.7rem;
    padding: 0.05rem 0.35rem;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .nav-label {
    flex: 1;
  }

  .nav-badge {
    min-width: 1.35rem;
    height: 1.35rem;
    padding: 0 0.35rem;
    border-radius: 999px;
    background: #e4566b;
    color: white;
    font-size: 0.72rem;
    font-weight: 700;
    display: inline-grid;
    place-items: center;
  }

  .mobile-search {
    margin-left: auto;
    width: 2.5rem;
    height: 2.5rem;
    border: none;
    border-radius: 6px;
    background: #f1f3f5;
    color: #2c3e50;
    display: grid;
    place-items: center;
    cursor: pointer;
  }

  .denied {
    text-align: center;
    padding: 2rem;
  }

  .denied h1 {
    margin: 0 0 0.5rem;
    color: #256169;
  }

  .denied a {
    color: #256169;
  }

  .denied-logout {
    background: #256169;
    width: auto;
    margin-top: 1rem;
    padding: 0.6rem 1.2rem;
  }

  .nav-list {
    list-style: none;
    padding: 0;
    margin: 0;
    flex: 1;
    overflow-y: auto;
  }

  .nav-list li {
    margin: 0;
  }

  .nav-divider {
    padding: 0.75rem 1.5rem 0.5rem 1.5rem;
    margin-top: 0.5rem;
  }

  .nav-divider:first-child {
    margin-top: 0;
  }

  .nav-divider-text {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.5);
  }

  .nav-list a {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.7rem 1.5rem;
    border-left: 3px solid transparent;
    color: rgba(255, 255, 255, 0.8);
    text-decoration: none;
    transition: all 0.2s;
  }

  .nav-list a:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .nav-list a.active {
    background: rgba(255, 255, 255, 0.15);
    color: white;
    border-left: 3px solid #e2cf7f;
  }

  .nav-list .icon {
    display: inline-flex;
    opacity: 0.9;
  }

  .sidebar-footer {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding: 1rem 1.5rem;
    background: rgba(0, 0, 0, 0.2);
  }

  .user-info {
    margin-bottom: 0.75rem;
  }

  .user-email {
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.85rem;
    display: block;
  }

  .logout-btn {
    width: 100%;
    padding: 0.65rem;
    background: rgba(255, 255, 255, 0.08);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: background 0.2s;
  }

  .logout-btn:hover {
    background: rgba(192, 57, 43, 0.9);
  }

  .logout-btn .icon {
    display: inline-flex;
  }

  .main-content {
    margin-left: 250px;
    flex: 1;
    background: #f8f9fa;
    min-height: 100vh;
    min-width: 0;
  }

  /* ——— Mobile / tablet ——— */
  @media (max-width: 900px) {
    .nav-backdrop {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 200;
      margin: 0;
      padding: 0;
      border: none;
      background: rgba(0, 0, 0, 0.45);
      cursor: pointer;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
    }

    .admin-layout.nav-open .nav-backdrop {
      opacity: 1;
      pointer-events: auto;
    }

    .sidebar {
      width: min(280px, 88vw);
      z-index: 210;
      transform: translateX(-100%);
      transition: transform 0.22s ease;
      box-shadow: 4px 0 24px rgba(0, 0, 0, 0.15);
    }

    .sidebar.open {
      transform: translateX(0);
    }

    .mobile-topbar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.65rem 1rem;
      background: white;
      border-bottom: 1px solid #e9ecef;
      position: sticky;
      top: 0;
      z-index: 50;
    }

    .main-content {
      margin-left: 0;
    }

    .main-content :global(.page-header) {
      flex-direction: column;
      align-items: stretch;
      gap: 1rem;
      padding: 1rem 1.25rem;
    }

    .main-content :global(.page-header h1) {
      font-size: 1.35rem;
    }

    .main-content :global(.page-header-actions) {
      width: 100%;
      justify-content: flex-start;
    }

    .main-content :global(.page-content) {
      padding: 1rem 1.25rem;
    }

    .main-content :global(.form-grid) {
      grid-template-columns: 1fr;
    }

    .main-content :global(.details-grid) {
      grid-template-columns: 1fr;
    }

    .main-content :global(.table-container) {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .main-content :global(table) {
      min-width: 520px;
    }

    .main-content :global(.filters) {
      grid-template-columns: 1fr;
    }

    .main-content :global(.login-form) {
      margin: 1rem;
      max-width: none;
    }
  }

  @media (max-width: 480px) {
    .main-content :global(.page-header-actions) {
      flex-direction: column;
      align-items: stretch;
    }

    .main-content :global(.page-header-actions .btn-primary),
    .main-content :global(.page-header-actions .btn-secondary),
    .main-content :global(.page-header-actions button) {
      width: 100%;
      justify-content: center;
    }
  }
</style>
