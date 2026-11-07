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
    /** Classe ajoutée à ui-control, pour la mise en page locale (largeur, flex). */
    class?: string;
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
    class: className = "",
    children,
    onchange
  }: Props = $props();
</script>

<select
  {id}
  {required}
  {disabled}
  class={["ui-control", className]}
  bind:value
  aria-invalid={invalid ? "true" : undefined}
  aria-describedby={describedby}
  aria-label={ariaLabel}
  {onchange}
>
  <button><selectedcontent></selectedcontent></button>
  {@render children?.()}
</select>
