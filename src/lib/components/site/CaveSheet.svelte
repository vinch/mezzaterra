<script lang="ts" module>
  /* Feuilles ouvertes, la plus récente en dernier : seule celle du dessus répond à Échap, et la
     page reste bloquée tant qu'il en reste une. */
  const openStack: symbol[] = [];
</script>

<script lang="ts">
  import { tick, untrack, type Snippet } from "svelte";
  import { fade, fly } from "svelte/transition";
  import { self } from "$lib/ui/events";

  /**
   * Feuille du mode live (thème cave) : monte du bas sur mobile, centrée sur grand écran.
   * Un clic sur le fond ou Échap ferme, comme le bouton × ; `locked` empêche de fermer (envoi en cours).
   * Ouverte : page bloquée, focus sur la feuille (pas sur un champ : le clavier du téléphone resterait
   * fermé), rendu à l'élément d'origine à la fermeture.
   */
  interface Props {
    open: boolean;
    title: string;
    onclose: () => void;
    /** Bouton × en haut à droite. */
    closable?: boolean;
    locked?: boolean;
    children: Snippet;
  }

  let { open, title, onclose, closable = true, locked = false, children }: Props = $props();
  const titleId = $props.id();
  const token = Symbol();
  let sheet = $state<HTMLElement | undefined>();

  $effect(() => {
    if (!open) return;
    const returnFocus = document.activeElement as HTMLElement | null;
    untrack(() => {
      openStack.push(token);
      document.body.style.overflow = "hidden";
      void tick().then(() => sheet?.focus());
    });
    return () => {
      openStack.splice(openStack.indexOf(token), 1);
      if (!openStack.length) document.body.style.overflow = "";
      returnFocus?.focus?.();
    };
  });

  function onkeydown(e: KeyboardEvent) {
    if (open && !locked && e.key === "Escape" && openStack[openStack.length - 1] === token) onclose();
  }
</script>

<svelte:window {onkeydown} />

{#if open}
  <div class="backdrop" transition:fade={{ duration: 150 }} onclick={self(() => !locked && onclose())} role="presentation">
    <div
      bind:this={sheet}
      class="sheet"
      transition:fly={{ y: 40, duration: 250 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabindex="-1"
    >
      {#if closable}
        <button type="button" class="close" onclick={onclose} disabled={locked} aria-label="Fermer">×</button>
      {/if}
      <h2 id={titleId}>{title}</h2>
      {@render children()}
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: var(--mz-backdrop);
  }

  .sheet {
    position: relative;
    width: min(34rem, 100%);
    max-height: 90dvh;
    overflow-y: auto;
    padding: 1.6rem 1.3rem calc(1.5rem + env(safe-area-inset-bottom));
    border-radius: var(--mz-radius-lg) var(--mz-radius-lg) 0 0;
    background: var(--mz-cave-surface);
    color: var(--mz-cave-text);
    font-family: var(--mz-font-body);
    border-top: 1px solid var(--mz-cave-line);
    outline: none;
  }

  h2 {
    margin: 0 0 0.5rem;
    font-family: var(--mz-font-display);
    font-weight: 500;
    font-size: 1.8rem;
  }

  .close {
    position: absolute;
    top: 0.8rem;
    right: 0.9rem;
    width: 2.2rem;
    height: 2.2rem;
    border-radius: 50%;
    border: none;
    background: var(--mz-cave-surface-2);
    color: var(--mz-cave-text);
    font-size: 1.4rem;
    cursor: pointer;
  }

  /* Petit visuel, mais une cible de 44 px au doigt. */
  .close::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: 44px;
    height: 44px;
    transform: translate(-50%, -50%);
  }

  @media (min-width: 720px) {
    .backdrop {
      align-items: center;
    }

    .sheet {
      border-radius: var(--mz-radius-lg);
    }
  }
</style>
