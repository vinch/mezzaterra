<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let show = false;
  export let title = "";
  export let modalId = "modal-title";
  /** Wider dialog for dense tables (e.g. stock list) */
  export let wide = false;

  const dispatch = createEventDispatcher();

  function closeModal() {
    dispatch("close");
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      closeModal();
    }
  }
</script>

{#if show}
  <div
    class="modal-backdrop"
    on:click={closeModal}
    on:keydown={handleKeydown}
    role="button"
    tabindex="0"
  >
    <div
      class="modal-content"
      class:modal-content--wide={wide}
      on:click|stopPropagation
      on:keydown|stopPropagation
      role="dialog"
      aria-modal="true"
      aria-labelledby={modalId}
      tabindex="0"
    >
      <div class="modal-header">
        <h2 id={modalId}>{title}</h2>
        <button class="close-btn" on:click={closeModal} aria-label="Fermer">
          ×
        </button>
      </div>

      <slot />
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(28, 44, 46, 0.55);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 40px 16px;
    overflow-y: auto;
    z-index: 2000;
  }

  .modal-content {
    background: var(--card);
    border-radius: var(--r-md);
    box-shadow: var(--shadow-pop);
    width: 100%;
    max-width: 640px;
    max-height: calc(100vh - 80px);
    overflow-y: auto;
    font-family: var(--font-sans);
    font-size: 14px;
    color: var(--ink);
  }

  .modal-content--wide {
    max-width: min(1200px, 96vw);
  }

  .modal-header {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: 16px 16px 16px 24px;
    border-bottom: 1px solid var(--border-soft);
    background: var(--card);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .modal-header h2 {
    margin: 0;
    font-family: var(--font-serif);
    font-weight: 600;
    font-size: 22px;
    line-height: 28px;
    color: var(--title);
  }

  .close-btn {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border: none;
    border-radius: var(--r-sm);
    background: none;
    color: var(--ink-2);
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
  }

  .close-btn:hover {
    background: var(--mist);
    color: var(--teal-700);
  }

  @media (max-width: 767px) {
    .modal-backdrop {
      padding: 0;
    }

    .modal-content {
      max-height: none;
      min-height: 100%;
      border-radius: 0;
    }
  }
</style>
