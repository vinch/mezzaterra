<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import Modal from "./Modal.svelte";
  import Button from "./Button.svelte";

  /**
   * Confirmation d'une action destructive.
   * Titre en question, phrase d'impact, « Annuler » (ghost) puis « Oui, supprimer » (danger-solid).
   */
  export let open = false;
  export let title = "Supprimer ?";
  export let message = "";
  export let confirmLabel = "Oui, supprimer";
  export let cancelLabel = "Annuler";
  export let busy = false;
  /**
   * Action confirmée. Si fournie, la boîte gère seule l'attente (impossible de l'annuler pendant)
   * et se ferme à la fin en émettant `done` ; sinon, écouter `confirm`.
   */
  export let onConfirm: (() => Promise<unknown>) | null = null;

  const dispatch = createEventDispatcher<{ confirm: void; cancel: void; done: void }>();

  function cancel() {
    if (busy && onConfirm) return;
    open = false;
    dispatch("cancel");
  }

  async function confirm() {
    if (!onConfirm) return dispatch("confirm");
    busy = true;
    try {
      await onConfirm();
    } finally {
      busy = false;
      open = false;
      dispatch("done");
    }
  }
</script>

<Modal {open} {title} maxWidth={460} role="alertdialog" on:close={cancel}>
  <p class="impact">{message}<slot /></p>
  <svelte:fragment slot="footer">
    <Button variant="ghost" disabled={busy && !!onConfirm} on:click={cancel}>{cancelLabel}</Button>
    <Button variant="danger-solid" disabled={busy} on:click={confirm}>
      {busy ? "…" : confirmLabel}
    </Button>
  </svelte:fragment>
</Modal>

<style>
  .impact {
    margin: 0;
    line-height: 22px;
    color: var(--ink);
  }
</style>
