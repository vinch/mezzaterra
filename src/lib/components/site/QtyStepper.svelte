<script lang="ts">
  /** Nombre de bouteilles − / + du mode live (thème cave). La page borne la valeur. */
  interface Props {
    value: number;
    onchange: (value: number) => void;
    size?: "md" | "sm";
    disabled?: boolean;
  }

  let { value, onchange, size = "md", disabled = false }: Props = $props();
</script>

<div class="stepper" class:small={size === "sm"} role="group" aria-label="Nombre de bouteilles">
  <button type="button" onclick={() => onchange(value - 1)} disabled={disabled || value <= 0} aria-label={value === 1 ? "Retirer" : "Une bouteille de moins"}>−</button>
  <output aria-live="polite">{value}</output>
  <button type="button" onclick={() => onchange(value + 1)} {disabled} aria-label="Une bouteille de plus">+</button>
</div>

<style>
  .stepper {
    display: inline-flex;
    align-items: center;
    border-radius: var(--mz-radius-pill);
    background: var(--mz-cave-sunk);
    border: 1px solid var(--mz-cave-line);
  }

  button {
    position: relative;
    width: 2.6rem;
    height: 2.6rem;
    border: none;
    border-radius: 50%;
    background: none;
    color: inherit;
    font-size: 1.3rem;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.3;
  }

  output {
    min-width: 1.6rem;
    text-align: center;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .small button {
    width: 2rem;
    height: 2rem;
    font-size: 1.05rem;
  }

  /* Petit visuel, mais une cible de 44 px au doigt. */
  .small button::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: 44px;
    height: 44px;
    transform: translate(-50%, -50%);
  }
</style>
