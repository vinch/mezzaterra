<script lang="ts">
  interface Props {
    /** Indicateur de chargement : roue centrée, « Chargement… » lu par les lecteurs d’écran. */
    size?: number;
  }

  let { size = 28 }: Props = $props();
</script>

<div class="spinner" role="status">
  <span class="wheel" style:width="{size}px" style:height="{size}px" aria-hidden="true"></span>
  <span class="sr-only">Chargement…</span>
</div>

<style>
  .spinner {
    display: flex;
    justify-content: center;
    padding: 32px;
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
