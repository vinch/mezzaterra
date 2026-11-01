<script lang="ts">
  import "$lib/styles/manage-shared.css";
  import { supabase } from "$lib/supabase";
  import { countNewRequests } from "$lib/wishes";
  import { afterNavigate, goto } from "$app/navigation";
  import { onMount, setContext, type Snippet } from "svelte";
  import { writable } from "svelte/store";
  import { page } from "$app/stores";
  import CommandPalette from "$lib/components/manage/CommandPalette.svelte";
  import Sidebar, { isActiveLink, type NavSection } from "$lib/ui/Sidebar.svelte";
  import IconButton from "$lib/ui/IconButton.svelte";
  import Spinner from "$lib/ui/Spinner.svelte";
  import {
    IconBox,
    IconCastle,
    IconChart,
    IconClipboard,
    IconFactory,
    IconFile,
    IconGlasses,
    IconGlobe,
    IconHome,
    IconImage,
    IconInbox,
    IconMail,
    IconMap,
    IconMapPin,
    IconMenu,
    IconProduct,
    IconReceipt,
    IconRoute,
    IconSearch,
    IconTag,
    IconTruck,
    IconUsers,
    IconVariety,
    IconX,
  } from "$lib/ui/icons";
  import IconPlate from "@lucide/svelte/icons/utensils-crossed";
  interface Props {
    children?: Snippet;
  }

  let { children }: Props = $props();

  const userStore = writable<any>(null);
  const checkingAuthStore = writable(true);
  /** `false` uniquement si la base confirme que l'utilisateur n'est pas admin. */
  const isAdminStore = writable<boolean | null>(null);

  let moreOpen = $state(false);
  let paletteOpen = $state(false);
  let newRequests = $state(0);
  let pendingSales = $state(0);

  setContext("auth", {
    user: userStore,
    checkingAuth: checkingAuthStore,
  });
  /* Les pages qui créent, suppriment ou changent le statut d'une vente rafraîchissent les compteurs. */
  setContext("manage", { refreshCounts: () => void refreshCounts() });

  let sections = $derived([
    { title: null, links: [{ href: "/manage", label: "Tableau de bord", icon: IconHome }] },
    {
      title: "Produits",
      links: [
        { href: "/manage/products", label: "Produits", icon: IconProduct },
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
      collapsible: "Référentiels",
      links: [
        { href: "/manage/appellations", label: "Appellations", icon: IconMapPin },
        { href: "/manage/varieties", label: "Cépages et variétés", icon: IconVariety },
        { href: "/manage/labels", label: "Labels", icon: IconTag },
        { href: "/manage/pairings", label: "Accords", icon: IconPlate },
        { href: "/manage/producers", label: "Domaines", icon: IconCastle },
        { href: "/manage/countries", label: "Pays", icon: IconGlobe },
        { href: "/manage/regions", label: "Régions", icon: IconMap },
      ],
    },
  ] satisfies NavSection[]);

  let allLinks = $derived(sections.flatMap((s) => s.links));
  /* Pilotage en direct : plein écran sur mobile (il a son propre en-tête et sa barre « Vin suivant »). */
  let immersive = $derived(/^\/manage\/tastings\/[^/]+\/live$/.test($page.url.pathname));

  /* Barre d'onglets mobile. */
  let tabs = $derived([
    { href: "/manage", label: "Accueil", icon: IconHome },
    { href: "/manage/sales", label: "Ventes", icon: IconReceipt, count: pendingSales },
    { href: "/manage/tastings", label: "Dégustation", icon: IconGlasses },
    { href: "/manage/customers", label: "Clients", icon: IconUsers },
  ]);

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
    const [{ count }, requests] = await Promise.all([
      supabase.from("sale").select("id", { count: "exact", head: true }).eq("status", "pending"),
      countNewRequests(),
    ]);
    pendingSales = count ?? 0;
    newRequests = requests.wishes + requests.messages;
  }

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") moreOpen = false;
    };
    window.addEventListener("keydown", onKey);
    let unsubscribeAuth: (() => void) | null = null;
    let destroyed = false;

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
      if (destroyed) return;

      let knownUserId = currentUser?.id;
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        const user = session?.user ?? null;
        /* INITIAL_SESSION et TOKEN_REFRESHED pour le même utilisateur : rien à recharger. */
        if ((event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") && user?.id === knownUserId) return;
        knownUserId = user?.id;
        userStore.set(user);
        void checkAdmin(user).then(refreshCounts);
        if (!user && $page.url.pathname !== "/manage") {
          goto("/manage");
        }
      });
      unsubscribeAuth = () => data.subscription.unsubscribe();
    })();

    return () => {
      destroyed = true;
      unsubscribeAuth?.();
      window.removeEventListener("keydown", onKey);
    };
  });

  async function handleLogout() {
    await supabase.auth.signOut();
    goto("/manage");
  }
