<script lang="ts">
  import { preventDefault } from "$lib/ui/events";
  import { onMount } from "svelte";
  import { supabase } from "$lib/supabase";
  import { fetchSeats, type SeatInfo } from "$lib/publicData";

  interface Props {
    tastingId: string;
  }

  let { tastingId }: Props = $props();

  let seats = $state<SeatInfo | null>(null);
  let firstName = $state("");
  let lastName = $state("");
  let email = $state("");
  let phone = $state("");
  let count = $state(2);
  let submitting = $state(false);
  let result = $state<"confirmed" | "waitlist" | "already_registered" | null>(null);
  let errorMsg = $state("");

  const ERRORS: Record<string, string> = {
    invalid_email: "Cette adresse email ne semble pas valide.",
    invalid_name: "Merci d’indiquer votre prénom.",
    invalid_seats: "Le nombre de places doit être compris entre 1 et 10.",
    past: "Cette dégustation est déjà passée.",
    not_found: "Cette dégustation n’existe plus.",
  };

  onMount(async () => {
    seats = await fetchSeats(tastingId);
  });

  let full = $derived(seats?.seats_left != null && seats.seats_left <= 0);

  async function submit() {
    errorMsg = "";
    if (!firstName.trim() || !email.trim()) {
      errorMsg = "Prénom et email sont obligatoires.";
      return;
    }
    submitting = true;

    const { data, error } = await supabase.rpc("register_for_tasting", {
      p_tasting_id: tastingId,
      p_first_name: firstName.trim(),
      p_last_name: lastName.trim(),
      p_email: email.trim(),
      p_phone: phone.trim(),
      p_seats: count,
    });

    submitting = false;
    if (error) {
      const key = Object.keys(ERRORS).find((k) => error.message?.includes(k));
      errorMsg = key ? ERRORS[key] : "Impossible d’enregistrer votre inscription pour le moment.";
      return;
    }

    result = data as typeof result;
    seats = await fetchSeats(tastingId);
  }
</script>

<div class="registration">
  {#if seats?.seats_left != null}
    <p class="seats" class:full>
      {#if full}
        Complet — inscrivez-vous sur la liste d’attente
      {:else}
        <strong>{seats.seats_left}</strong> place{seats.seats_left > 1 ? "s" : ""} restante{seats.seats_left > 1 ? "s" : ""}
        <span class="meter" aria-hidden="true">
          <span style="width: {seats.capacity ? Math.min(100, (seats.seats_taken / seats.capacity) * 100) : 0}%"></span>
        </span>
      {/if}
    </p>
  {/if}

  {#if result}
    <div class="done" role="status">
      {#if result === "confirmed"}
        <p><strong>C’est noté, {firstName} !</strong> Votre place est réservée. À très vite 🍷</p>
      {:else if result === "waitlist"}
        <p><strong>Vous êtes sur la liste d’attente.</strong> Nous vous prévenons dès qu’une place se libère.</p>
      {:else}
        <p>Vous êtes déjà inscrit·e avec cette adresse. À bientôt !</p>
      {/if}
    </div>
  {:else}
    <form onsubmit={preventDefault(submit)} class="form">
      <div class="mz-field">
        <label for="reg-first">Prénom *</label>
        <input id="reg-first" bind:value={firstName} autocomplete="given-name" required />
      </div>
      <div class="mz-field">
        <label for="reg-last">Nom</label>
        <input id="reg-last" bind:value={lastName} autocomplete="family-name" />
      </div>
      <div class="mz-field">
        <label for="reg-email">Email *</label>
        <input id="reg-email" type="email" bind:value={email} autocomplete="email" required />
      </div>
      <div class="mz-field">
        <label for="reg-phone">Téléphone</label>
        <input id="reg-phone" type="tel" bind:value={phone} autocomplete="tel" />
      </div>
      <div class="mz-field seats-field">
        <span class="mz-label" id="reg-seats-label">Places</span>
        <div class="stepper" role="group" aria-labelledby="reg-seats-label">
          <button type="button" onclick={() => (count = Math.max(1, count - 1))} aria-label="Une place de moins">−</button>
          <output aria-live="polite">{count}</output>
          <button type="button" onclick={() => (count = Math.min(10, count + 1))} aria-label="Une place de plus">+</button>
        </div>
      </div>
      <div class="submit">
        <button class="mz-btn mz-btn--block" type="submit" disabled={submitting}>
          {submitting ? "Envoi…" : full ? "Rejoindre la liste d’attente" : "Réserver ma place"}
        </button>
      </div>
    </form>
    {#if errorMsg}
      <p class="mz-feedback mz-feedback--error" role="alert">{errorMsg}</p>
    {/if}
  {/if}
</div>

<style>
  .seats {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
    margin: 0 0 1rem;
    font-size: 0.95rem;
    color: var(--mz-ink-soft);
  }

  .seats strong {
    font-family: var(--mz-font-display);
    font-size: 1.3rem;
    color: var(--mz-teal);
  }

  .seats.full {
    color: var(--mz-warning);
    font-weight: 600;
  }

  .meter {
    flex: 1 1 8rem;
    max-width: 12rem;
    height: 6px;
    border-radius: var(--mz-radius-pill);
    background: var(--mz-paper-sunk);
    overflow: hidden;
  }

  .meter span {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, var(--mz-teal-soft), var(--mz-teal));
    border-radius: inherit;
  }

  .form {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.9rem 1rem;
  }

  .seats-field {
    justify-content: flex-end;
  }

  .stepper {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--mz-line);
    border-radius: var(--mz-radius-pill);
    background: var(--mz-white);
    width: fit-content;
  }

  .stepper button {
    width: 2.6rem;
    height: 2.6rem;
    border: none;
    background: none;
    font-size: 1.2rem;
    color: var(--mz-teal);
    cursor: pointer;
    border-radius: 50%;
  }

  .stepper button:hover {
    background: var(--mz-teal-wash);
  }

  .stepper output {
    min-width: 2rem;
    text-align: center;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .submit {
    align-self: end;
  }

  .done {
    padding: 1rem 1.2rem;
    border-radius: var(--mz-radius-sm);
    background: color-mix(in srgb, var(--mz-success) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--mz-success) 30%, transparent);
  }

  .done p {
    margin: 0;
    line-height: 1.5;
  }

  @media (max-width: 560px) {
    .form {
      grid-template-columns: 1fr;
    }
  }
</style>
