<script lang="ts">
  import { IconHourglass, IconSignal, IconTriangle } from "./icons";

  /** « Rupture » (rouge), « Stock bas » (ambre), « Dormant · N j » (gris). */
  export let kind: "out" | "low" | "dormant";
  export let days: number | null = null;
  /** Remplace le libellé par défaut (ex. « 2 bt. »). */
  export let label: string | null = null;

  $: text =
    label ??
    (kind === "out" ? "Rupture" : kind === "low" ? "Stock bas" : `Dormant${days != null ? ` · ${days} j` : ""}`);
  $: icon = kind === "out" ? IconTriangle : kind === "low" ? IconSignal : IconHourglass;
</script>

<span class="stock stock--{kind}">
  <svelte:component this={icon} size={13} strokeWidth={1.75} aria-hidden="true" />
  {text}
</span>

<style>
  .stock {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 22px;
    padding: 0 9px;
    border-radius: var(--r-pill);
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
  }

  .stock--out {
    background: var(--st-cancelled-bg);
    color: var(--danger);
  }

  .stock--low {
    background: var(--st-pending-bg);
    color: var(--warn);
  }

  .stock--dormant {
    background: var(--st-closed-bg);
    color: var(--st-closed-fg);
  }
</style>
