<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { Customer } from "$lib/types";
  import { customerDisplayLabel, sortCustomersByLabel } from "$lib/customerDisplay";
  import Combobox, { fold, type ComboOption } from "$lib/ui/Combobox.svelte";
  import { initials } from "$lib/format";

  export let value = "";
  export let customers: Customer[] = [];
  export let placeholder = "Rechercher un client…";
  export let isCustomerAlreadyAdded: (customerId: string) => boolean = () => false;
  export let id: string | undefined = undefined;
  export let invalid = false;
  export let describedby: string | undefined = undefined;

  const dispatch = createEventDispatcher<{ change: void }>();

  $: options = sortCustomersByLabel(customers).map<ComboOption>((c: any) => ({
    id: c.id,
    label: customerDisplayLabel(c),
    searchText: fold(`${c.first_name} ${c.last_name} ${c.company_name || ""} ${c.email || ""} ${c.city || ""}`),
    disabled: isCustomerAlreadyAdded(c.id),
    initials: initials(c.first_name, c.last_name),
    name: `${c.first_name} ${c.last_name}`.trim(),
    detail: [c.company_name, c.city].filter(Boolean).join(" · "),
  }));
</script>

<Combobox
  bind:value
  {options}
  {placeholder}
  {id}
  {invalid}
  {describedby}
  emptyText="Aucun client trouvé"
  on:change={() => dispatch("change")}
>
  <svelte:fragment slot="option" let:option>
    <span class="avatar" aria-hidden="true">{option.initials}</span>
    <span class="name">
      <strong>{option.name}</strong>
      {#if option.detail}<small>{option.detail}</small>{/if}
    </span>
  </svelte:fragment>
</Combobox>

<style>
  .avatar {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--mist);
    color: var(--teal-700);
    font-size: 11px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .name {
    display: flex;
    flex-direction: column;
    line-height: 18px;
    min-width: 0;
  }

  .name strong {
    font-weight: 600;
  }

  .name small {
    font-size: 12px;
    color: var(--ink-2);
  }
</style>
