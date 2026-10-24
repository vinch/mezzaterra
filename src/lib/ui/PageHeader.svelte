<script lang="ts">
  import { IconArrowLeft } from "./icons";

  /** En-tête de page : retour optionnel, titre, ligne de contexte, actions à droite, bordure basse. */
  export let title: string;
  export let subtitle = "";
  export let back: { href: string; label: string } | null = null;
  /** Forcer la présence des zones (utile quand les slots sont relayés par un composant parent). */
  export let hasActions: boolean | null = null;
  export let hasTabs: boolean | null = null;

  $: showActions = hasActions ?? $$slots.actions;
  $: showTabs = hasTabs ?? $$slots.tabs;
</script>

<header class="page-head">
  <div class="page-head-main">
    {#if back}
      <a class="back" href={back.href}><IconArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />{back.label}</a>
    {/if}
    <div class="title-row">
      <h1 class="t-page-title">{title}</h1>
      <slot name="badge" />
    </div>
    {#if subtitle || $$slots.subtitle}
      <p class="subtitle"><slot name="subtitle">{subtitle}</slot></p>
    {/if}
  </div>
  {#if showActions}
    <div class="page-head-actions"><slot name="actions" /></div>
  {/if}
</header>
{#if showTabs}
  <div class="page-tabs"><slot name="tabs" /></div>
{/if}

<style>
  /* Teintes réglables par la page (ex. en-tête sombre du pilotage live sur mobile). */
  .page-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    padding: 24px 32px 20px;
    border-bottom: var(--page-head-border, 1px solid var(--border));
    background: var(--page-head-bg, transparent);
  }

  .page-head h1 {
    color: var(--page-head-fg, var(--title));
  }

  .page-head-main {
    min-width: 0;
  }

  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 4px;
    font-size: 12px;
    font-weight: 500;
    text-decoration: none;
    color: var(--page-head-fg, var(--teal-600));
  }

  .back:hover {
    color: var(--page-head-fg, var(--teal-700));
  }

  .title-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }

  .subtitle {
    margin: 4px 0 0;
    font-size: 12px;
    line-height: 16px;
    color: var(--page-head-muted, var(--ink-2));
  }

  .page-head-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }

  .page-tabs {
    padding: 0 32px;
    border-bottom: 1px solid var(--border);
    margin-top: -1px;
  }

  @media (max-width: 767px) {
    .page-head {
      padding: 16px;
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .page-head-main {
      flex: 1 1 60%;
    }

    .page-head-actions {
      margin-left: auto;
    }

    .t-page-title {
      font-size: 26px;
      line-height: 32px;
    }

    .page-tabs {
      padding: 0 16px;
    }
  }
</style>
