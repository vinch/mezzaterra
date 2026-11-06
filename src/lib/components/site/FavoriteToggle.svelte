<script lang="ts">
  import { IconHeart } from "$lib/ui/icons";

  /** Cœur « favori » du mode live (thème cave) : un appui ajoute ou retire le produit des favoris. */
  interface Props {
    active: boolean;
    onchange: (active: boolean) => void;
    /** Nom du lot (avec année et contenance s'il le faut), lu par les lecteurs d'écran ; l'état passe par aria-pressed. */
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
  aria-label="Favori : {label}"
  onclick={() => onchange(!active)}
>
  <IconHeart size={size === "sm" ? 16 : 22} strokeWidth={1.75} aria-hidden="true" />
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

  .fav :global(svg) {
    transition: transform 0.25s var(--mz-ease);
  }

  .on {
    color: var(--mz-cave-favorite);
    border-color: color-mix(in srgb, var(--mz-cave-favorite) 45%, transparent);
  }

  .on :global(svg) {
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
    .fav :global(svg) {
      transition: none;
    }
  }
</style>
