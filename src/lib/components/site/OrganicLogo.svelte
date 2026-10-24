<script lang="ts">
  interface Props {
    /** Hauteur du logo (le visuel est au format 3:2). */
    height?: string;
  }

  let { height = "1.25rem" }: Props = $props();
</script>

<img
  src="/organic.png"
  alt="Bio"
  title="Agriculture biologique"
  class="organic-logo"
  style="height: {height};"
/>

<style>
  .organic-logo {
    width: auto;
    aspect-ratio: 3 / 2;
    border-radius: 2px;
    flex-shrink: 0;
  }
</style>
