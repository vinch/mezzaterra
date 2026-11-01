<script lang="ts">
  /**
   * Page d'erreur Mezzaterra (404, 500…). Utilisée par les +error.svelte du site et de la gestion.
   */
  interface Props {
    status?: number;
    message?: string;
    /** Liens proposés (le premier est mis en avant). */
    links?: { href: string; label: string }[];
    /** Afficher le logo en haut (quand la page n'a pas d'en-tête autour). */
    withLogo?: boolean;
  }

  let {
    status = 500,
    message = "",
    links = [
    { href: "/", label: "Retour à l’accueil" },
    { href: "/vins", label: "Nos vins" },
  ],
    withLogo = false
  }: Props = $props();

  let notFound = $derived(status === 404);
  let forbidden = $derived(status === 401 || status === 403);
  let title = $derived(notFound
    ? "Cette bouteille est introuvable"
    : forbidden
      ? "Cette cave est fermée à clé"
      : "Un bouchon a sauté");
  let lead = $derived(notFound
    ? "La page que vous cherchez a peut-être été débouchée, déplacée… ou n’a jamais existé."
    : forbidden
      ? "Vous n’avez pas accès à cette page."
      : "Quelque chose s’est mal passé de notre côté. Réessayez dans un instant ; si le problème persiste, prévenez-nous.");
</script>

<section class="error" aria-labelledby="error-title">
  {#if withLogo}
    <a href="/" class="logo-link" aria-label="Mezzaterra — accueil"><img src="/flyer/logo-text.svg" alt="Mezzaterra" /></a>
  {/if}

  <div class="art" aria-hidden="true">
    {#if notFound}
      <!-- Verre vide, une goutte au fond -->
      <svg viewBox="0 0 120 160" class="glass">
        <path class="glass-line" d="M28 14h64c0 46-10 76-32 76S28 60 28 14z" />
        <path class="glass-line" d="M60 90v48M38 146h44" />
        <ellipse class="drop" cx="60" cy="84" rx="7" ry="2.6" />
        <path class="shine" d="M38 24c0 22 4 38 10 48" />
      </svg>
    {:else}
      <!-- Bouteille renversée, une flaque -->
      <svg viewBox="0 0 200 120" class="bottle">
        <ellipse class="puddle" cx="58" cy="104" rx="46" ry="8" />
        <g transform="rotate(-78 120 70)">
          <path class="bottle-body" d="M112 18h16v24c0 6 12 12 12 24v62a6 6 0 0 1-6 6h-28a6 6 0 0 1-6-6V66c0-12 12-18 12-24z" />
          <rect class="label" x="104" y="80" width="32" height="26" rx="2" />
        </g>
        <circle class="cork" cx="40" cy="30" r="6" />
      </svg>
    {/if}
  </div>

  <p class="code">Erreur {status}</p>
  <h1 id="error-title" class="title">{title}</h1>
  <p class="lead">{lead}</p>
  {#if message && !notFound && message !== "Internal Error" && message !== "Not Found"}
    <p class="detail"><code>{message}</code></p>
  {/if}

  <div class="actions">
    {#each links as link, i}
      <a class={i === 0 ? "btn btn--primary" : "btn btn--ghost"} href={link.href}>{link.label}</a>
    {/each}
  </div>
</section>

<style>
  .error {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 64px 24px 72px;
    font-family: var(--mz-font-body);
    color: var(--mz-ink);
  }

  .logo-link img {
    display: block;
    height: 44px;
    margin-bottom: 40px;
  }

  .art {
    margin-bottom: 20px;
  }

  .glass {
    width: 110px;
    height: auto;
  }

  .bottle {
    width: 200px;
    height: auto;
  }

  .glass-line {
    fill: none;
    stroke: var(--mz-teal);
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .shine {
    fill: none;
    stroke: var(--mz-teal-soft);
    stroke-width: 2;
    stroke-linecap: round;
    opacity: 0.35;
  }

  .drop {
    fill: var(--mz-wine-red);
    animation: swirl 3.2s ease-in-out infinite;
    transform-origin: 60px 84px;
  }

  .bottle-body {
    fill: var(--mz-teal);
  }

  .label {
    fill: var(--mz-paper-raised);
  }

  .puddle {
    fill: var(--mz-wine-red);
    opacity: 0.75;
    transform-origin: 58px 104px;
    animation: spread 2.4s ease-out both;
  }

  .cork {
    fill: #b08a5a;
  }

  @keyframes swirl {
    0%,
    100% {
      transform: scaleX(1);
    }
    50% {
      transform: scaleX(0.7);
    }
  }

  @keyframes spread {
    from {
      transform: scale(0.2);
    }
    to {
      transform: scale(1);
    }
  }

  .code {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--mz-wine-red);
  }

  .title {
    margin: 10px 0 12px;
    font-family: var(--mz-font-display);
    font-weight: 600;
    font-size: clamp(2rem, 4.6vw, 3rem);
    line-height: 1.08;
    letter-spacing: -0.01em;
    color: var(--mz-teal-deep);
  }

  .lead {
    margin: 0;
    max-width: 30rem;
    font-size: 1.05rem;
    line-height: 1.6;
    color: var(--mz-ink-soft);
  }

  .detail {
    margin: 16px 0 0;
    max-width: 34rem;
    font-size: 0.85rem;
    color: var(--mz-muted);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
    margin-top: 28px;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 20px;
    border-radius: var(--mz-radius-pill);
    border: 1px solid var(--mz-teal);
    font-weight: 600;
    font-size: 0.95rem;
    text-decoration: none;
  }

  .btn--primary {
    background: var(--mz-teal);
    color: #fff;
  }

  .btn--primary:hover {
    background: var(--mz-teal-deep);
  }

  .btn--ghost {
    color: var(--mz-teal);
  }

  .btn--ghost:hover {
    background: var(--mz-teal-wash);
  }

  @media (prefers-reduced-motion: reduce) {
    .drop,
    .puddle {
      animation: none;
    }
  }
</style>