</script>

{#if $checkingAuthStore}
  <div class="app loading-container">
    <Spinner size={36} />
  </div>
{:else if $userStore && $isAdminStore === false}
  <div class="app loading-container denied">
    <h1 class="t-page-title">Accès réservé</h1>
    <p>Le compte <strong>{$userStore.email}</strong> n’a pas accès à la gestion.</p>
    <button class="denied-logout" onclick={handleLogout}>Se déconnecter</button>
  </div>
{:else if $userStore}
  <div class="app admin-layout" class:more-open={moreOpen} class:immersive>
    <div class="sidebar-slot">
      <Sidebar
        {sections}
        path={$page.url.pathname}
        email={$userStore?.email ?? ""}
        onsearch={() => (paletteOpen = true)}
        onlogout={handleLogout}
      />
    </div>

    <button type="button" class="more-backdrop" aria-label="Fermer le menu" tabindex="-1" onclick={() => (moreOpen = false)}></button>

    <div class="main-column">
      <header class="mobile-topbar">
        <a href="/manage" class="mobile-brand" aria-label="Mezzaterra — accueil">
          <span class="m-mezza">Mezza</span><span class="m-terra">TERRA</span>
        </a>
        <IconButton label="Rechercher" variant="dark" onclick={() => (paletteOpen = true)}>
          <IconSearch size={20} strokeWidth={1.75} />
        </IconButton>
      </header>
      <main class="main-content">
        <!-- Une page par chemin : sans ce key, aller d'un client, d'un lot ou d'une
             dégustation à un autre (⌘K) réutilisait la page, encore liée au précédent. -->
        {#key $page.url.pathname}
          {@render children?.()}
        {/key}
      </main>
    </div>

    <nav class="tabbar" aria-label="Navigation principale">
      {#each tabs as tab}
        <a
          href={tab.href}
          class="tab"
          class:active={isActiveLink(tab.href, $page.url.pathname) && !moreOpen}
          aria-current={isActiveLink(tab.href, $page.url.pathname) ? "page" : undefined}
        >
          <span class="tab-icon">
            <tab.icon size={22} strokeWidth={1.75} aria-hidden="true" />
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
        onclick={() => (moreOpen = !moreOpen)}
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
  <div class="app">
    {#key $page.url.pathname}
      {@render children?.()}
    {/key}
  </div>
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
      background: var(--overlay);
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
      color: #fff;
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
      color: rgba(255, 255, 255, 0.78);
      font: inherit;
      font-size: 11px;
      font-weight: 500;
      text-decoration: none;
      cursor: pointer;
    }

    .tab.active {
      color: var(--gold);
      font-weight: 600;
    }

    .tab-icon {
      position: relative;
      display: flex;
    }

    .immersive .mobile-topbar,
    .immersive .tabbar {
      display: none;
    }

    .immersive .main-column {
      padding-bottom: 0;
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
