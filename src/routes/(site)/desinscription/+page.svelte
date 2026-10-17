<script lang="ts">
  import { page } from "$app/stores";
  import { supabase } from "$lib/supabase";

  let state: "idle" | "busy" | "done" | "error" = "idle";
  $: id = $page.url.searchParams.get("id") || "";

  async function unsubscribe() {
    state = "busy";
    const { error } = await supabase.rpc("unsubscribe_email", { p_id: id });
    state = error ? "error" : "done";
  }
</script>

<svelte:head>
  <title>Désinscription — Mezzaterra</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="mz-container mz-section wrap">
  <div class="mz-card box">
    <h1 class="mz-display mz-h2">Désinscription</h1>
    {#if !id}
      <p class="mz-muted">Ce lien de désinscription est incomplet. Répondez simplement à l’un de nos emails et nous vous retirerons de la liste.</p>
    {:else if state === "done"}
      <p>C’est fait : vous ne recevrez plus nos invitations. À bientôt peut-être autour d’un verre !</p>
      <a class="mz-btn mz-btn--ghost" href="/">Retour à l’accueil</a>
    {:else if state === "error"}
      <p class="mz-feedback mz-feedback--error">Impossible de traiter la demande pour le moment. Répondez à l’un de nos emails et nous nous en chargeons.</p>
    {:else}
      <p>Vous ne souhaitez plus recevoir les invitations aux dégustations Mezzaterra ?</p>
      <button class="mz-btn" type="button" disabled={state === "busy"} on:click={unsubscribe}>
        {state === "busy" ? "…" : "Me désinscrire"}
      </button>
    {/if}
  </div>
</div>

<style>
  .wrap {
    display: flex;
    justify-content: center;
  }

  .box {
    max-width: 32rem;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .box p {
    margin: 0;
    line-height: 1.6;
  }
</style>
