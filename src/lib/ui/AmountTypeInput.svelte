<script lang="ts">
  /** Un montant et un sélecteur €/% collés dans un seul contrôle. */
  export let amount: string | number = "";
  export let type: "amount" | "percent" = "amount";
  export let id: string | undefined = undefined;
  export let placeholder = "0";
  export let describedby: string | undefined = undefined;
  export let amountLabel = "€";
  export let percentLabel = "%";
  export let ariaLabel = "Montant";
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
    on:input
  />
  <select class="ui-control" bind:value={type} aria-label="Type de remise" on:change>
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
