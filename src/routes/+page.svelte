<script>
  import SiteFooter from "$lib/components/SiteFooter.svelte";
</script>

<div class="page">
  <main class="container">
    <img src="/logo.png" alt="Mezzaterra" class="logo-home" />
  </main>

  <SiteFooter />
</div>

<style>
  .page {
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .container {
    flex: 1;
    min-height: 0;
    padding: 1.5rem 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .logo-home {
    width: min(90vw, 55rem);
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    display: block;
  }
</style>
