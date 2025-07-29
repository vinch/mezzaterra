<div class="logo">
  <table class="letter-grid">
    <tbody>
      <tr>
        <td class="letter red">M</td>
        <td class="letter alt">Z</td>
      </tr>
      <tr>
        <td class="letter alt">T</td>
        <td class="letter red">R</td>
      </tr>
    </tbody>
  </table>
</div>

<style>
  .logo {
    font-family: "Zilla Slab", serif;
    font-weight: 600;
    font-size: 5rem;
    color: #2d1810;
    line-height: 0.9;
    max-width: 100vw;
    max-height: 100vh;
    padding: 1rem;
    box-sizing: border-box;
  }

  .letter-grid {
    border-collapse: collapse;
    width: 100%;
    max-width: 100%;
  }

  .letter {
    width: 5.5rem;
    height: 5.5rem;
    text-align: center;
    vertical-align: middle;
    border: 8px solid #2d1810;
    background-color: #f5f1e8;
  }

  .letter.alt {
    background-color: #e8dcc0;
  }

  .letter.red {
    background-color: #e8b4b4;
  }

  /* Mobile responsive styles */
  @media (max-width: 768px) {
    .logo {
      font-size: 3rem;
      padding: 0.5rem;
    }

    .letter {
      width: 3.5rem;
      height: 3.5rem;
      border-width: 4px;
    }
  }

  @media (max-width: 480px) {
    .logo {
      font-size: 2rem;
      padding: 0.25rem;
    }

    .letter {
      width: 2.5rem;
      height: 2.5rem;
      border-width: 3px;
    }
  }

  @media (max-width: 320px) {
    .logo {
      font-size: 1.5rem;
      padding: 0.125rem;
    }

    .letter {
      width: 2rem;
      height: 2rem;
      border-width: 2px;
    }
  }
</style>
