<script lang="ts">
  import type { Snippet } from "svelte";
  interface Props {
    /** État vide : icône ronde --mist, phrase en gras, explication, action secondaire optionnelle. */
    icon?: any;
    title: string;
    text?: string;
    compact?: boolean;
    children?: Snippet;
  }

  let {
    icon: Icon = null,
    title,
    text = "",
    compact = false,
    children
  }: Props = $props();
</script>

<div class="empty" class:compact>
  {#if Icon}
    <span class="empty-icon" aria-hidden="true"><Icon size={20} strokeWidth={1.75} /></span>
  {/if}
  <p class="empty-title">{title}</p>
  {#if text}<p class="empty-text">{text}</p>{/if}
  {#if children}<div class="empty-action">{@render children?.()}</div>{/if}
</div>

<style>
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 6px;
    padding: 32px 16px;
  }

  .empty.compact {
    padding: 20px 12px;
  }

  .empty-icon {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    margin-bottom: 6px;
    border-radius: 50%;
    background: var(--mist);
    color: var(--teal-600);
  }

  .empty-title {
    margin: 0;
    font-weight: 600;
    color: var(--ink);
  }

  .empty-text {
    margin: 0;
    max-width: 30rem;
    font-size: 13px;
    color: var(--ink-2);
  }

  .empty-action {
    margin-top: 10px;
  }
</style>
