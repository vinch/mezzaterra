<script lang="ts">
  /**
   * Histogramme mono-série (ex. CA mensuel).
   * Colonnes ≤ 24px, bout arrondi 4px côté donnée, carré à la base ; grille hairline ;
   * infobulle au survol sur toute la bande ; vue tableau pour l'accessibilité.
   */
  export let data: { key: string; label: string; value: number }[] = [];
  export let format: (n: number) => string = (n) => String(Math.round(n));
  export let title = "";
  export let color = "var(--mz-teal, #256169)";
  /** Clé mise en valeur (ex. mois courant). */
  export let highlightKey: string | null = null;

  const H = 180;
  const PAD_TOP = 18;
  const PAD_BOTTOM = 24;
  const PAD_LEFT = 44;
  const BAR_MAX = 24;

  let width = 600;
  let hover: number | null = null;

  function niceMax(v: number): number {
    if (v <= 0) return 1;
    const exp = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * exp >= v) return m * exp;
    return 10 * exp;
  }

  function compact(n: number): string {
    if (n >= 1000) return `${(n / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}k`;
    return String(Math.round(n));
  }

  $: max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  $: ticks = [0, max / 2, max];
  $: plotW = Math.max(0, width - PAD_LEFT - 8);
  $: band = data.length ? plotW / data.length : 0;
  $: barW = Math.min(BAR_MAX, band * 0.6);
  $: y = (v: number) => PAD_TOP + (H - PAD_TOP - PAD_BOTTOM) * (1 - v / max);
  $: base = H - PAD_BOTTOM;
  $: peak = data.reduce((m, d, i) => (d.value > (data[m]?.value ?? -1) ? i : m), 0);

  function columnPath(x: number, top: number, w: number): string {
    const h = base - top;
    if (h <= 0) return "";
    const r = Math.min(4, w / 2, h);
    return `M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${base}Z`;
  }
</script>

<figure class="chart" bind:clientWidth={width}>
  {#if title}<figcaption>{title}</figcaption>{/if}
  <svg viewBox="0 0 {width} {H}" width="100%" height={H} role="img" aria-label={title}>
    {#each ticks as t}
      <line x1={PAD_LEFT} x2={width - 8} y1={y(t)} y2={y(t)} class="grid" />
      <text x={PAD_LEFT - 8} y={y(t) + 4} class="tick" text-anchor="end">{compact(t)}</text>
    {/each}

    {#each data as d, i (d.key)}
      {@const cx = PAD_LEFT + band * i + band / 2}
      {@const top = y(d.value)}
      <g
        class="col"
        class:dim={hover != null && hover !== i}
        on:mouseenter={() => (hover = i)}
        on:mouseleave={() => (hover = null)}
        role="presentation"
      >
        <rect x={PAD_LEFT + band * i} y={PAD_TOP} width={band} height={base - PAD_TOP} fill="transparent" />
        <path
          d={columnPath(cx - barW / 2, top, barW)}
          fill={color}
          opacity={highlightKey && d.key !== highlightKey ? 0.55 : 1}
        />
        <text x={cx} y={H - 6} class="tick" text-anchor="middle">{d.label}</text>
        {#if i === peak && d.value > 0 && hover == null}
          <text x={cx} y={top - 6} class="value" text-anchor="middle">{compact(d.value)}</text>
        {/if}
      </g>
    {/each}
  </svg>

  {#if hover != null && data[hover]}
    {@const d = data[hover]}
    <div
      class="tooltip"
      style="left: {Math.min(Math.max(PAD_LEFT + band * hover + band / 2, 60), width - 60)}px; top: {Math.max(0, y(d.value) - 44)}px"
    >
      <span class="tt-label">{d.label}</span>
      <strong>{format(d.value)}</strong>
    </div>
  {/if}

  <details class="table-view">
    <summary>Voir les données</summary>
    <table>
      <thead><tr><th>Période</th><th class="num">Valeur</th></tr></thead>
      <tbody>
        {#each data as d}
          <tr><td>{d.label}</td><td class="num">{format(d.value)}</td></tr>
        {/each}
      </tbody>
    </table>
  </details>
</figure>

<style>
  .chart {
    position: relative;
    margin: 0;
  }

  figcaption {
    font-size: 0.95rem;
    font-weight: 600;
    color: #2c3e50;
    margin-bottom: 0.5rem;
  }

  svg {
    display: block;
    overflow: visible;
  }

  .grid {
    stroke: #ebe8e1;
    stroke-width: 1;
  }

  .tick {
    font-size: 11px;
    fill: #868e96;
  }

  .value {
    font-size: 11px;
    font-weight: 600;
    fill: #3d4f51;
  }

  .col path {
    transition: opacity 0.15s ease;
  }

  .col.dim path {
    opacity: 0.35 !important;
  }

  .tooltip {
    position: absolute;
    transform: translateX(-50%);
    pointer-events: none;
    padding: 0.35rem 0.6rem;
    border-radius: 6px;
    background: #1d2a2c;
    color: white;
    font-size: 0.8rem;
    white-space: nowrap;
    display: flex;
    gap: 0.5rem;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }

  .tt-label {
    opacity: 0.7;
    text-transform: capitalize;
  }

  .table-view {
    margin-top: 0.4rem;
    font-size: 0.8rem;
    color: #868e96;
  }

  .table-view summary {
    cursor: pointer;
  }

  .table-view table {
    margin-top: 0.4rem;
    font-size: 0.85rem;
  }

  .table-view th,
  .table-view td {
    padding: 0.3rem 0.6rem;
  }

  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
