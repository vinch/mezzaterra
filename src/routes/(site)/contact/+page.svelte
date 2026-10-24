<script lang="ts">
  import { preventDefault } from "$lib/ui/events";
  import { onDestroy, onMount, untrack } from "svelte";
  import { page } from "$app/stores";
  import { env as publicEnv } from "$env/dynamic/public";
  import { CONTACT_EMAIL, CONTACT_REASONS, contactReason } from "$lib/contact";

  /* CAPTCHA Cloudflare Turnstile : actif dès que la clé publique est définie. */
  const siteKey = publicEnv.PUBLIC_TURNSTILE_SITE_KEY || "";

  let reason = $state("");
  let subject = $state("");
  let firstName = $state("");
  let lastName = $state("");
  let email = $state("");
  let phone = $state("");
  let message = $state("");
  /** Piège à robots : champ invisible, laissé vide par les humains. */
  let website = $state("");

  let status = $state<"idle" | "sending" | "done" | "unavailable">("idle");
  let errorMsg = $state("");
  let startedAt = Date.now();

  let turnstileEl = $state<HTMLDivElement>();
  let turnstileId: string | null = null;
  let turnstileToken = "";

  /* La raison (et le sujet) viennent de l'URL : /contact?raison=prive&sujet=… */
  let lastQuery = "";

  function syncFromUrl(params: URLSearchParams) {
    const query = params.toString();
    if (query === lastQuery) return;
    lastQuery = query;
    reason = contactReason(params.get("raison"))?.id ?? "";
    subject = (params.get("sujet") || "").slice(0, 200);
  }

  type Turnstile = {
    render: (el: HTMLElement, opts: Record<string, unknown>) => string;
    reset: (id: string) => void;
    remove: (id: string) => void;
  };

  function turnstile(): Turnstile | undefined {
    return (window as unknown as { turnstile?: Turnstile }).turnstile;
  }

  function loadTurnstile(): Promise<void> {
    if (turnstile()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
      const script = existing ?? document.createElement("script");
      script.addEventListener("load", () => resolve(), { once: true });
      script.addEventListener("error", () => reject(), { once: true });
      if (!existing) {
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.dataset.turnstile = "";
        document.head.appendChild(script);
      }
    });
  }

  onMount(async () => {
    startedAt = Date.now();
    if (!siteKey) return;
    try {
      await loadTurnstile();
    } catch {
      errorMsg = "La vérification anti-robot n’a pas pu se charger. Rechargez la page ou écrivez-nous directement.";
      return;
    }
    if (!turnstileEl) return;
    turnstileId = turnstile()!.render(turnstileEl, {
      sitekey: siteKey,
      language: "fr",
      theme: "light",
      action: "contact",
      callback: (token: string) => (turnstileToken = token),
      "expired-callback": () => (turnstileToken = ""),
      "error-callback": () => (turnstileToken = ""),
    });
  });

  onDestroy(() => {
    if (turnstileId && typeof window !== "undefined") turnstile()?.remove(turnstileId);
  });

  function resetTurnstile() {
    turnstileToken = "";
    if (turnstileId) turnstile()?.reset(turnstileId);
  }

  async function submit() {
    errorMsg = "";
    if (!reason) {
      errorMsg = "Choisissez la raison de votre message.";
      return;
    }
    if (!firstName.trim() || !email.trim() || !message.trim()) {
      errorMsg = "Prénom, email et message sont obligatoires.";
      return;
    }
    if (siteKey && !turnstileToken) {
      errorMsg = "Merci de confirmer que vous n’êtes pas un robot.";
      return;
    }

    status = "sending";
    const referrer = document.referrer ? new URL(document.referrer) : null;
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason,
        subject,
        firstName,
        lastName,
        email,
        phone,
        message,
        website,
        turnstileToken,
        elapsed: Date.now() - startedAt,
        page: referrer && referrer.origin === location.origin ? referrer.pathname + referrer.search : "",
      }),
    }).catch(() => null);

    if (res?.ok) {
      status = "done";
      return;
    }
    if (res?.status === 503) {
      status = "unavailable";
      return;
    }
    status = "idle";
    const body = res ? await res.json().catch(() => null) : null;
    errorMsg = body?.message || "L’envoi a échoué. Merci de réessayer dans un instant.";
    resetTurnstile();
  }
  /* Lu dès l'initialisation (rendu serveur compris), puis à chaque navigation côté client. */
  syncFromUrl($page.url.searchParams);
  $effect.pre(() => {
    const params = $page.url.searchParams;
    untrack(() => syncFromUrl(params));
  });
  let placeholder = $derived(contactReason(reason)?.placeholder ?? "Votre message");
  let reasonLabel = $derived(contactReason(reason)?.label ?? "Contact");
  let mailtoHref = $derived(`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    `${reasonLabel}${subject ? ` — ${subject}` : ""}`,
  )}&body=${encodeURIComponent(
    `${message}\n\n${[firstName, lastName].filter(Boolean).join(" ")}${phone ? `\n${phone}` : ""}`,
  )}`);
</script>

<svelte:head>
  <title>Contact — Mezzaterra</title>
  <meta name="description" content="Une dégustation privée, une commande, une question ? Écrivez-nous." />
  <meta property="og:title" content="Contact — Mezzaterra" />
</svelte:head>

