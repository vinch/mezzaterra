<script lang="ts">
  import type { Snippet } from "svelte";
  import { IconTriangle } from "./icons";

  /**
   * Champ : libellé au-dessus, astérisque rouge si obligatoire, aide en 12 px dessous,
   * erreur = message avec icône. Le contrôle reçoit `describedby` et `invalid` en paramètres du snippet.
   */
  interface Props {
    id: string;
    label: string;
    required?: boolean;
    help?: string;
    error?: string;
    optional?: boolean;
    children?: Snippet<[any]>;
  }

  let {
    id,
    label,
    required = false,
    help = "",
    error = "",
    optional = false,
    children
  }: Props = $props();

  let helpId = $derived(help ? `${id}-help` : "");
  let errorId = $derived(error ? `${id}-error` : "");
  let describedby = $derived([errorId, helpId].filter(Boolean).join(" ") || undefined);
</script>

<div class="field">
  <label for={id} class="label">
    {label}{#if required}<span class="req" aria-hidden="true"> *</span><span class="sr-only"> (obligatoire)</span>{/if}
    {#if optional}<span class="opt">(optionnel)</span>{/if}
  </label>
  {@render children?.({ describedby, invalid: !!error })}
  {#if error}
    <p id={errorId} class="error"><IconTriangle size={14} strokeWidth={1.75} aria-hidden="true" />{error}</p>
  {/if}
  {#if help}
    <p id={helpId} class="help">{help}</p>
  {/if}
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .label {
    font-weight: 500;
    font-size: 13px;
    line-height: 18px;
    color: var(--ink);
  }

  .req {
    color: var(--danger);
  }

  .opt {
    margin-left: 4px;
    font-weight: 400;
    color: var(--ink-2);
  }

  .help,
  .error {
    margin: 0;
    font-size: 12px;
    line-height: 16px;
  }

  .help {
    color: var(--ink-2);
  }

  .error {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--danger);
  }
</style>
