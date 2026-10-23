<script lang="ts">
  /** Hauteur du logo (le visuel est au format 3:2). */
  export let height = "1.25rem";
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
