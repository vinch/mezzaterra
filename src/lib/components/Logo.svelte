<script lang="ts">
  export let size: number = 5; // Size in rem units
  $: letterSize = size * 1.225;
  $: borderWidth = size * 1.6;
</script>

<div class="logo" style="font-size: {size}rem;">
  <table class="letter-grid">
    <tbody>
      <tr>
        <td
          class="letter red"
          style="width: {letterSize}rem; height: {letterSize}rem; border-width: {borderWidth}px;"
          >M</td
        >
        <td
          class="letter alt"
          style="width: {letterSize}rem; height: {letterSize}rem; border-width: {borderWidth}px;"
          >Z</td
        >
      </tr>
      <tr>
        <td
          class="letter alt"
          style="width: {letterSize}rem; height: {letterSize}rem; border-width: {borderWidth}px;"
          >T</td
        >
        <td
          class="letter red"
          style="width: {letterSize}rem; height: {letterSize}rem; border-width: {borderWidth}px;"
          >R</td
        >
      </tr>
    </tbody>
  </table>
</div>

<style>
  .logo {
    font-family: "Zilla Slab", serif;
    font-weight: 600;
    color: #2d1810;
    line-height: 0.9;
    max-width: 100vw;
    max-height: 100vh;
    box-sizing: border-box;
    overflow: hidden;
  }

  .letter-grid {
    border-collapse: collapse;
    width: 100%;
    max-width: 100%;
  }

  .letter {
    text-align: center;
    vertical-align: middle;
    border: solid #2d1810;
    background-color: #f5f1e8;
  }

  .letter.alt {
    background-color: #e8dcc0;
  }

  .letter.red {
    background-color: #e8b4b4;
  }
</style>
