<script lang="ts">
  import SiteFooter from "$lib/components/SiteFooter.svelte";
  import { supabase } from "$lib/supabase";

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
    feedback =
      "Merci ! Nous vous contacterons pour les prochaines dégustations.";
    email = "";
    isSubmitting = false;
  }
</script>

<div class="page">
  <main class="container">
    <img src="/logo.png" alt="Mezzaterra" class="logo-home" />

    <section class="subscribe-flat" aria-label="Inscription degustations">
      <h2>En savoir plus sur les degustations Mezzaterra...</h2>
      <form on:submit|preventDefault={handleSubscribe} class="subscribe-form">
        <input
          type="email"
          bind:value={email}
          placeholder="Votre email"
          autocomplete="email"
          required
        />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Envoi..." : "Je m'inscris"}
        </button>
      </form>

      {#if feedback}
        <p class="feedback {feedbackType}" role="status">{feedback}</p>
      {/if}
    </section>
  </main>

  <SiteFooter />
</div>

<style>
  .page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .container {
    flex: 1;
    padding: 1.5rem 1rem 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
  }

  .logo-home {
    width: min(96vw, 68rem);
    max-width: 100%;
    max-height: min(62vh, 40rem);
    object-fit: contain;
    display: block;
  }

  .subscribe-flat {
    width: min(92vw, 36rem);
    padding: 0.25rem 0;
  }

  .subscribe-flat h2 {
    margin: 0 0 0.75rem;
    font-size: clamp(1rem, 1.6vw, 1.1rem);
    color: #4c3a2d;
    font-weight: 500;
    letter-spacing: 0.01em;
  }

  .subscribe-form {
    display: flex;
    gap: 0.6rem;
    align-items: center;
  }

  .subscribe-form input {
    flex: 1 1 14rem;
    border: none;
    border-bottom: 2px solid #b7a38e;
    border-radius: 0;
    background: transparent;
    padding: 0.55rem 0.2rem;
    font-size: 0.95rem;
    color: #2d1810;
  }

  .subscribe-form input:focus {
    outline: none;
    border-bottom-color: #2d1810;
  }

  .subscribe-form button {
    border: 1px solid #2d1810;
    border-radius: 999px;
    padding: 0.55rem 0.95rem;
    background: transparent;
    color: #2d1810;
    font-weight: 500;
    cursor: pointer;
    transition:
      background-color 0.2s ease,
      color 0.2s ease;
  }

  .subscribe-form button:hover:not(:disabled) {
    background: #2d1810;
    color: #fff;
  }

  .subscribe-form button:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .feedback {
    margin: 0.6rem 0 0;
    font-size: 0.9rem;
  }

  .feedback.success {
    color: #1f6b39;
  }

  .feedback.error {
    color: #9e2f2f;
  }

  @media (max-width: 640px) {
    .container {
      justify-content: flex-start;
      padding-top: 1.25rem;
    }

    .logo-home {
      max-height: 42vh;
    }

    .subscribe-form {
      flex-wrap: wrap;
    }

    .subscribe-form button {
      width: auto;
    }
  }
</style>
