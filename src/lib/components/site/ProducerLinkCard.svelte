<script lang="ts">
  /** Carte « domaine → » vers la page publique d'un producteur (catalogue, autres producteurs). */
  interface Props {
    id: string;
    name: string;
    /** Ligne secondaire (ville, nombre de produits…). */
    detail?: string | null;
  }

  let { id, name, detail }: Props = $props();
</script>

<a class="mz-card card" href="/domaines/{id}">
  <span class="name">{name}</span>
  {#if detail}<span class="mz-muted detail">{detail}</span>{/if}
  <span class="arrow" aria-hidden="true">→</span>
</a>

<style>
  .card {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.15rem 1rem;
    align-items: center;
    padding: 1rem 1.25rem;
    text-decoration: none;
    color: inherit;
    transition:
      border-color 0.15s ease,
      transform 0.15s ease;
  }

  .card:hover {
    border-color: var(--mz-teal);
    transform: translateY(-2px);
  }

  .name {
    font-family: var(--mz-font-display);
    font-size: 1.3rem;
    color: var(--mz-teal);
  }

  .detail {
    grid-column: 1;
    font-size: 0.88rem;
  }

  .arrow {
    grid-column: 2;
    grid-row: 1 / span 2;
    color: var(--mz-teal);
    font-size: 1.2rem;
  }
</style>
