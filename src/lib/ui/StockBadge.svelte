<script lang="ts">
  import { IconArchive, IconHourglass, IconSignal, IconTriangle } from "./icons";

  interface Props {
    /** « Rupture » (rouge), « Stock bas » (ambre), « Dormant · N j » (gris), « Plus disponible » (retiré). */
    kind: "out" | "low" | "dormant" | "gone";
    days?: number | null;
    /** Remplace le libellé par défaut (ex. « 2 bt. »). */
    label?: string | null;
  }

  let { kind, days = null, label = null }: Props = $props();

  let text = $derived(
    label ??
      (kind === "out"
        ? "Rupture"
        : kind === "low"
          ? "Stock bas"
          : kind === "gone"
            ? "Plus disponible"
            : `Dormant${days != null ? ` · ${days} j` : ""}`),
  );
  let Icon = $derived(kind === "out" ? IconTriangle : kind === "low" ? IconSignal : kind === "gone" ? IconArchive : IconHourglass);
</script>

<span class="stock stock--{kind}">
  <Icon size={13} strokeWidth={1.75} aria-hidden="true" />
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

  .stock--gone {
    background: transparent;
    border: 1px dashed var(--border);
    color: var(--ink-2);
  }
</style>
