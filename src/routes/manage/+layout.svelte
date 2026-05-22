<script lang="ts">
  import "$lib/styles/manage-shared.css";
  import { supabase } from "$lib/supabase";
  import { afterNavigate, goto } from "$app/navigation";
  import { onMount, setContext } from "svelte";
  import { writable } from "svelte/store";
  import { page } from "$app/stores";

  const userStore = writable<any>(null);
  const checkingAuthStore = writable(true);

  let mobileNavOpen = false;

  setContext("auth", {
    user: userStore,
    checkingAuth: checkingAuthStore,
  });

  afterNavigate(() => {
    mobileNavOpen = false;
  });

  function toggleMobileNav() {
    mobileNavOpen = !mobileNavOpen;
  }

  function closeMobileNav() {
    mobileNavOpen = false;
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

      if (!currentUser && $page.url.pathname !== "/manage") {
        goto("/manage");
      }

      checkingAuthStore.set(false);

      supabase.auth.onAuthStateChange((event, session) => {
        const user = session?.user ?? null;
        userStore.set(user);
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
        <h2>Gestion</h2>
      </div>
      <ul class="nav-list">
        <li>
          <a href="/manage" class:active={$page.url.pathname === "/manage"}>
            <span class="icon">🏠</span>
            Tableau de bord
          </a>
        </li>

        <li class="nav-divider">
          <span class="nav-divider-text">Produits</span>
        </li>
        <li>
          <a
            href="/manage/wines"
            class:active={$page.url.pathname === "/manage/wines"}
          >
            <span class="icon">🍷</span>
            Vins
          </a>
        </li>
        <li>
          <a
            href="/manage/stock"
            class:active={$page.url.pathname === "/manage/stock"}
          >
            <span class="icon">📦</span>
            Stock
          </a>
        </li>

        <li class="nav-divider">
          <span class="nav-divider-text">Dégustations</span>
        </li>
        <li>
          <a
            href="/manage/tastings"
            class:active={$page.url.pathname === "/manage/tastings"}
          >
            <span class="icon">🥂</span>
            Dégustations
          </a>
        </li>
        <li>
          <a
            href="/manage/documents"
            class:active={$page.url.pathname === "/manage/documents"}
          >
            <span class="icon">📄</span>
            Documents
          </a>
        </li>

        <li class="nav-divider">
          <span class="nav-divider-text">Ventes</span>
        </li>
        <li>
          <a
            href="/manage/customers"
            class:active={$page.url.pathname === "/manage/customers"}
          >
            <span class="icon">👥</span>
            Clients
          </a>
        </li>
        <li>
          <a
            href="/manage/sales"
            class:active={$page.url.pathname === "/manage/sales"}
          >
            <span class="icon">💵</span>
            Ventes
          </a>
        </li>

        <li class="nav-divider">
          <span class="nav-divider-text">Achats</span>
        </li>
        <li>
          <a
            href="/manage/orders"
            class:active={$page.url.pathname === "/manage/orders"}
          >
            <span class="icon">📋</span>
            Commandes
          </a>
        </li>
        <li>
          <a
            href="/manage/suppliers"
            class:active={$page.url.pathname === "/manage/suppliers"}
          >
            <span class="icon">📦</span>
            Fournisseurs
          </a>
        </li>
        <li>
          <a
            href="/manage/transports"
            class:active={$page.url.pathname === "/manage/transports"}
          >
            <span class="icon">🚛</span>
            Transports
          </a>
        </li>
        <li>
          <a
            href="/manage/transporters"
            class:active={$page.url.pathname === "/manage/transporters"}
          >
            <span class="icon">🚚</span>
            Transporteurs
          </a>
        </li>

        <li class="nav-divider">
          <span class="nav-divider-text">Références</span>
        </li>
        <li>
          <a
            href="/manage/appellations"
            class:active={$page.url.pathname === "/manage/appellations"}
          >
            <span class="icon">📍</span>
            Appellations
          </a>
        </li>
        <li>
          <a
            href="/manage/grapes"
            class:active={$page.url.pathname === "/manage/grapes"}
          >
            <span class="icon">🍇</span>
            Cépages
          </a>
        </li>
        <li>
          <a
            href="/manage/labels"
            class:active={$page.url.pathname === "/manage/labels"}
          >
            <span class="icon">🏷️</span>
            Labels
          </a>
        </li>
        <li>
          <a
            href="/manage/pairings"
            class:active={$page.url.pathname === "/manage/pairings"}
          >
            <span class="icon">🧀</span>
            Pairings
          </a>
        </li>
        <li>
          <a
            href="/manage/wineries"
            class:active={$page.url.pathname === "/manage/wineries"}
          >
            <span class="icon">🏰</span>
            Vignobles
          </a>
        </li>

        <li class="nav-divider">
          <span class="nav-divider-text">Géographie</span>
        </li>
        <li>
          <a
            href="/manage/countries"
            class:active={$page.url.pathname === "/manage/countries"}
          >
            <span class="icon">🌍</span>
            Pays
          </a>
        </li>
        <li>
          <a
            href="/manage/regions"
            class:active={$page.url.pathname === "/manage/regions"}
          >
            <span class="icon">🗺️</span>
            Régions
          </a>
        </li>
      </ul>
      <div class="sidebar-footer">
        <div class="user-info">
          <span class="user-email">{$userStore?.email}</span>
        </div>
        <button class="logout-btn" on:click={handleLogout}>
          <span class="icon">🚪</span>
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
      </header>
      <main class="main-content">
        <slot />
      </main>
    </div>
  </div>
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
    border-top: 4px solid #007bff;
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
    background: #2c3e50;
    color: white;
    position: fixed;
    height: 100vh;
    display: flex;
    flex-direction: column;
    left: 0;
    top: 0;
  }

  .sidebar-header {
    padding: 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .sidebar-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: white;
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
    padding: 1rem 1.5rem;
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
    border-left: 3px solid #3498db;
  }

  .nav-list .icon {
    font-size: 1.2rem;
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
    padding: 0.75rem;
    background: rgba(231, 76, 60, 0.9);
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
    background: rgba(192, 57, 43, 1);
  }

  .logout-btn .icon {
    font-size: 1rem;
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
