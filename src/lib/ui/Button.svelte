<script lang="ts">
  /**
   * Bouton du design system.
   * Règle : un seul `primary` visible par écran ou par modale.
   * `danger-solid` est réservé aux confirmations (ConfirmDialog).
   */
  export let variant: "primary" | "secondary" | "ghost" | "danger" | "danger-solid" = "secondary";
  export let size: "md" | "sm" | "lg" = "md";
  export let href: string | null = null;
  export let type: "button" | "submit" = "button";
  /** Formulaire soumis par ce bouton quand il est placé hors du <form> (pied de modale). */
  export let form: string | undefined = undefined;
  export let disabled = false;
  export let block = false;
  export let target: string | undefined = undefined;
  export let rel: string | undefined = undefined;
  export let title: string | undefined = undefined;
  export let ariaLabel: string | undefined = undefined;
</script>

{#if href && !disabled}
  <a
    {href}
    {target}
    {rel}
    {title}
    aria-label={ariaLabel}
    class="btn btn--{variant} btn--{size}"
    class:btn--block={block}
    on:click
  >
    <slot />
  </a>
{:else}
  <button
    {type}
    {form}
    {disabled}
    {title}
    aria-label={ariaLabel}
    class="btn btn--{variant} btn--{size}"
    class:btn--block={block}
    on:click
  >
    <slot />
  </button>
{/if}

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 40px;
    padding: 0 16px;
    border-radius: var(--r-sm);
    border: 1px solid transparent;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
    text-decoration: none;
    cursor: pointer;
    transition:
      background-color 0.15s ease,
      border-color 0.15s ease,
      color 0.15s ease;
  }

  .btn--sm {
    height: 32px;
    padding: 0 12px;
    font-size: 13px;
  }

  .btn--lg {
    height: 48px;
    padding: 0 20px;
    font-size: 15px;
  }

  .btn--block {
    width: 100%;
  }

  .btn--primary {
    background: var(--teal-600);
    color: #fff;
  }

  .btn--primary:hover:not(:disabled) {
    background: var(--teal-700);
  }

  .btn--secondary {
    background: #fff;
    border-color: var(--btn-border);
    color: var(--ink);
  }

  .btn--secondary:hover:not(:disabled) {
    border-color: var(--teal-600);
    color: var(--teal-700);
  }

  .btn--ghost {
    background: transparent;
    color: var(--teal-600);
    padding-left: 10px;
    padding-right: 10px;
  }

  .btn--ghost:hover:not(:disabled) {
    background: var(--mist);
    color: var(--teal-700);
  }

  .btn--danger {
    background: #fff;
    border-color: var(--danger);
    color: var(--danger);
  }

  .btn--danger:hover:not(:disabled) {
    background: #fbefef;
  }

  .btn--danger-solid {
    background: var(--danger);
    color: #fff;
  }

  .btn--danger-solid:hover:not(:disabled) {
    background: #7f2222;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn :global(svg) {
    flex-shrink: 0;
  }

  @media (max-width: 767px) {
    .btn--md,
    .btn--sm {
      min-height: 44px;
    }
  }
</style>
