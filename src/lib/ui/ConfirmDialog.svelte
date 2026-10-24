<script lang="ts">
  import type { Snippet } from "svelte";
  import Modal from "./Modal.svelte";
  import Button from "./Button.svelte";

  /**
   * Confirmation d'une action destructive.
   * Titre en question, phrase d'impact, « Annuler » (ghost) puis « Oui, supprimer » (danger-solid).
   */
  interface Props {
    onconfirm?: () => void;
    oncancel?: () => void;
    ondone?: () => void;
    open?: boolean;
    title?: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    busy?: boolean;
    /**
     * Action confirmée. Si fournie, la boîte gère seule l'attente (impossible de l'annuler pendant)
     * puis appelle `ondone` ; sinon, elle appelle seulement `onconfirm`.
     */
    action?: (() => Promise<unknown>) | null;
    children?: Snippet;
  }

  let {
    open = $bindable(false),
    title = "Supprimer ?",
    message = "",
    confirmLabel = "Oui, supprimer",
    cancelLabel = "Annuler",
    busy = $bindable(false),
    action = null,
    children,
    onconfirm,
    oncancel,
    ondone
  }: Props = $props();

  function cancel() {
    if (busy && action) return;
    open = false;
    oncancel?.();
  }

  async function confirm() {
    if (!action) return onconfirm?.();
    busy = true;
    try {
      await action();
    } finally {
      busy = false;
      open = false;
      ondone?.();
    }
  }
</script>

<Modal {open} {title} maxWidth={460} role="alertdialog" onclose={cancel}>
  <p class="impact">{message}{@render children?.()}</p>
  {#snippet footer()}

      <Button variant="ghost" disabled={busy && !!action} onclick={cancel}>{cancelLabel}</Button>
      <Button variant="danger-solid" disabled={busy} onclick={confirm}>
        {busy ? "…" : confirmLabel}
      </Button>

  {/snippet}
</Modal>

<style>
  .impact {
    margin: 0;
    line-height: 22px;
    color: var(--ink);
  }
</style>
