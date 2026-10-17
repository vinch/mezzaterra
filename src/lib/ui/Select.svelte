<script lang="ts">
  /** Liste déroulante du design system. Options passées en slot (<option>). */
  export let value: string | null = "";
  export let id: string | undefined = undefined;
  export let required = false;
  export let disabled = false;
  export let invalid = false;
  export let describedby: string | undefined = undefined;
  export let ariaLabel: string | undefined = undefined;
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
  on:change
>
  <slot />
</select>
