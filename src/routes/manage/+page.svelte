<script lang="ts">
  import { supabase } from "$lib/supabase";
  import { getContext } from "svelte";

  const { user } = getContext<any>("auth");

  let email = "";
  let error = "";
  let loading = false;
  let magicLinkSent = false;

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

{#if !$user}
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
  <div class="page-container">
    <header class="page-header">
      <h1>Tableau de bord</h1>
    </header>

    <div class="page-content">
      <div class="welcome-section">
        <h2>Bienvenue dans l'interface de gestion</h2>
        <p>
          Les fonctionnalités d'administration seront ajoutées prochainement.
        </p>
      </div>
    </div>
  </div>
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

  .page-container {
    min-height: 100vh;
  }

  .page-header {
    background: white;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid #e9ecef;
  }

  .page-header h1 {
    margin: 0;
    color: #333;
    font-size: 1.75rem;
  }

  .page-content {
    padding: 2rem;
  }

  .welcome-section {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .welcome-section h2 {
    margin: 0 0 1rem 0;
    color: #333;
  }

  .welcome-section p {
    margin: 0;
    color: #666;
  }
</style>
