<script lang="ts">
  /** Cœur « favori » du mode live (thème cave) : un appui ajoute ou retire le produit des favoris. */
  interface Props {
    active: boolean;
    onchange: (active: boolean) => void;
    /** Nom du produit, pour l'étiquette lue par les lecteurs d'écran. */
    label: string;
    size?: "md" | "sm";
  }

  let { active, onchange, label, size = "md" }: Props = $props();
</script>

<button
  type="button"
  class="fav"
  class:on={active}
  class:small={size === "sm"}
  aria-pressed={active}
  aria-label={active ? `Retirer ${label} des favoris` : `Ajouter ${label} aux favoris`}
  onclick={() => onchange(!active)}
>
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z" />
  </svg>
</button>

<style>
  .fav {
    position: relative;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 3rem;
    height: 3rem;
    padding: 0;
    border-radius: 50%;
    border: 1px solid var(--mz-cave-line);
    background: var(--mz-cave-sunk);
    color: var(--mz-cave-muted);
    cursor: pointer;
    transition: color 0.15s ease, border-color 0.15s ease;
  }

  svg {
    width: 55%;
    height: 55%;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linejoin: round;
    transition: transform 0.25s var(--mz-ease);
  }

  .on {
    color: var(--mz-cave-favorite);
    border-color: color-mix(in srgb, var(--mz-cave-favorite) 45%, transparent);
  }

  .on svg {
    fill: currentColor;
    transform: scale(1.08);
  }

  .small {
    width: 2.2rem;
    height: 2.2rem;
  }

  /* Petit visuel, mais une cible de 44 px au doigt. */
  .small::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: 44px;
    height: 44px;
    transform: translate(-50%, -50%);
  }

  @media (prefers-reduced-motion: reduce) {
    svg {
      transition: none;
    }
  }
</style>
