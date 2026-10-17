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

  const dispatch = createEventDispatcher<{ confirm: void; cancel: void }>();

  function cancel() {
    open = false;
    dispatch("cancel");
  }
</script>

<Modal {open} {title} maxWidth={460} role="alertdialog" on:close={cancel}>
  <p class="impact">{message}<slot /></p>
  <svelte:fragment slot="footer">
    <Button variant="ghost" on:click={cancel}>{cancelLabel}</Button>
    <Button variant="danger-solid" disabled={busy} on:click={() => dispatch("confirm")}>
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
