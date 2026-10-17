<script lang="ts">
  /** Bouton icône 36×36 (44 sur mobile). `label` est obligatoire (aria-label). */
  export let label: string;
  export let href: string | null = null;
  export let variant: "ghost" | "outline" | "dark" = "ghost";
  export let disabled = false;
  export let pressed: boolean | undefined = undefined;
  export let expanded: boolean | undefined = undefined;
  export let haspopup: "menu" | "dialog" | undefined = undefined;
  export let controls: string | undefined = undefined;
  export let target: string | undefined = undefined;
  export let el: HTMLElement | null = null;
</script>

{#if href}
  <a bind:this={el} {href} {target} class="icon-btn icon-btn--{variant}" aria-label={label} title={label} on:click>
    <slot />
  </a>
{:else}
  <button
    bind:this={el}
    type="button"
    class="icon-btn icon-btn--{variant}"
    aria-label={label}
    title={label}
    aria-pressed={pressed}
    aria-expanded={expanded}
    aria-haspopup={haspopup}
    aria-controls={controls}
    {disabled}
    on:click
    on:keydown
  >
    <slot />
  </button>
{/if}

<style>
  .icon-btn {
    display: inline-grid;
    place-items: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border-radius: var(--r-sm);
    border: 1px solid transparent;
    background: transparent;
    color: var(--ink-2);
    cursor: pointer;
    flex-shrink: 0;
    transition:
      background-color 0.15s ease,
      color 0.15s ease;
  }

  .icon-btn:hover:not(:disabled),
  .icon-btn[aria-expanded="true"] {
    background: var(--mist);
    color: var(--teal-700);
  }

  .icon-btn--outline {
    border-color: var(--btn-border);
    background: #fff;
  }

  .icon-btn--dark {
    width: 40px;
    height: 40px;
    border-color: rgba(255, 255, 255, 0.18);
    color: #fff;
  }

  .icon-btn--dark:hover:not(:disabled),
  .icon-btn--dark[aria-expanded="true"] {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .icon-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  @media (max-width: 767px) {
    .icon-btn {
      width: 44px;
      height: 44px;
    }
  }
</style>
