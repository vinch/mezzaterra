<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let show = false;
  export let title = "";
  export let modalId = "modal-title";

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
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: white;
    border-radius: 8px;
    width: 90%;
    max-width: 600px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-header {
    padding: 1.5rem;
    border-bottom: 1px solid #e9ecef;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .modal-header h2 {
    margin: 0;
    color: #333;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 2rem;
    color: #666;
    cursor: pointer;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    color: #333;
  }
</style>
