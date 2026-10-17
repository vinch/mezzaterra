<script lang="ts">
  import { createEventDispatcher, onDestroy, tick } from "svelte";
  import { fade, fly } from "svelte/transition";
  import IconButton from "./IconButton.svelte";
  import { IconX } from "./icons";

  /**
   * Modale : en-tête (titre + fermer), corps défilant, pied fixe (ghost à gauche du primary).
   * Focus piégé à l'intérieur, Échap ferme, le focus revient à l'élément d'origine.
   */
  export let open = false;
  export let title = "";
  export let maxWidth = 640;
  export let closeOnBackdrop = true;
  /** Rôle ARIA : `alertdialog` pour les confirmations. */
  export let role: "dialog" | "alertdialog" = "dialog";

  const dispatch = createEventDispatcher<{ close: void }>();
  const titleId = `modal-title-${Math.random().toString(36).slice(2, 9)}`;
  let dialog: HTMLElement;
  let returnFocus: HTMLElement | null = null;

  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  async function onOpen() {
    returnFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    await tick();
    const first = dialog?.querySelector<HTMLElement>("[autofocus]") ?? dialog?.querySelector<HTMLElement>(".modal-body " + FOCUSABLE.split(",").join(", .modal-body "));
    (first ?? dialog)?.focus();
  }

  function onClose() {
    document.body.style.overflow = "";
    returnFocus?.focus?.();
  }

  let wasOpen = false;
  $: if (open !== wasOpen) {
    wasOpen = open;
    if (open) void onOpen();
    else onClose();
  }
  onDestroy(() => {
    if (open) document.body.style.overflow = "";
  });

  function close() {
    dispatch("close");
  }

  /* Si le focus a quitté la modale (élément retiré du DOM…), Échap et Tab restent gérés. */
  function onWindowKeydown(e: KeyboardEvent) {
    if (!open || !dialog || dialog.contains(document.activeElement)) return;
    if (e.key === "Escape") {
      close();
    } else if (e.key === "Tab") {
      e.preventDefault();
      dialog.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "Tab" || !dialog) return;
    const nodes = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (n) => n.offsetParent !== null,
    );
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
</script>

<svelte:window on:keydown={onWindowKeydown} />

{#if open}
  <div class="backdrop" transition:fade={{ duration: 120 }} on:click|self={() => closeOnBackdrop && close()} role="presentation">
    <div
      bind:this={dialog}
      class="modal"
      style="--max-w: {maxWidth}px"
      {role}
      aria-modal="true"
      aria-labelledby={titleId}
      tabindex="-1"
      on:keydown={onKeydown}
      transition:fly={{ y: 12, duration: 160 }}
    >
      <header class="modal-head">
        <h2 id={titleId} class="modal-title">{title}</h2>
        <slot name="title-extra" />
        <span class="spacer"></span>
        <IconButton label="Fermer" on:click={close}>
          <IconX size={18} strokeWidth={1.75} />
        </IconButton>
      </header>
      <div class="modal-body">
        <slot />
      </div>
      {#if $$slots.footer}
        <footer class="modal-foot">
          <slot name="footer" />
        </footer>
      {/if}
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 2000;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 40px 16px;
    background: rgba(28, 44, 46, 0.55);
    overflow-y: auto;
  }

  .modal {
    width: 100%;
    max-width: var(--max-w);
    max-height: calc(100vh - 80px);
    display: flex;
    flex-direction: column;
    background: var(--card);
    border-radius: var(--r-md);
    box-shadow: var(--shadow-pop);
    font-family: var(--font-sans);
    font-size: 14px;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }

  .modal:focus {
    outline: none;
  }

  .modal-head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 16px 16px 24px;
    border-bottom: 1px solid var(--border-soft);
  }

  .modal-title {
    margin: 0;
    font-family: var(--font-serif);
    font-weight: 600;
    font-size: 22px;
    line-height: 28px;
    color: var(--title);
  }

  .spacer {
    flex: 1;
  }

  .modal-body {
    padding: 20px 24px 24px;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }

  .modal-foot {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    padding: 14px 24px;
    border-top: 1px solid var(--border-soft);
    background: var(--table-head);
    border-radius: 0 0 var(--r-md) var(--r-md);
  }

  @media (max-width: 767px) {
    .backdrop {
      padding: 0;
      align-items: stretch;
    }

    .modal {
      max-height: none;
      min-height: 100%;
      border-radius: 0;
    }

    .modal-body {
      padding: 16px;
    }

    .modal-foot {
      position: sticky;
      bottom: 0;
      border-radius: 0;
      padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
      flex-wrap: wrap;
    }
  }
</style>
