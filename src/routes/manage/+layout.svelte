<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { goto } from "$app/navigation";
  import { onMount, setContext } from "svelte";
  import { writable } from "svelte/store";
  import { page } from "$app/stores";

  const userStore = writable<any>(null);
  const checkingAuthStore = writable(true);

  setContext("auth", {
    user: userStore,
    checkingAuth: checkingAuthStore,
  });

  onMount(async () => {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    userStore.set(currentUser);

    // Si pas d'utilisateur et pas sur la page de login, rediriger
    if (!currentUser && $page.url.pathname !== "/manage") {
      goto("/manage");
    }

    checkingAuthStore.set(false);

    // Écouter les changements d'authentification
    supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null;
      userStore.set(user);
      if (!user && $page.url.pathname !== "/manage") {
        goto("/manage");
      }
    });
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
  <div class="admin-layout">
    <nav class="sidebar">
      <div class="sidebar-header">
        <h2>Gestion</h2>
      </div>
      <ul class="nav-list">
        <li>
          <a href="/manage" class:active={$page.url.pathname === "/manage"}>
            <span class="icon">🏠</span>
            Accueil
          </a>
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
      </ul>
      <div class="sidebar-footer">
        <div class="user-info">
          <span class="user-email">{$userStore?.email}</span>
        </div>
        <button class="logout-btn" on:click={handleLogout}>
          Déconnexion
        </button>
      </div>
    </nav>
    <main class="main-content">
      <slot />
    </main>
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

  .sidebar {
    width: 250px;
    background: #2c3e50;
    color: white;
    position: fixed;
    height: 100vh;
    display: flex;
    flex-direction: column;
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
    padding: 0.5rem;
    background: transparent;
    color: rgba(255, 255, 255, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s;
  }

  .logout-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .main-content {
    margin-left: 250px;
    flex: 1;
    background: #f8f9fa;
    min-height: 100vh;
  }
</style>
