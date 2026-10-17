<script lang="ts">
  import "$lib/styles/site.css";
  import { page } from "$app/stores";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import AbruzzoMap from "$lib/components/site/AbruzzoMap.svelte";
  import { supabase } from "$lib/supabase";

  export let data;

  $: wineryNames = data.wineries.map((w) => w.name);

  let email = "";
  let isSubmitting = false;
  let feedback = "";
  let feedbackType: "success" | "error" = "success";

  async function handleSubscribe() {
    const cleanedEmail = email.trim().toLowerCase();
    if (!cleanedEmail) {
      feedbackType = "error";
      feedback = "Veuillez entrer un email.";
      return;
    }

    isSubmitting = true;
    feedback = "";

    const { error } = await supabase
      .from("email_subscriber")
      .insert({ email: cleanedEmail, source: "homepage" });

    if (error) {
      if (error.code === "23505") {
        feedbackType = "success";
        feedback = "Cet email est déjà inscrit. Merci !";
      } else {
        feedbackType = "error";
        feedback = "Impossible d'enregistrer l'email pour le moment.";
      }
      isSubmitting = false;
      return;
    }

    feedbackType = "success";
    feedback = "Merci ! Nous vous ferons signe.";
    email = "";
    isSubmitting = false;
  }

  /** « A, B et C » */
  function listFr(items: string[]): string {
    if (items.length <= 1) return items.join("");
    return `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;
  }
</script>

<svelte:head>
  <title>Mezzaterra — Vins des Abruzzes & dégustations</title>
  <meta
    name="description"
    content="Mezzaterra importe en direct les vins de domaines familiaux des Abruzzes et les fait découvrir en petit comité."
  />
  <meta property="og:title" content="Mezzaterra" />
  <meta property="og:description" content="Vins des Abruzzes & dégustations en petit comité." />
  <meta property="og:image" content="{$page.url.origin}/logo.png" />
</svelte:head>

<div class="page">
  <header class="hero">
    <img src="/logo.png" alt="Mezzaterra" class="logo-home" />
  </header>

  <main class="mz-container home">
    <section class="concept" aria-labelledby="concept-title">
      <div class="concept-top">
      <div class="concept-intro mz-rise">
        <span class="mz-eyebrow">Le concept</span>
        <h1 id="concept-title" class="mz-display mz-h2">Les Abruzzes, un verre à la fois.</h1>
        <p class="mz-lead">
          Mezzaterra fait venir en direct les vins de quelques domaines familiaux des Abruzzes, entre la
          mer Adriatique et le massif du Gran Sasso. Des vins de vignerons, encore confidentiels de ce
          côté des Alpes, que l’on prend le temps de faire découvrir.
        </p>
      </div>
      <div class="concept-map mz-rise" style="animation-delay: 120ms">
        <AbruzzoMap wineries={data.wineries} />
      </div>
      </div>

      <ol class="pillars">
        <li class="mz-rise" style="animation-delay: 80ms">
          <span class="pillar-num">01</span>
          <h2 class="pillar-title">Des domaines familiaux</h2>
          <p>
            {#if wineryNames.length}
              Une poignée de domaines choisis — {listFr(wineryNames)} — et leurs cépages du pays :
              Montepulciano, Pecorino, Passerina, Cerasuolo…
            {:else}
              Une poignée de domaines choisis et leurs cépages du pays : Montepulciano, Pecorino,
              Passerina, Cerasuolo…
            {/if}
          </p>
        </li>
        <li class="mz-rise" style="animation-delay: 160ms">
          <span class="pillar-num">02</span>
          <h2 class="pillar-title">En direct de la cave</h2>
          <p>
            Les bouteilles voyagent de la cave du vigneron jusqu’à nous, sans intermédiaire. Chaque vin
            a une histoire, et quelqu’un pour la raconter.
          </p>
        </li>
        <li class="mz-rise" style="animation-delay: 240ms">
          <span class="pillar-num">03</span>
          <h2 class="pillar-title">Goûtés ensemble</h2>
          <p>
            Les vins se découvrent autour d’une table, en petit comité et sur invitation, avec de quoi
            grignoter à l’italienne.
          </p>
        </li>
      </ol>

      <img
        class="photos mz-rise"
        style="animation-delay: 300ms"
        src="/flyer/photos.jpg"
        alt="Bouteilles alignées, une tablée de dégustation et un plateau de charcuterie et de fromages italiens"
        loading="lazy"
      />
    </section>

    <section id="newsletter" class="cta" aria-labelledby="cta-title">
      <span class="cta-eyebrow">Sur invitation</span>
      <h2 id="cta-title">Envie d’en être ?</h2>
      <p class="cta-sub">
        Les dégustations se font en petit comité, sur invitation.<br />
        Laissez-nous votre email, on vous fera signe.
      </p>
      <form on:submit|preventDefault={handleSubscribe} class="subscribe-form">
        <input
          type="email"
          bind:value={email}
          placeholder="Votre email"
          autocomplete="email"
          aria-label="Votre email"
          required
        />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Envoi…" : "Je m’inscris"}
        </button>
      </form>

      {#if feedback}
        <p class="feedback {feedbackType}" role="status">{feedbackType === "success" ? "✓ " : ""}{feedback}</p>
      {:else}
        <p class="cta-fine">Pas de spam : seulement nos invitations.</p>
      {/if}
    </section>
  </main>

  <SiteFooter />
</div>

<style>
  .page {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    font-family: var(--mz-font-body);
    color: var(--mz-ink);
  }

  .hero {
    display: flex;
    justify-content: center;
    padding: 1rem 1rem 0;
  }

  .logo-home {
    width: min(92vw, 44rem);
    max-height: 46vh;
    object-fit: contain;
    display: block;
    /* Le PNG a de larges marges : on les « mange » pour rapprocher le contenu. */
    margin: -6% 0 -2%;
  }

  .home {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
    padding-bottom: 2rem;
    width: 100%;
  }

  .concept {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .concept-top {
    display: grid;
    grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
    gap: 2.5rem;
    align-items: center;
    margin-bottom: 2.5rem;
  }

  .concept-intro {
    max-width: 34rem;
  }

  .concept-intro h1 {
    margin: 0.5rem 0 0.9rem;
  }

  .concept-intro .mz-lead {
    margin: 0;
  }

  .pillars {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.25rem;
  }

  .pillars li {
    padding: 1.4rem 1.5rem 1.5rem;
    border-top: 2px solid var(--mz-teal);
    background: color-mix(in srgb, var(--mz-paper-raised) 70%, transparent);
    border-radius: 0 0 var(--mz-radius) var(--mz-radius);
  }

  .pillar-num {
    font-family: var(--mz-font-display);
    font-size: 0.95rem;
    color: var(--mz-teal-soft);
    letter-spacing: 0.05em;
  }

  .pillar-title {
    margin: 0.35rem 0 0.5rem;
    font-family: var(--mz-font-display);
    font-weight: 500;
    font-size: 1.35rem;
    color: var(--mz-teal);
  }

  .pillars p {
    margin: 0;
    line-height: 1.6;
    color: var(--mz-ink-soft);
  }

  .photos {
    display: block;
    width: 100%;
    height: auto;
    border-radius: var(--mz-radius);
    box-shadow: var(--mz-shadow-sm);
  }

  .cta {
    position: relative;
    overflow: hidden;
    margin-top: 2.5rem;
    padding: clamp(3rem, 6vw, 4.5rem) clamp(1.5rem, 5vw, 3rem);
    border-radius: var(--mz-radius-lg);
    text-align: center;
    color: #f4f2ed;
    background:
      radial-gradient(ellipse 60% 80% at 15% 0%, rgba(255, 255, 255, 0.12), transparent 60%),
      radial-gradient(ellipse 50% 70% at 100% 100%, rgba(122, 31, 46, 0.35), transparent 70%),
      var(--mz-teal);
    box-shadow: 0 30px 60px -30px rgba(26, 71, 77, 0.65);
  }

  /* Vagues de l'Adriatique, comme sur la carte. */
  .cta::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='28'%3E%3Cpath d='M0 14 q14 -10 28 0 t28 0' fill='none' stroke='%23ffffff' stroke-width='1.2' opacity='0.09'/%3E%3C/svg%3E");
    pointer-events: none;
  }

  .cta > * {
    position: relative;
  }

  .cta-eyebrow {
    display: inline-block;
    padding: 0.35rem 0.85rem;
    border-radius: 999px;
    border: 1px solid rgba(244, 242, 237, 0.35);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(244, 242, 237, 0.85);
  }

  .cta h2 {
    margin: 1rem 0 0.75rem;
    font-family: var(--mz-font-display);
    font-weight: 500;
    font-size: clamp(2.2rem, 5vw, 3.2rem);
    line-height: 1.05;
    letter-spacing: -0.01em;
    color: #fff;
  }

  .cta-sub {
    margin: 0 auto 2rem;
    max-width: 32rem;
    font-size: 1.08rem;
    line-height: 1.6;
    color: rgba(244, 242, 237, 0.82);
  }

  .subscribe-form {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    width: min(100%, 32rem);
    margin: 0 auto;
    padding: 0.4rem;
    border-radius: 999px;
    background: #fff;
    box-shadow: 0 12px 30px -12px rgba(0, 0, 0, 0.45);
  }

  .subscribe-form input {
    flex: 1 1 auto;
    min-width: 0;
    border: none;
    border-radius: 999px;
    background: transparent;
    padding: 0.85rem 1.1rem;
    font: inherit;
    font-size: 1.05rem;
    color: var(--mz-ink);
  }

  .subscribe-form input::placeholder {
    color: var(--mz-muted);
  }

  .subscribe-form input:focus {
    outline: none;
  }

  .subscribe-form:focus-within {
    box-shadow:
      0 12px 30px -12px rgba(0, 0, 0, 0.45),
      0 0 0 4px rgba(244, 242, 237, 0.35);
  }

  .subscribe-form button {
    flex-shrink: 0;
    border: none;
    border-radius: 999px;
    padding: 0.9rem 1.6rem;
    background: var(--mz-wine-red);
    color: #fff;
    font: inherit;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      background-color 0.2s ease,
      transform 0.2s var(--mz-ease);
  }

  .subscribe-form button:hover:not(:disabled) {
    background: #5e1522;
    transform: translateY(-1px);
  }

  .subscribe-form button:disabled {
    opacity: 0.7;
    cursor: default;
  }

  .cta-fine,
  .feedback {
    margin: 1rem 0 0;
    font-size: 0.88rem;
    color: rgba(244, 242, 237, 0.7);
  }

  .feedback.success {
    color: #cfeedd;
    font-weight: 600;
  }

  .feedback.error {
    color: #ffd2cc;
    font-weight: 600;
  }

  @media (max-width: 900px) {
    .concept-top {
      grid-template-columns: 1fr;
      gap: 2rem;
      margin-bottom: 1.5rem;
    }
  }

  @media (max-width: 820px) {
    .pillars {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .photos {
      height: 12rem;
      object-fit: cover;
      object-position: 50% 40%;
    }

    .logo-home {
      max-height: 34vh;
    }

    .subscribe-form {
      flex-direction: column;
      align-items: stretch;
      border-radius: 20px;
    }

    .subscribe-form input {
      text-align: center;
    }

    .cta-sub br {
      display: none;
    }

    .subscribe-form button {
      width: 100%;
    }
  }
</style>
