<script lang="ts">
  interface Props {
    oninput?: (e: Event) => void;
    onchange?: (e: Event) => void;
    /** Un montant et un sélecteur €/% collés dans un seul contrôle. */
    amount?: string | number;
    type?: "amount" | "percent";
    id?: string | undefined;
    placeholder?: string;
    describedby?: string | undefined;
    amountLabel?: string;
    percentLabel?: string;
    ariaLabel?: string;
  }

  let {
    amount = $bindable(""),
    type = $bindable("amount"),
    id = undefined,
    placeholder = "0",
    describedby = undefined,
    amountLabel = "€",
    percentLabel = "%",
    ariaLabel = "Montant",
    oninput,
    onchange
  }: Props = $props();
</script>

<div class="amount-type">
  <input
    {id}
    class="ui-control"
    type="text"
    inputmode="decimal"
    {placeholder}
    aria-label={id ? undefined : ariaLabel}
    aria-describedby={describedby}
    bind:value={amount}
    {oninput}
  />
  <select class="ui-control" bind:value={type} aria-label="Type de remise" {onchange}>
    <option value="amount">{amountLabel}</option>
    <option value="percent">{percentLabel}</option>
  </select>
</div>

<style>
  .amount-type {
    display: flex;
    min-width: 0;
  }

  .amount-type input {
    flex: 1 1 auto;
    min-width: 0;
    text-align: right;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  .amount-type select {
    flex: 0 0 auto;
    width: auto;
    margin-left: -1px;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    background-color: var(--table-head);
  }
</style>
