<script lang="ts" module>
  /* Modales ouvertes, la plus récente en dernier : seule celle du dessus gère Échap et Tab, et la
     page reste bloquée tant qu'il en reste une (confirmation ouverte par-dessus une modale…). */
  const openStack: symbol[] = [];
</script>

<script lang="ts">
  import { self } from "$lib/ui/events";
  import { tick, untrack, type Snippet } from "svelte";
  import { fade, fly } from "svelte/transition";
  import IconButton from "./IconButton.svelte";
  import { IconX } from "./icons";

  /**
   * Modale : en-tête (titre + fermer), corps défilant, pied fixe (ghost à gauche du primary).
   * Focus piégé à l'intérieur, Échap ferme, le focus revient à l'élément d'origine.
   */
  interface Props {
    open?: boolean;
    title?: string;
    maxWidth?: number;
    closeOnBackdrop?: boolean;
    /** Rôle ARIA : `alertdialog` pour les confirmations. */
    role?: "dialog" | "alertdialog";
    onclose?: () => void;
    /** À côté du titre (badge de statut…). */
    titleExtra?: Snippet;
    footer?: Snippet;
    children?: Snippet;
  }

  let {
    open = false,
    title = "",
    maxWidth = 640,
    closeOnBackdrop = true,
    role = "dialog",
    onclose,
    titleExtra,
    footer,
    children,
  }: Props = $props();

  const titleId = `modal-title-${Math.random().toString(36).slice(2, 9)}`;
  let dialog = $state<HTMLElement | undefined>();
  let returnFocus: HTMLElement | null = null;
  const token = Symbol();
  const isTop = () => openStack[openStack.length - 1] === token;
  /** Rang dans la pile à l'ouverture : la plus récente est peinte au-dessus, où qu'elle soit dans le DOM. */
  let depth = $state(0);

  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  async function onOpen() {
    returnFocus = document.activeElement as HTMLElement | null;
    depth = openStack.push(token);
    document.body.style.overflow = "hidden";
    await tick();
    const first = dialog?.querySelector<HTMLElement>("[autofocus]") ?? dialog?.querySelector<HTMLElement>(".modal-body " + FOCUSABLE.split(",").join(", .modal-body "));
    (first ?? dialog)?.focus();
  }

  function onClose() {
    const i = openStack.indexOf(token);
    if (i >= 0) openStack.splice(i, 1);
    if (!openStack.length) document.body.style.overflow = "";
    returnFocus?.focus?.();
  }

  /* Ouverture : défilement bloqué, focus dans la modale ; fermeture ou démontage : l'inverse. */
  $effect(() => {
    if (!open) return;
    untrack(() => void onOpen());
    return onClose;
  });

  function close() {
    onclose?.();
  }

  /* Si le focus a quitté la modale du dessus (élément retiré du DOM…), Échap et Tab restent gérés. */
  function onWindowKeydown(e: KeyboardEvent) {
    if (!open || !dialog || !isTop() || dialog.contains(document.activeElement)) return;
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

<svelte:window onkeydown={onWindowKeydown} />

{#if open}
  <div
    class="backdrop"
    style:z-index={2000 + depth}
    transition:fade={{ duration: 120 }}
    onclick={self(() => closeOnBackdrop && close())}
    role="presentation"
  >
    <div
      bind:this={dialog}
      class="modal"
      style="--max-w: {maxWidth}px"
      {role}
      aria-modal="true"
      aria-labelledby={titleId}
      tabindex="-1"
      onkeydown={onKeydown}
      transition:fly={{ y: 12, duration: 160 }}
    >
      <header class="modal-head">
        <h2 id={titleId} class="modal-title">{title}</h2>
        {@render titleExtra?.()}
        <span class="spacer"></span>
        <IconButton label="Fermer" onclick={close}>
          <IconX size={18} strokeWidth={1.75} />
        </IconButton>
      </header>
      <div class="modal-body">
        {@render children?.()}
      </div>
      {#if footer}
        <footer class="modal-foot">
          {@render footer()}
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
    background: var(--overlay);
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
