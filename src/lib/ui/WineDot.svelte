<script lang="ts" context="module">
  export type Robe = "rouge" | "blanc" | "rose" | "autre";

  /** Robe à partir du type de vin en base (« red », « white », « rosé »…). */
  export function robeOf(type: { name?: string | null } | null | undefined): Robe {
    const n = (type?.name || "").toLowerCase();
    if (n.startsWith("red") || n.startsWith("rouge")) return "rouge";
    if (n.startsWith("white") || n.startsWith("blanc")) return "blanc";
    if (n.startsWith("ros")) return "rose";
    return "autre";
  }

  export const ROBE_LABEL: Record<Robe, string> = {
    rouge: "Rouge",
    blanc: "Blanc",
    rose: "Rosé",
    autre: "Autre",
  };
</script>

<script lang="ts">
  /**
   * Pastille de 10 px à la couleur de la robe.
   * Toujours accompagnée du nom du vin à côté : elle est décorative (aria-hidden).
   */
  export let robe: Robe = "autre";
  export let size = 10;
</script>

<span class="dot dot--{robe}" style="--size: {size}px" aria-hidden="true"></span>

<style>
  .dot {
    display: inline-block;
    flex-shrink: 0;
    width: var(--size);
    height: var(--size);
    border-radius: 50%;
    background: #9aa29e;
  }

  .dot--rouge {
    background: var(--rouge);
  }

  .dot--blanc {
    background: var(--blanc);
    box-shadow: inset 0 0 0 1px var(--blanc-ring);
  }

  .dot--rose {
    background: var(--rose);
    box-shadow: inset 0 0 0 1px var(--rose-ring);
  }
</style>
