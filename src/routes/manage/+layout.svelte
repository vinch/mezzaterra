<script lang="ts">
  import "$lib/styles/manage-shared.css";
  import { supabase } from "$lib/supabase";
  import { afterNavigate, goto } from "$app/navigation";
  import { onMount, setContext } from "svelte";
  import { writable } from "svelte/store";
  import { page } from "$app/stores";
  import CommandPalette from "$lib/components/manage/CommandPalette.svelte";
  import Sidebar, { type NavSection } from "$lib/ui/Sidebar.svelte";
  import IconButton from "$lib/ui/IconButton.svelte";
  import { hasTable } from "$lib/features";
  import {
    IconBox,
    IconCastle,
    IconChart,
    IconClipboard,
    IconFactory,
    IconFile,
    IconGlasses,
    IconGlobe,
    IconGrape,
    IconHome,
    IconImage,
    IconInbox,
    IconMail,
    IconMap,
    IconMapPin,
    IconMenu,
    IconReceipt,
    IconRoute,
    IconSearch,
    IconTag,
    IconTruck,
    IconUsers,
    IconWine,
    IconX,
  } from "$lib/ui/icons";
  import IconPlate from "@lucide/svelte/icons/utensils-crossed";

  const userStore = writable<any>(null);
  const checkingAuthStore = writable(true);
  /** `false` uniquement si la base confirme que l'utilisateur n'est pas admin. */
  const isAdminStore = writable<boolean | null>(null);

  let moreOpen = false;
  let paletteOpen = false;
  let newRequests = 0;
  let pendingSales = 0;

  setContext("auth", {
    user: userStore,
    checkingAuth: checkingAuthStore,
  });

  $: sections = [
    { title: null, links: [{ href: "/manage", label: "Tableau de bord", icon: IconHome }] },
    {
      title: "Produits",
      links: [
        { href: "/manage/wines", label: "Vins", icon: IconWine },
        { href: "/manage/stock", label: "Stock", icon: IconBox },
      ],
    },
    {
      title: "Dégustations",
      links: [
        { href: "/manage/tastings", label: "Dégustations", icon: IconGlasses },
        { href: "/manage/documents", label: "Documents", icon: IconFile },
        { href: "/manage/tasting-flyer", label: "Visuel dégustation", icon: IconImage },
      ],
    },
    {
      title: "Ventes",
      links: [
        { href: "/manage/requests", label: "Demandes", icon: IconInbox, count: newRequests },
        { href: "/manage/customers", label: "Clients", icon: IconUsers },
        { href: "/manage/sales", label: "Ventes", icon: IconReceipt, count: pendingSales },
        { href: "/manage/campaigns", label: "Campagnes", icon: IconMail },
      ],
    },
    {
      title: "Pilotage",
      links: [{ href: "/manage/insights", label: "Analyses", icon: IconChart }],
    },
    {
      title: "Achats",
      links: [
        { href: "/manage/orders", label: "Commandes", icon: IconClipboard },
        { href: "/manage/suppliers", label: "Fournisseurs", icon: IconFactory },
        { href: "/manage/transports", label: "Transports", icon: IconRoute },
        { href: "/manage/transporters", label: "Transporteurs", icon: IconTruck },
      ],
    },
    {
      title: "Référentiels",
      collapsible: "Références, géographie",
      links: [
        { href: "/manage/appellations", label: "Appellations", icon: IconMapPin },
        { href: "/manage/grapes", label: "Cépages", icon: IconGrape },
        { href: "/manage/labels", label: "Labels", icon: IconTag },
        { href: "/manage/pairings", label: "Accords", icon: IconPlate },
        { href: "/manage/wineries", label: "Vignobles", icon: IconCastle },
        { href: "/manage/countries", label: "Pays", icon: IconGlobe },
        { href: "/manage/regions", label: "Régions", icon: IconMap },
      ],
    },
  ] satisfies NavSection[];

  $: allLinks = sections.flatMap((s) => s.links);

  /* Barre d'onglets mobile. */
  $: tabs = [
    { href: "/manage", label: "Accueil", icon: IconHome },
    { href: "/manage/sales", label: "Ventes", icon: IconReceipt, count: pendingSales },
    { href: "/manage/tastings", label: "Dégustation", icon: IconGlasses },
    { href: "/manage/customers", label: "Clients", icon: IconUsers },
  ];

  function isActive(href: string, path: string): boolean {
    if (href === "/manage") return path === "/manage";
    return path === href || path.startsWith(href + "/");
  }

  afterNavigate(() => {
    moreOpen = false;
    void refreshCounts();
  });

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

  async function refreshCounts() {
    if (!$userStore || $isAdminStore === false) return;
    const { count } = await supabase
      .from("sale")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    pendingSales = count ?? 0;
    if (!(await hasTable("wish_request"))) return;
    const { count: wishes } = await supabase
      .from("wish_request")
      .select("id", { count: "exact", head: true })
      .eq("status", "new");
    newRequests = wishes ?? 0;
  }

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") moreOpen = false;
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
      void refreshCounts();

      supabase.auth.onAuthStateChange((event, session) => {
        const user = session?.user ?? null;
        userStore.set(user);
        void checkAdmin(user).then(refreshCounts);
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
  <div class="app loading-container">
    <div class="spinner"></div>
    <p>Chargement…</p>
  </div>
{:else if $userStore && $isAdminStore === false}
  <div class="app loading-container denied">
    <h1 class="t-page-title">Accès réservé</h1>
    <p>Le compte <strong>{$userStore.email}</strong> n’a pas accès à la gestion.</p>
    <p><a href="/carnet">Voir mon carnet de dégustation</a></p>
    <button class="denied-logout" on:click={handleLogout}>Se déconnecter</button>
  </div>
{:else if $userStore}
  <div class="app admin-layout" class:more-open={moreOpen}>
    <div class="sidebar-slot">
      <Sidebar
        {sections}
        path={$page.url.pathname}
        email={$userStore?.email ?? ""}
        on:search={() => (paletteOpen = true)}
        on:logout={handleLogout}
      />
    </div>

    <button type="button" class="more-backdrop" aria-label="Fermer le menu" tabindex="-1" on:click={() => (moreOpen = false)}></button>

    <div class="main-column">
      <header class="mobile-topbar">
        <a href="/manage" class="mobile-brand" aria-label="Mezzaterra — accueil">
          <span class="m-mezza">Mezza</span><span class="m-terra">TERRA</span>
        </a>
        <IconButton label="Rechercher" variant="dark" on:click={() => (paletteOpen = true)}>
          <IconSearch size={20} strokeWidth={1.75} />
        </IconButton>
      </header>
      <main class="main-content">
        <slot />
      </main>
    </div>

    <nav class="tabbar" aria-label="Navigation principale">
      {#each tabs as tab}
        <a
          href={tab.href}
          class="tab"
          class:active={isActive(tab.href, $page.url.pathname) && !moreOpen}
          aria-current={isActive(tab.href, $page.url.pathname) ? "page" : undefined}
        >
          <span class="tab-icon">
            <svelte:component this={tab.icon} size={22} strokeWidth={1.75} aria-hidden="true" />
            {#if tab.count}<span class="tab-count" aria-label="{tab.count} en attente">{tab.count}</span>{/if}
          </span>
          {tab.label}
        </a>
      {/each}
      <button
        type="button"
        class="tab"
        class:active={moreOpen}
        aria-expanded={moreOpen}
        aria-controls="manage-sidebar"
        on:click={() => (moreOpen = !moreOpen)}
      >
        <span class="tab-icon">
          {#if moreOpen}<IconX size={22} strokeWidth={1.75} />{:else}<IconMenu size={22} strokeWidth={1.75} />{/if}
        </span>
        Plus
      </button>
    </nav>
  </div>
  <CommandPalette bind:open={paletteOpen} pages={allLinks} />
{:else}
  <div class="app"><slot /></div>
{/if}

<style>
  .loading-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: var(--paper);
    color: var(--ink-2);
  }

  .spinner {
    width: 36px;
    height: 36px;
    border: 3px solid var(--border);
    border-top-color: var(--teal-600);
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .denied {
    text-align: center;
    padding: 32px;
    color: var(--ink);
  }

  .denied p {
    margin: 4px 0;
  }

  .denied-logout {
    margin-top: 16px;
    height: 40px;
    padding: 0 16px;
    border: none;
    border-radius: var(--r-sm);
    background: var(--teal-600);
    color: #fff;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .admin-layout {
    display: flex;
    min-height: 100vh;
    background: var(--paper);
  }

  .sidebar-slot {
    position: fixed;
    inset: 0 auto 0 0;
    width: 240px;
    z-index: 300;
  }

  .main-column {
    flex: 1;
    min-width: 0;
    margin-left: 240px;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .main-content {
    flex: 1;
    min-width: 0;
  }

  .mobile-topbar,
  .tabbar,
  .more-backdrop {
    display: none;
  }

  /* ——— Mobile (< 768 px) : en-tête sombre + barre d'onglets ——— */
  @media (max-width: 767px) {
    .main-column {
      margin-left: 0;
      padding-bottom: calc(64px + env(safe-area-inset-bottom));
    }

    .sidebar-slot {
      width: min(300px, 86vw);
      transform: translateX(-100%);
      transition: transform 0.22s ease;
      bottom: calc(64px + env(safe-area-inset-bottom));
      box-shadow: var(--shadow-pop);
    }

    .more-open .sidebar-slot {
      transform: none;
    }

    .more-backdrop {
      display: block;
      position: fixed;
      inset: 0 0 calc(64px + env(safe-area-inset-bottom)) 0;
      z-index: 250;
      border: none;
      background: rgba(28, 44, 46, 0.5);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
    }

    .more-open .more-backdrop {
      opacity: 1;
      pointer-events: auto;
    }

    .mobile-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 200;
      height: 56px;
      padding: 0 8px 0 16px;
      background: var(--night);
    }

    .mobile-brand {
      display: flex;
      align-items: baseline;
      gap: 8px;
      color: #fff !important;
      text-decoration: none;
    }

    .m-mezza {
      font-family: var(--font-serif);
      font-style: italic;
      font-weight: 600;
      font-size: 22px;
    }

    .m-terra {
      font-family: var(--font-serif);
      font-weight: 600;
      font-size: 10px;
      letter-spacing: 0.3em;
    }

    .tabbar {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 400;
      height: calc(64px + env(safe-area-inset-bottom));
      padding-bottom: env(safe-area-inset-bottom);
      background: var(--night);
    }

    .tab {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      min-height: 44px;
      border: none;
      background: none;
      color: rgba(255, 255, 255, 0.78) !important;
      font: inherit;
      font-size: 11px;
      font-weight: 500;
      text-decoration: none;
      cursor: pointer;
    }

    .tab.active {
      color: var(--gold) !important;
      font-weight: 600;
    }

    .tab-icon {
      position: relative;
      display: flex;
    }

    .tab-count {
      position: absolute;
      top: -4px;
      right: -10px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      border-radius: 999px;
      background: var(--gold);
      color: #3b2a00;
      font-size: 10px;
      font-weight: 700;
      display: grid;
      place-items: center;
    }
  }
</style>
