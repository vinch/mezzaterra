<script lang="ts">
  interface Props {
    /** Indicateur de chargement : roue centrée, « Chargement… » lu par les lecteurs d’écran. */
    size?: number;
    /** Dans une ligne (tableau, bouton) : sans marge, à côté du texte, au lieu de centré dans un bloc. */
    inline?: boolean;
  }

  let { size = 28, inline = false }: Props = $props();
</script>

<div class="spinner" class:inline role="status">
  <span class="wheel" style:width="{size}px" style:height="{size}px" aria-hidden="true"></span>
  <span class="sr-only">Chargement…</span>
</div>

<style>
  .spinner {
    display: flex;
    justify-content: center;
    padding: 32px;
  }

  .spinner.inline {
    display: inline-flex;
    padding: 0;
    vertical-align: middle;
  }

  .wheel {
    box-sizing: border-box;
    border: 3px solid var(--border);
    border-top-color: var(--teal-600);
    border-radius: var(--r-pill);
    animation: spin 0.9s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .wheel {
      animation-duration: 2.4s;
    }
  }
</style>
