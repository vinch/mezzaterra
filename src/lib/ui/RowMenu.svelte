<script lang="ts">
  import IconButton from "./IconButton.svelte";
  import Menu, { type MenuItem } from "./Menu.svelte";
  import { IconEllipsis } from "./icons";

  /**
   * Menu « … » d'une ligne. Ne passer que les actions permises par l'état ;
   * « Supprimer… » en dernier, avec `separator: true, danger: true` (il ouvre un ConfirmDialog).
   */
  export let items: MenuItem[] = [];
  export let label = "Actions";

  let open = false;
  let anchor: HTMLElement | null = null;
  const id = `rowmenu-${Math.random().toString(36).slice(2, 9)}`;
</script>

<IconButton
  bind:el={anchor}
  {label}
  haspopup="menu"
  expanded={open}
  controls={open ? id : undefined}
  on:click={(e) => {
    e.stopPropagation();
    open = !open;
  }}
>
  <IconEllipsis size={18} strokeWidth={1.75} />
</IconButton>
<Menu bind:open {anchor} {items} {id} {label} />
