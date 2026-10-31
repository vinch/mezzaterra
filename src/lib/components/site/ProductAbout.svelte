<script lang="ts" module>
  import { kindInfo } from "$lib/productKinds";
  import { vintageNotes, winePairings } from "$lib/wine";

  /** Description, notes et accords d'un lot chargé avec `VINTAGE_PUBLIC_SELECT`. */
  export function productAbout(v: any) {
    const kind = kindInfo(v?.wine);
    return {
      kind,
      description: (v?.wine?.description as string | null | undefined) || "",
      notes: vintageNotes(v?.note, kind.key),
      pairings: winePairings(v?.wine),
    };
  }

  /** Le lot a-t-il de quoi remplir ce bloc ? */
  export function hasProductAbout(v: any): boolean {
    const { description, notes, pairings } = productAbout(v);
    return Boolean(description || notes.length || pairings.length);
  }
</script>

<script lang="ts">
  /**
   * « Le vin / L'huile », notes de dégustation et accords d'un produit : fiche publique et fiche
   * rapide (`ProductModal`, `compact` : titres plus petits, notes sur fond).
   * La couleur du liseré des notes vient de `--robe`, posée par le parent.
   */
  interface Props {
    vintage: any;
    compact?: boolean;
  }

  let { vintage, compact = false }: Props = $props();

  let about = $derived(productAbout(vintage));
  let heading = $derived(compact ? "h3" : "h2");
</script>

<div class="about" class:compact>
  {#if about.description}
    <div class="block">
      <svelte:element this={heading} class="block-title">{about.kind.aboutTitle}</svelte:element>
      <p class="prose">{about.description}</p>
    </div>
  {/if}

  {#if about.notes.length}
    <div class="block">
      <svelte:element this={heading} class="block-title">Notes de dégustation</svelte:element>
      <div class="notes">
        {#each about.notes as note}
          <div class="note">
            <span class="note-label">{note.label}</span>
            <p>{note.content}</p>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if about.pairings.length}
    <div class="block">
      <svelte:element this={heading} class="block-title">À table avec</svelte:element>
      <div class="pairings">
        {#each about.pairings as p}
          <span class="mz-chip">{p}</span>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .about {
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
  }

  .block-title {
    margin: 0 0 0.75rem;
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--mz-teal-soft);
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
  }

  .compact .block-title {
    margin-bottom: 0.5rem;
    font-size: 0.75rem;
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
