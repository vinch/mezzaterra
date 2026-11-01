<script lang="ts">
  import { IconMinus, IconPlus } from "./icons";

  interface Props {
    onchange?: (value: number) => void;
    /** Quantité « − valeur + ». Taille md (40) ou lg (44, tactile). */
    value?: number;
    min?: number;
    max?: number;
    label?: string;
    size?: "md" | "lg";
  }

  let {
    value = $bindable(0),
    min = 0,
    max = 9999,
    label = "Quantité",
    size = "md",
    onchange
  }: Props = $props();

  function set(v: number) {
    const next = Math.max(min, Math.min(max, Math.round(v)));
    if (next === value) return;
    value = next;
    onchange?.(next);
  }
</script>

<div class="stepper stepper--{size}" role="group" aria-label={label}>
  <button type="button" aria-label="Diminuer : {label}" disabled={value <= min} onclick={() => set(value - 1)}>
    <IconMinus size={16} strokeWidth={2} />
  </button>
  <input
    type="text"
    inputmode="numeric"
    aria-label={label}
    value={value}
    onchange={(e) => set(parseInt(e.currentTarget.value, 10) || 0)}
  />
  <button type="button" aria-label="Augmenter : {label}" disabled={value >= max} onclick={() => set(value + 1)}>
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
    background: var(--control-bg);
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

  /* Comme les boutons désactivés : texte secondaire estompé. */
  button:disabled {
    color: var(--ink-2);
    opacity: 0.5;
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
