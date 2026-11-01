<script lang="ts">
  import Menu from "./Menu.svelte";
  import StatusBadge from "./StatusBadge.svelte";
  import { canChangeStatus, statusMenuItems, type StatusKind } from "$lib/status";

  /**
   * Badge de statut qui ouvre le menu des transitions permises (statusMenuItems de status.ts) ;
   * badge simple si le statut ne peut plus changer. `onselect` reçoit le statut choisi : les
   * confirmations restent à la page.
   */
  interface Props {
    status: string | null | undefined;
    kind?: StatusKind;
    onselect: (next: string) => void;
  }

  let { status, kind = "sale", onselect }: Props = $props();

  let open = $state(false);
  let anchor = $state<HTMLElement | null>(null);
  let items = $derived(statusMenuItems(kind, status, onselect));

  function toggle(e: MouseEvent) {
    anchor = e.currentTarget as HTMLElement;
    open = !open;
  }
</script>

{#if canChangeStatus(kind, status)}
  <StatusBadge {kind} {status} interactive expanded={open} onclick={toggle} />
  <Menu bind:open {anchor} {items} label="Changer le statut" align="start" />
{:else}
  <StatusBadge {kind} {status} />
{/if}
