<script>
  import Logo from "$lib/components/Logo.svelte";
</script>

<div class="layout">
  <header class="site-header">
    <div class="header-content">
      <a href="/" class="logo-link">
        <Logo size={2} />
      </a>
      <nav class="site-nav">
        <a href="/tastings" class="nav-link">Dégustations</a>
      </nav>
    </div>
  </header>

  <main class="main-content">
    <slot />
  </main>
</div>

<style>
  .layout {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .site-header {
    width: 100%;
    height: 8rem;
    background: white;
    border-bottom: 1px solid #e0e0e0;
    padding: 1rem 0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header-content {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .site-nav {
    display: flex;
    gap: 2rem;
  }

  .nav-link {
    text-decoration: none;
    color: #333;
    font-weight: 500;
    transition: color 0.2s ease;
  }

  .nav-link:hover {
    color: #666;
  }

  .logo-link {
    text-decoration: none;
    display: flex;
    align-items: center;
  }

  .main-content {
    flex: 1;
  }
</style>
