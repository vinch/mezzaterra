<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { getContext, onMount } from "svelte";
  import ManagePageShell from "$lib/components/manage/ManagePageShell.svelte";

  const { user: userStore } = getContext<any>("auth");

  type StatCard = {
    id: string;
    icon: string;
    label: string;
    value: string;
    hint?: string;
    href: string;
    tone: "blue" | "green" | "purple" | "amber" | "rose" | "slate";
  };

  let email = "";
  let error = "";
  let loading = false;
  let magicLinkSent = false;

  let statsLoading = true;
  let statsError = "";
  let statCards: StatCard[] = [];

  function formatInt(n: number): string {
    return new Intl.NumberFormat("fr-FR").format(n);
  }

  function formatEur(n: number): string {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(n);
  }

  function monthStartIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }

  /** Statuts qui comptent dans le CA (aligné sur l’app ventes). */
  const REVENUE_STATUSES = ["paid", "delivered", "closed"];

  async function loadDashboardStats() {
    statsLoading = true;
    statsError = "";

    try {
      const monthStart = monthStartIso();

      const [
        inventoryRes,
        customersRes,
        winesRes,
        vintagesRes,
        tastingsRes,
        salesRes,
      ] = await Promise.all([
        supabase
          .from("inventory")
          .select("quantity_on_hand")
          .gt("quantity_on_hand", 0),
        supabase.from("customer").select("id", { count: "exact", head: true }),
        supabase.from("wine").select("id", { count: "exact", head: true }),
        supabase
          .from("wine_vintage")
          .select("id", { count: "exact", head: true }),
        supabase.from("tasting").select("id", { count: "exact", head: true }),
        supabase.from("sale").select("total_price, status, date"),
      ]);

      const firstErr =
        inventoryRes.error ||
        customersRes.error ||
        winesRes.error ||
        vintagesRes.error ||
        tastingsRes.error ||
        salesRes.error;

      if (firstErr) throw new Error(firstErr.message);

      const invRows = inventoryRes.data || [];
      const bottlesInStock = invRows.reduce(
        (s, r) => s + (r.quantity_on_hand ?? 0),
        0,
      );
      const vintagesInStock = invRows.length;
      const lowStockCount = invRows.filter(
        (r) => (r.quantity_on_hand ?? 0) > 0 && (r.quantity_on_hand ?? 0) <= 3,
      ).length;

      const salesRows = salesRes.data || [];
      const revenueSales = salesRows.filter(
        (s) =>
          s.status !== "cancelled" &&
          REVENUE_STATUSES.includes(s.status ?? ""),
      );
      const revenueAll = revenueSales.reduce(
        (sum, r) => sum + Number(r.total_price ?? 0),
        0,
      );
      const revenueMonth = revenueSales
        .filter((r) => r.date >= monthStart)
        .reduce((sum, r) => sum + Number(r.total_price ?? 0), 0);

      statCards = [
        {
          id: "bottles",
          icon: "🍾",
          label: "Bouteilles en stock",
          value: formatInt(bottlesInStock),
          hint:
            lowStockCount > 0
              ? `${formatInt(lowStockCount)} millésime${lowStockCount > 1 ? "s" : ""} ≤ 3 bt.`
              : `${formatInt(vintagesInStock)} référence${vintagesInStock > 1 ? "s" : ""}`,
          href: "/manage/stock",
          tone: "green",
        },
        {
          id: "wines",
          icon: "🍷",
          label: "Vins au catalogue",
          value: formatInt(winesRes.count ?? 0),
          hint: `${formatInt(vintagesRes.count ?? 0)} millésime${(vintagesRes.count ?? 0) > 1 ? "s" : ""}`,
          href: "/manage/wines",
          tone: "purple",
        },
        {
          id: "customers",
          icon: "👥",
          label: "Clients",
          value: formatInt(customersRes.count ?? 0),
          href: "/manage/customers",
          tone: "blue",
        },
        {
          id: "revenue",
          icon: "💵",
          label: "Chiffre d'affaires",
          value: formatEur(revenueAll),
          hint: `${formatEur(revenueMonth)} ce mois-ci`,
          href: "/manage/sales",
          tone: "amber",
        },
        {
          id: "tastings",
          icon: "🥂",
          label: "Dégustations",
          value: formatInt(tastingsRes.count ?? 0),
          href: "/manage/tastings",
          tone: "purple",
        },
      ];
    } catch (e) {
      statsError =
        e instanceof Error ? e.message : "Impossible de charger les statistiques";
      statCards = [];
    } finally {
      statsLoading = false;
    }
  }

  onMount(() => {
    const unsub = userStore.subscribe((u: unknown) => {
      if (u) void loadDashboardStats();
    });
    return unsub;
  });

  async function handleMagicLink() {
    if (!email) {
      error = "Veuillez entrer votre email";
      return;
    }

    loading = true;
    error = "";

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/manage`,
      },
    });

    if (signInError) {
      error = signInError.message;
    } else {
      magicLinkSent = true;
    }

    loading = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      handleMagicLink();
    }
  }
</script>

<svelte:head>
  <title>Gestion</title>
</svelte:head>

{#if !$userStore}
  <div class="login-container">
    <div class="login-form">
      <h1>Accès gestion</h1>

      {#if !magicLinkSent}
        <div class="input-group">
          <input
            type="email"
            bind:value={email}
            placeholder="Votre email"
            on:keydown={handleKeydown}
          />
          <button on:click={handleMagicLink} disabled={loading}>
            {loading ? "Envoi..." : "Envoyer le lien de connexion"}
          </button>
        </div>
        {#if error}
          <p class="error">{error}</p>
        {/if}
      {:else}
        <div class="magic-link-sent">
          <p>✅ Un lien de connexion a été envoyé à <strong>{email}</strong></p>
          <p>
            Vérifiez votre boîte mail et cliquez sur le lien pour vous
            connecter.
          </p>
          <button class="resend-btn" on:click={() => (magicLinkSent = false)}>
            Envoyer un nouveau lien
          </button>
        </div>
      {/if}
    </div>
  </div>
{:else}
  <ManagePageShell title="Tableau de bord">
    {#if statsError}
      <div class="error-message">{statsError}</div>
    {/if}

    {#if statsLoading}
      <div class="loading">Chargement des indicateurs…</div>
    {:else}
      <div class="stats-grid">
        {#each statCards as card (card.id)}
          <a href={card.href} class="stat-card stat-card--{card.tone}">
            <span class="stat-icon" aria-hidden="true">{card.icon}</span>
            <div class="stat-body">
              <span class="stat-value">{card.value}</span>
              <span class="stat-label">{card.label}</span>
              {#if card.hint}
                <span class="stat-hint">{card.hint}</span>
              {/if}
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </ManagePageShell>
{/if}

<style>
  .login-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f5f5;
  }

  .login-form {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 400px;
  }

  .login-form h1 {
    margin: 0 0 1.5rem 0;
    text-align: center;
    color: #333;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .input-group input {
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
  }

  .input-group button {
    padding: 0.75rem 1.5rem;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
  }

  .input-group button:hover {
    background: #0056b3;
  }

  .input-group button:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }

  .magic-link-sent {
    text-align: center;
  }

  .magic-link-sent p {
    margin: 0.5rem 0;
    color: #666;
  }

  .magic-link-sent p:first-child {
    color: #28a745;
    font-weight: 500;
  }

  .resend-btn {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    background: #6c757d;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .resend-btn:hover {
    background: #5a6268;
  }

  .error {
    color: #dc3545;
    text-align: center;
    margin: 0;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
  }

  @media (max-width: 960px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 560px) {
    .stats-grid {
      grid-template-columns: 1fr;
    }
  }

  .stat-card {
    display: flex;
    align-items: flex-start;
    gap: 1.25rem;
    padding: 1.75rem 2rem;
    min-height: 7.5rem;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    text-decoration: none;
    color: inherit;
    border-left: 5px solid #ced4da;
    transition:
      transform 0.15s ease,
      box-shadow 0.15s ease;
  }

  .stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
  }

  .stat-card--green {
    border-left-color: #28a745;
  }
  .stat-card--blue {
    border-left-color: #007bff;
  }
  .stat-card--purple {
    border-left-color: #6f42c1;
  }
  .stat-card--amber {
    border-left-color: #e0a800;
  }
  .stat-card--rose {
    border-left-color: #e83e8c;
  }
  .stat-card--slate {
    border-left-color: #6c757d;
  }

  .stat-icon {
    font-size: 2.25rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .stat-body {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 0;
  }

  .stat-value {
    font-size: 2.1rem;
    font-weight: 700;
    color: #212529;
    line-height: 1.15;
    font-variant-numeric: tabular-nums;
  }

  .stat-label {
    font-size: 1rem;
    font-weight: 600;
    color: #444;
  }

  .stat-hint {
    font-size: 0.9rem;
    color: #6c757d;
    line-height: 1.35;
  }
</style>
