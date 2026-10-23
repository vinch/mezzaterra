<script lang="ts">
  import "$lib/styles/site.css";
  import { page } from "$app/stores";
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import SiteNav from "$lib/components/site/SiteNav.svelte";
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

  let emailInput: HTMLInputElement;

  /** « Je veux en être ↓ » : défilement doux jusqu'au formulaire, puis focus dans le champ email. */
  function goToSignup(e: MouseEvent) {
    const target = document.getElementById("newsletter");
    if (!target || !emailInput) return;
    e.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    history.replaceState(history.state, "", "#newsletter");
    const focus = () => emailInput.focus({ preventScroll: true });
    if (reduce || !("onscrollend" in window)) {
      setTimeout(focus, reduce ? 0 : 600);
    } else {
      window.addEventListener("scrollend", focus, { once: true });
      /* Filet de sécurité si aucun défilement n'a lieu (déjà en bas de page). */
      setTimeout(focus, 900);
    }
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
  <header class="mz-container home-top">
    <SiteNav />
  </header>

  <main class="mz-container home">
    <section class="hero" aria-labelledby="concept-title">
      <div class="hero-text mz-rise">
        <img src="/logo.png" alt="Mezzaterra" class="logo-home" />
        <h1 id="concept-title" class="hero-title">Les Abruzzes,<br />un verre à la fois.</h1>
        <p class="hero-lead">
          Mezzaterra fait venir en direct les vins de quelques domaines familiaux des Abruzzes, entre la
          mer Adriatique et le massif du Gran Sasso. Des vins de vignerons, encore confidentiels de ce
          côté des Alpes, que l’on prend le temps de faire découvrir.
        </p>
        <a class="hero-link" href="#newsletter" on:click={goToSignup}>Je veux en être <span aria-hidden="true">↓</span></a>
      </div>
      <div class="hero-map mz-rise" style="animation-delay: 120ms">
        <AbruzzoMap wineries={data.wineries} />
      </div>
    </section>

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

    <div class="photos mz-rise" style="animation-delay: 300ms">
      <img src="/flyer/photo-1.webp" width="826" height="1100" alt="Bouteilles des domaines alignées sur une table" loading="lazy" />
      <img src="/flyer/photo-2.webp" width="1050" height="1400" alt="Une tablée de dégustation autour du vigneron" loading="lazy" />
      <img src="/flyer/photo-3.webp" width="826" height="1100" alt="Plateau de charcuterie et de fromages italiens" loading="lazy" />
    </div>

    <section id="newsletter" class="cta" aria-labelledby="cta-title">
      <span class="cta-eyebrow">Sur invitation</span>
      <h2 id="cta-title">Envie d’en être ?</h2>
      <p class="cta-sub">
        Les dégustations se font en petit comité, sur invitation.<br />
        Laissez-nous votre email, on vous fera signe.
      </p>
      <form on:submit|preventDefault={handleSubscribe} class="subscribe-form">
        <input
          bind:this={emailInput}
          id="newsletter-email"
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

  .home-top {
    position: relative;
    z-index: 1;
    width: 100%;
    display: flex;
    justify-content: flex-end;
    padding-top: 20px;
  }

  .home {
    flex: 1;
    width: 100%;
    padding-top: 28px;
    padding-bottom: 32px;
  }

  /* ——— Ouverture : texte + carte ——— */
  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
    gap: 56px;
    align-items: start;
  }

  .hero-text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .logo-home {
    display: block;
    width: 300px;
    height: auto;
    /* Le PNG a de larges marges : on les rogne pour caler le logo à gauche. */
    margin: -78px 0 -64px -44px;
  }

  .hero-title {
    margin: 36px 0 20px;
    font-family: var(--mz-font-display);
    font-weight: 600;
    font-size: clamp(2.4rem, 4.4vw, 3.4rem);
    line-height: 1.08;
    letter-spacing: -0.01em;
    color: var(--mz-teal-deep);
  }

  .hero-lead {
    margin: 0;
    max-width: 34rem;
    font-size: 1.08rem;
    line-height: 1.7;
    color: var(--mz-ink-soft);
  }

  .hero-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 28px;
    padding-bottom: 4px;
    border-bottom: 1px solid currentColor;
    color: var(--mz-teal);
    font-weight: 600;
    font-size: 0.95rem;
    text-decoration: none;
  }

  .hero-link:hover {
    color: var(--mz-teal-deep);
  }

  .hero-link span {
    transition: transform 0.25s var(--mz-ease);
  }

  .hero-link:hover span {
    transform: translateY(3px);
  }

  .hero-map {
    padding-top: 48px;
  }

  .hero-map :global(svg) {
    border-radius: 18px;
    box-shadow: 0 24px 50px -28px rgba(29, 42, 44, 0.45);
  }

  /* ——— Trois points ——— */
  .pillars {
    list-style: none;
    margin: 88px 0 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 56px;
  }

  .pillars li {
    padding-top: 22px;
    border-top: 1px solid var(--mz-line);
  }

  .pillar-num {
    font-family: var(--mz-font-display);
    font-style: italic;
    font-size: 1.15rem;
    color: var(--mz-wine-red);
  }

  .pillar-title {
    margin: 10px 0 10px;
    font-family: var(--mz-font-display);
    font-weight: 600;
    font-size: 1.45rem;
    line-height: 1.2;
    color: var(--mz-teal-deep);
  }

  .pillars p {
    margin: 0;
    line-height: 1.65;
    color: var(--mz-ink-soft);
  }

  /* ——— Photos ——— */
  .photos {
    display: grid;
    grid-template-columns: 1fr 1.35fr 1fr;
    gap: 12px;
    margin-top: 88px;
  }

  .photos img {
    display: block;
    width: 100%;
    height: 340px;
    object-fit: cover;
    border-radius: var(--mz-radius);
    box-shadow: var(--mz-shadow-sm);
  }

  /* Recadrage : le goulot des bouteilles et le vigneron restent dans le cadre */
  .photos img:nth-child(1) {
    object-position: 50% 55%;
  }

  .photos img:nth-child(2) {
    object-position: 50% 35%;
  }

  .cta {
    position: relative;
    overflow: hidden;
    margin-top: 112px;
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

  @media (max-width: 960px) {
    .hero {
      grid-template-columns: 1fr;
      gap: 32px;
    }

    .hero-map {
      padding-top: 0;
    }

    .pillars {
      gap: 32px;
    }
  }

  @media (max-width: 820px) {
    .pillars {
      grid-template-columns: 1fr;
      margin-top: 56px;
    }

    .photos {
      margin-top: 56px;
    }

    .cta {
      margin-top: 72px;
    }
  }

  @media (max-width: 640px) {
    .home-top {
      justify-content: center;
      padding-top: 14px;
    }

    .home {
      padding-top: 16px;
    }

    .logo-home {
      width: 240px;
      margin: -62px 0 -52px -36px;
    }

    .hero-title {
      margin-top: 28px;
    }

    .photos {
      grid-template-columns: 1fr 1fr;
    }

    .photos img {
      height: 180px;
    }

    .photos img:nth-child(2) {
      grid-column: 1 / -1;
      grid-row: 1;
      height: 220px;
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
