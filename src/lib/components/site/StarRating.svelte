<script lang="ts">
  interface Props {
    onchange?: (value: number) => void;
    value?: number | null;
    readonly?: boolean;
    size?: string;
    label?: string;
  }

  let {
    value = null,
    readonly = false,
    size = "1.6rem",
    label = "Note",
    onchange
  }: Props = $props();

  let hover = $state<number | null>(null);

  function pick(n: number) {
    if (readonly) return;
    onchange?.(n);
  }

  let shown = $derived(hover ?? value ?? 0);
</script>

<div
  class="stars"
  class:readonly
  style="--size: {size}"
  role={readonly ? "img" : "radiogroup"}
  aria-label={readonly ? `${label} : ${value ?? 0} sur 5` : label}
  onmouseleave={() => (hover = null)}
>
  {#each [1, 2, 3, 4, 5] as n}
    {#if readonly}
      <span class="star" class:on={n <= shown} aria-hidden="true">★</span>
    {:else}
      <button
        type="button"
        class="star"
        class:on={n <= shown}
        role="radio"
        aria-checked={value === n}
        aria-label="{n} étoile{n > 1 ? 's' : ''}"
        onmouseenter={() => (hover = n)}
        onfocus={() => (hover = n)}
        onblur={() => (hover = null)}
        onclick={() => pick(n)}>★</button
      >
    {/if}
  {/each}
</div>

<style>
  .stars {
    display: inline-flex;
    gap: 0.15em;
    font-size: var(--size);
    line-height: 1;
  }

  .star {
    background: none;
    border: none;
    padding: 0;
    color: currentColor;
    opacity: 0.25;
    font-size: inherit;
    line-height: 1;
    transition:
      opacity 0.15s ease,
      transform 0.2s var(--mz-ease);
  }

  button.star {
    cursor: pointer;
  }

  button.star:hover,
  button.star:focus-visible {
    transform: scale(1.15);
    outline: none;
  }

  .star.on {
    opacity: 1;
    color: #e0b04a;
  }
</style>
