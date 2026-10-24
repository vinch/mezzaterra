<script lang="ts">
  import type { Snippet } from "svelte";
  /** Liste déroulante du design system. Options passées en contenu (<option>). */
  interface Props {
    onchange?: (e: Event) => void;
    value?: string | null;
    id?: string | undefined;
    required?: boolean;
    disabled?: boolean;
    invalid?: boolean;
    describedby?: string | undefined;
    ariaLabel?: string | undefined;
    children?: Snippet;
  }

  let {
    value = $bindable(""),
    id = undefined,
    required = false,
    disabled = false,
    invalid = false,
    describedby = undefined,
    ariaLabel = undefined,
    children,
    onchange
  }: Props = $props();
</script>

<select
  {id}
  {required}
  {disabled}
  class="ui-control"
  bind:value
  aria-invalid={invalid ? "true" : undefined}
  aria-describedby={describedby}
  aria-label={ariaLabel}
  {onchange}
>
  {@render children?.()}
</select>
