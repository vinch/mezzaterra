<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { IconMinus, IconPlus } from "./icons";

  /** Quantité « − valeur + ». Taille md (40) ou lg (44, tactile). */
  export let value = 0;
  export let min = 0;
  export let max = 9999;
  export let label = "Quantité";
  export let size: "md" | "lg" = "md";

  const dispatch = createEventDispatcher<{ change: number }>();

  function set(v: number) {
    const next = Math.max(min, Math.min(max, Math.round(v)));
    if (next === value) return;
    value = next;
    dispatch("change", next);
  }
</script>

<div class="stepper stepper--{size}" role="group" aria-label={label}>
  <button type="button" aria-label="Diminuer : {label}" disabled={value <= min} on:click={() => set(value - 1)}>
    <IconMinus size={16} strokeWidth={2} />
  </button>
  <input
    type="text"
    inputmode="numeric"
    aria-label={label}
    value={value}
    on:change={(e) => set(parseInt(e.currentTarget.value, 10) || 0)}
  />
  <button type="button" aria-label="Augmenter : {label}" disabled={value >= max} on:click={() => set(value + 1)}>
    <IconPlus size={16} strokeWidth={2} />
  </button>
</div>

<style>
  .stepper {
    display: inline-flex;
    align-items: center;
    height: 40px;
    border: 1px solid var(--input-border);
    border-radius: var(--r-sm);
    background: #fff;
  }

  .stepper--lg {
    height: 44px;
  }

  button {
    display: grid;
    place-items: center;
    width: 36px;
    height: 100%;
    border: none;
    background: none;
    color: var(--teal-600);
    cursor: pointer;
    border-radius: var(--r-sm);
  }

  .stepper--lg button {
    width: 44px;
  }

  button:hover:not(:disabled) {
    background: var(--mist);
  }

  button:disabled {
    color: #b6b9b4;
    cursor: not-allowed;
  }

  input {
    width: 36px;
    height: 100%;
    border: none;
    background: none;
    text-align: center;
    font: inherit;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--ink);
  }

  input:focus {
    outline: none;
  }
</style>
