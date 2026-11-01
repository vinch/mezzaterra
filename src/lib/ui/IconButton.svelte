<script lang="ts">
  import type { Snippet } from "svelte";
  interface Props {
    onclick?: (e: MouseEvent) => void;
    onkeydown?: (e: KeyboardEvent) => void;
    /** Bouton icône 36×36 (44 sur mobile). `label` est obligatoire (aria-label). */
    label: string;
    href?: string | null;
    variant?: "ghost" | "outline" | "dark";
    disabled?: boolean;
    pressed?: boolean | undefined;
    expanded?: boolean | undefined;
    haspopup?: "menu" | "dialog" | undefined;
    controls?: string | undefined;
    target?: string | undefined;
    el?: HTMLElement | null;
    children?: Snippet;
  }

  let {
    label,
    href = null,
    variant = "ghost",
    disabled = false,
    pressed = undefined,
    expanded = undefined,
    haspopup = undefined,
    controls = undefined,
    target = undefined,
    el = $bindable(),
    children,
    onclick,
    onkeydown
  }: Props = $props();
</script>

{#if href}
  <a bind:this={el} {href} {target} class="icon-btn icon-btn--{variant}" aria-label={label} title={label} {onclick}>
    {@render children?.()}
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
    {onclick}
    {onkeydown}
  >
    {@render children?.()}
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
    background: var(--control-bg);
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