<div class="mz-container layout">
  <section class="intro mz-rise">
    <h1 class="mz-display mz-h1">Écrivez-nous</h1>
    <p class="mz-lead">
      Une dégustation privée chez vous, quelques bouteilles à commander ou simplement une question :
      laissez-nous un mot, on vous répond très vite.
    </p>
    <ul class="direct">
      <li><span class="mz-label">Email</span> <a class="mz-link" href="mailto:{CONTACT_EMAIL}">{CONTACT_EMAIL}</a></li>
      <li>
        <span class="mz-label">Instagram</span>
        <a class="mz-link" href="https://instagram.com/wearemztr" target="_blank" rel="noopener noreferrer">@wearemztr</a>
      </li>
    </ul>
  </section>

  <section class="mz-card box mz-rise" style="animation-delay: 80ms" aria-label="Formulaire de contact">
    {#if status === "done"}
      <div class="done" role="status">
        <h2 class="mz-display mz-h3">Merci {firstName.trim()} !</h2>
        <p>Votre message est bien parti. On vous répond très vite à {email.trim()}.</p>
        <a class="mz-btn mz-btn--ghost" href="/">Retour à l’accueil</a>
      </div>
    {:else if status === "unavailable"}
      <div class="done" role="status">
        <h2 class="mz-display mz-h3">Presque !</h2>
        <p>
          L’envoi direct n’est pas disponible pour le moment. Votre message est prêt : ouvrez votre messagerie
          pour l’envoyer à {CONTACT_EMAIL}.
        </p>
        <a class="mz-btn" href={mailtoHref}>Ouvrir ma messagerie</a>
      </div>
    {:else}
      <form onsubmit={preventDefault(submit)} class="form" novalidate>
        <div class="mz-field full">
          <label for="contact-reason">Raison de votre message *</label>
          <select id="contact-reason" bind:value={reason} required>
            <option value="" disabled>Choisissez…</option>
            {#each CONTACT_REASONS as r (r.id)}
              <option value={r.id}>{r.label}</option>
            {/each}
          </select>
        </div>
        {#if subject}
          <p class="full about">
            <span class="about-label">À propos de</span> <span class="mz-chip">{subject}</span>
            <button type="button" class="clear" onclick={() => (subject = "")} aria-label="Retirer le sujet">×</button>
          </p>
        {/if}
        <div class="mz-field">
          <label for="contact-first">Prénom *</label>
          <input id="contact-first" bind:value={firstName} autocomplete="given-name" maxlength="80" required />
        </div>
        <div class="mz-field">
          <label for="contact-last">Nom</label>
          <input id="contact-last" bind:value={lastName} autocomplete="family-name" maxlength="80" />
        </div>
        <div class="mz-field">
          <label for="contact-email">Email *</label>
          <input id="contact-email" type="email" bind:value={email} autocomplete="email" maxlength="200" required />
        </div>
        <div class="mz-field">
          <label for="contact-phone">Téléphone</label>
          <input id="contact-phone" type="tel" bind:value={phone} autocomplete="tel" maxlength="40" />
        </div>
        <div class="mz-field full">
          <label for="contact-message">Message *</label>
          <textarea id="contact-message" bind:value={message} rows="6" maxlength="5000" {placeholder} required></textarea>
        </div>
        <div class="hp" aria-hidden="true">
          <label for="contact-website">Site web</label>
          <input id="contact-website" bind:value={website} tabindex="-1" autocomplete="off" />
        </div>
        {#if siteKey}
          <div class="full captcha" bind:this={turnstileEl}></div>
        {/if}
        <div class="full actions">
          <button class="mz-btn" type="submit" disabled={status === "sending"}>
            {status === "sending" ? "Envoi…" : "Envoyer"}
          </button>
        </div>
      </form>
      {#if errorMsg}
        <p class="mz-feedback mz-feedback--error" role="alert">{errorMsg}</p>
      {/if}
    {/if}
  </section>
</div>

<style>
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    gap: 3rem;
    align-items: start;
    padding-top: 3rem;
    padding-bottom: 3rem;
  }

  .intro h1 {
    margin: 0 0 0.75rem;
  }

  .direct {
    list-style: none;
    margin: 2rem 0 0;
    padding: 0;
    display: grid;
    gap: 0.75rem;
  }

  .direct li {
    display: flex;
    gap: 1rem;
    align-items: baseline;
  }

  .direct .mz-label {
    min-width: 5.5rem;
  }

  .box {
    padding: 1.75rem;
  }

  .form {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.9rem 1rem;
  }

  .full {
    grid-column: 1 / -1;
  }

  .form textarea {
    resize: vertical;
    min-height: 8rem;
  }

  .about {
    margin: -0.25rem 0 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: var(--mz-muted);
  }

  .about-label {
    white-space: nowrap;
  }

  .about .mz-chip {
    white-space: normal;
  }

  .clear {
    border: none;
    background: none;
    color: var(--mz-muted);
    font-size: 1.1rem;
    line-height: 1;
    cursor: pointer;
    padding: 0.2rem;
  }

  .clear:hover {
    color: var(--mz-ink);
  }

  /* Hors écran plutôt que display:none : certains robots ignorent les champs masqués. */
  .hp {
    position: absolute;
    left: -10000px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  }

  .captcha {
    min-height: 65px;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
  }

  .done {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .done h2,
  .done p {
    margin: 0;
  }

  .done p {
    line-height: 1.6;
  }

  @media (max-width: 820px) {
    .layout {
      grid-template-columns: 1fr;
      gap: 1.5rem;
      padding-top: 2rem;
    }

    .direct {
      margin-top: 1.25rem;
    }
  }

  @media (max-width: 560px) {
    .box {
      padding: 1.25rem;
    }

    .form {
      grid-template-columns: 1fr;
    }

    .actions .mz-btn {
      width: 100%;
    }
  }
</style>
