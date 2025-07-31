<script>
  import Logo from "$lib/components/Logo.svelte";
</script>

<div class="container">
  <Logo size={5} />
</div>

<style>
  .container {
    min-height: calc(100vh - 8rem);
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
