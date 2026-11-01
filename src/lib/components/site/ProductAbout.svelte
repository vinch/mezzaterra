<script lang="ts">
  import { kindInfo } from "$lib/productKinds";
  import { vintageNotes, winePairings } from "$lib/wine";

  /**
   * « Le vin / L'huile », notes de dégustation et accords d'un lot chargé avec `VINTAGE_PUBLIC_SELECT` :
   * fiche publique et fiche rapide (`ProductModal`, `compact` : notes sur fond). Rien s'il n'y a rien à dire.
   * La couleur du liseré des notes vient de `--robe`, posée par le parent.
   */
  interface Props {
    vintage: any;
    compact?: boolean;
    class?: string;
  }

  let { vintage, compact = false, class: className = "" }: Props = $props();

  let kind = $derived(kindInfo(vintage?.wine));
  let description = $derived((vintage?.wine?.description as string | null | undefined) || "");
  let notes = $derived(vintageNotes(vintage?.note, kind.key));
  let pairings = $derived(winePairings(vintage?.wine));
  let heading = $derived(compact ? "h3" : "h2");
</script>

{#if description || notes.length || pairings.length}
  <section class="about {className}" class:compact>
    {#if description}
      <div class="block">
        <svelte:element this={heading} class="mz-kicker">{kind.aboutTitle}</svelte:element>
        <p class="prose">{description}</p>
      </div>
    {/if}

    {#if notes.length}
      <div class="block">
        <svelte:element this={heading} class="mz-kicker">Notes de dégustation</svelte:element>
        <div class="notes">
          {#each notes as note}
            <div class="note">
              <span class="note-label">{note.label}</span>
              <p>{note.content}</p>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if pairings.length}
      <div class="block">
        <svelte:element this={heading} class="mz-kicker">À table avec</svelte:element>
        <div class="pairings">
          {#each pairings as p}
            <span class="mz-chip">{p}</span>
          {/each}
        </div>
      </div>
    {/if}
  </section>
{/if}

<style>
  .about {
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
    padding-top: 3rem;
    padding-bottom: 1rem;
  }

  .mz-kicker {
    margin-bottom: 0.75rem;
  }

  .block p {
    margin: 0;
    line-height: 1.65;
  }

  .prose {
    max-width: 44rem;
    white-space: pre-line;
    font-size: 1.05rem;
  }

  .notes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr));
    gap: 1.25rem 2rem;
  }

  .note {
    padding-left: 1rem;
    border-left: 3px solid var(--robe);
  }

  .note-label {
    font-family: var(--mz-font-display);
    font-size: 1.25rem;
    color: var(--mz-teal);
  }

  .pairings {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  /* Fiche rapide : plus serrée, notes sur fond. */
  .compact {
    gap: 1.5rem;
    padding: 0;
  }

  .compact .mz-kicker {
    margin-bottom: 0.5rem;
  }

  .compact .block p {
    line-height: 1.6;
  }

  .compact .prose {
    max-width: none;
    font-size: inherit;
  }

  .compact .notes {
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: 0.75rem;
  }

  .compact .note {
    padding: 0.9rem 1rem;
    border-radius: var(--mz-radius-sm);
    background: var(--mz-paper);
  }

  .compact .note-label {
    display: block;
    font-size: 1.05rem;
    margin-bottom: 0.2rem;
  }

  .compact .note p {
    font-size: 0.95rem;
    color: var(--mz-ink-soft);
  }
</style>
