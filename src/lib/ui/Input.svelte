<script lang="ts">
  /** Champ texte du design system (à placer dans un Field). */
  export let value: string | number | null = "";
  export let id: string | undefined = undefined;
  export let type: "text" | "email" | "tel" | "date" | "number" | "search" | "time" = "text";
  export let placeholder: string | undefined = undefined;
  export let required = false;
  export let disabled = false;
  export let invalid = false;
  export let describedby: string | undefined = undefined;
  export let align: "left" | "right" = "left";
  export let inputmode: "text" | "decimal" | "numeric" | "email" | "tel" | "search" | undefined = undefined;
  export let el: HTMLInputElement | null = null;

  function onInput(e: Event) {
    value = (e.currentTarget as HTMLInputElement).value;
  }
</script>

<input
  bind:this={el}
  {id}
  {type}
  {placeholder}
  {required}
  {disabled}
  {inputmode}
  class="ui-control"
  style:text-align={align}
  value={value ?? ""}
  aria-invalid={invalid ? "true" : undefined}
  aria-describedby={describedby}
  on:input={onInput}
  on:input
  on:change
  on:keydown
  on:blur
  {...$$restProps}
/>
