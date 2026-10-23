<script lang="ts">
  import { onMount } from "svelte";
  import {
    ABRUZZO_PATH,
    INSET,
    INSET_ABRUZZO_PATH,
    ITALY_PATHS,
    MAIN,
    NEIGHBOR_PATHS,
    project,
  } from "$lib/geo/abruzzo";

  /** Domaines à épingler (coordonnées GPS de la table winery). */
  export let wineries: { id: string; name: string; latitude: number | null; longitude: number | null }[] = [];
  /** Domaine mis en avant (page domaine) : les autres épingles passent au second plan. */
  export let current: string | null = null;

  const W = MAIN.width;
  const H = MAIN.height;
  const p = (lon: number, lat: number) => project(MAIN, lon, lat);

  const CITIES = [
    { name: "Pescara", lon: 14.2161, lat: 42.4618, anchor: "start", dx: 7, dy: -6 },
    { name: "Chieti", lon: 14.1675, lat: 42.351, anchor: "start", dx: 7, dy: 12 },
    { name: "L’Aquila", lon: 13.3995, lat: 42.3498, anchor: "end", dx: -7, dy: 4 },
    { name: "Teramo", lon: 13.7044, lat: 42.6589, anchor: "end", dx: -7, dy: 4 },
  ];

  const PEAKS = [
    { name: "Gran Sasso", lon: 13.5658, lat: 42.4689 },
    { name: "Majella", lon: 14.0858, lat: 42.0858 },
  ];

  const NEIGHBORS = [
    { name: "Marche", lon: 13.25, lat: 42.98 },
    { name: "Lazio", lon: 12.95, lat: 41.9 },
    { name: "Molise", lon: 14.3, lat: 41.62 },
  ];

  /* 20 km : 1° de latitude ≈ 111 km. */
  const SCALE_PX = (20 / 111) * MAIN.k;

  /* Bout du trait (dx, dy) et position du texte (tx, ty) par rapport au point. */
  const LABELS = {
    left: { dx: -24, dy: 18, tx: -28, ty: 24, anchor: "end" },
    right: { dx: 24, dy: -18, tx: 28, ty: -18, anchor: "start" },
    below: { dx: 18, dy: 26, tx: 20, ty: 40, anchor: "start" },
  } as const;
  /* Rayon du point (8 sur mobile) + liseré : le trait démarre juste au bord. */
  const LEADER_GAP = 10;

  $: pins = wineries
    .filter((w) => w.latitude != null && w.longitude != null)
    .sort((a, b) => (a.longitude ?? 0) - (b.longitude ?? 0))
    .map((w, i, all) => {
      const [x, y] = p(w.longitude!, w.latitude!);
      /* Étiquettes : la plus à l'ouest à gauche, la plus à l'est à droite, les autres en dessous. */
      const side = i === 0 ? "left" : i === all.length - 1 ? "right" : "below";
      const label = LABELS[side];
      /* Le trait part du bord du point, dans l'axe exact de l'étiquette. */
      const len = Math.hypot(label.dx, label.dy);
      const ux = label.dx / len;
      const uy = label.dy / len;
      return {
        ...w,
        x,
        y,
        leader: { x1: x + ux * LEADER_GAP, y1: y + uy * LEADER_GAP, x2: x + label.dx, y2: y + label.dy },
        text: { x: x + label.tx, y: y + label.ty, anchor: label.anchor },
        delay: 1400 + i * 180,
      };
    });

  let drawn = false;
  onMount(() => {
    requestAnimationFrame(() => (drawn = true));
  });

  /* Médaillon en bas à droite (sur le Molise), réduit. */
  const INSET_SCALE = 0.62;
  const insetW = (INSET.width + 16) * INSET_SCALE;
  const insetH = (INSET.height + 16) * INSET_SCALE;
  const [insetX, insetY] = [W - insetW - 14, H - insetH - 14];
</script>

<figure class="map" class:drawn>
  <svg viewBox="0 0 {W} {H}" role="img" aria-labelledby="map-title map-desc">
    <title id="map-title">Carte des Abruzzes</title>
    <desc id="map-desc">
      Les Abruzzes, entre la mer Adriatique et le massif du Gran Sasso, avec l’emplacement des domaines
      Mezzaterra : {pins.map((w) => w.name).join(", ")}.
    </desc>

    <defs>
      <pattern id="mz-waves" width="28" height="14" patternUnits="userSpaceOnUse">
        <path d="M0 7 q7 -5 14 0 t14 0" fill="none" stroke="currentColor" stroke-width="0.8" opacity="0.18" />
      </pattern>
      <pattern id="mz-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" stroke-width="0.7" opacity="0.13" />
      </pattern>
      <filter id="mz-soft" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#1d2a2c" flood-opacity="0.18" />
      </filter>
      <clipPath id="mz-frame"><rect width={W} height={H} rx="18" /></clipPath>
    </defs>

    <g clip-path="url(#mz-frame)">
      <!-- Mer : le fond ; les terres voisines la recouvrent. -->
      <rect class="sea" width={W} height={H} />
      <rect class="waves" width={W} height={H} fill="url(#mz-waves)" />

      {#each NEIGHBOR_PATHS as d}
        <path class="neighbor" {d} />
      {/each}
      {#each NEIGHBOR_PATHS as d}
        <path class="neighbor-hatch" {d} fill="url(#mz-hatch)" />
      {/each}

      {#each NEIGHBORS as n}
        {@const [x, y] = p(n.lon, n.lat)}
        <text class="neighbor-label" {x} {y} text-anchor="middle">{n.name}</text>
      {/each}

      <!-- Abruzzes -->
      <path class="region-shadow" d={ABRUZZO_PATH} filter="url(#mz-soft)" />
      <path class="region" d={ABRUZZO_PATH} />
      <path class="region-outline" d={ABRUZZO_PATH} pathLength="1" />

      <text class="sea-label" transform="translate({p(14.62, 42.72).join(',')}) rotate(-38)" text-anchor="middle">
        Mare Adriatico
      </text>

      <text class="region-label" x={p(13.62, 41.96)[0]} y={p(13.62, 41.96)[1]} text-anchor="middle">ABRUZZO</text>

      {#each PEAKS as m}
        {@const [x, y] = p(m.lon, m.lat)}
        <g class="peak" transform="translate({x},{y})">
          <path d="M-11 6 L-3 -7 L1 -1 L5 -9 L13 6 Z" />
          <path class="snow" d="M-5 -3.5 L-3 -7 L-1 -4 M3 -5.5 L5 -9 L7 -6" />
          <text y="20" text-anchor="middle">{m.name}</text>
        </g>
      {/each}

      {#each CITIES as c}
        {@const [x, y] = p(c.lon, c.lat)}
        <g class="city">
          <circle cx={x} cy={y} r="2.6" />
          <text x={x + c.dx} y={y + c.dy} text-anchor={c.anchor}>{c.name}</text>
        </g>
      {/each}

      {#each pins as w (w.id)}
        <a
          href="/domaines/{w.id}"
          class="pin"
          class:current={current === w.id}
          class:dim={current != null && current !== w.id}
          style="--delay: {w.delay}ms"
          aria-label="{w.name} — voir le domaine"
          aria-current={current === w.id ? "page" : undefined}
        >
          <circle class="pin-halo" cx={w.x} cy={w.y} r="9" />
          <circle class="pin-dot" cx={w.x} cy={w.y} r="5.5" />
          <line class="leader" x1={w.leader.x1} y1={w.leader.y1} x2={w.leader.x2} y2={w.leader.y2} />
          <text class="pin-label" x={w.text.x} y={w.text.y} text-anchor={w.text.anchor}>{w.name}</text>
        </a>
      {/each}

      <!-- Médaillon : l'Italie -->
      <g class="inset" transform="translate({insetX},{insetY}) scale({INSET_SCALE})">
        <rect width={INSET.width + 16} height={INSET.height + 16} rx="12" />
        <g transform="translate(8,8)">
          {#each ITALY_PATHS as d}
            <path class="inset-land" {d} />
          {/each}
          <path class="inset-region" d={INSET_ABRUZZO_PATH} />
        </g>
      </g>

      <!-- Échelle -->
      <g class="scale" transform="translate(26,{H - 24})">
        <line x1="0" y1="0" x2={SCALE_PX} y2="0" />
        <line x1="0" y1="-4" x2="0" y2="4" />
        <line x1={SCALE_PX} y1="-4" x2={SCALE_PX} y2="4" />
        <text x={SCALE_PX / 2} y="-8" text-anchor="middle">20 km</text>
      </g>
    </g>

    <rect class="frame" width={W} height={H} rx="18" />
  </svg>
  <figcaption>openpolis / ISTAT (CC BY 4.0)</figcaption>
</figure>

<style>
  .map {
    margin: 0;
    color: var(--mz-teal);
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
  }

  .sea {
    fill: #dfe7e4;
  }

  .waves {
    color: var(--mz-teal);
  }

  .neighbor {
    fill: #ebe8e1;
    stroke: #cfcabf;
    stroke-width: 1;
  }

  .neighbor-hatch {
    color: var(--mz-ink-soft);
    stroke: none;
  }

  .neighbor-label {
    font-family: var(--mz-font-body);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    fill: #a9a497;
  }

  .region-shadow {
    fill: #f6f4ef;
  }

  .region {
    fill: #f6f4ef;
  }

  .region-outline {
    fill: none;
    stroke: var(--mz-teal);
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
  }

  .drawn .region-outline {
    stroke-dashoffset: 0;
    transition: stroke-dashoffset 2.2s cubic-bezier(0.6, 0, 0.2, 1);
  }

  .region-label {
    font-family: var(--mz-font-display);
    font-size: 15px;
    letter-spacing: 0.5em;
    fill: var(--mz-teal-soft);
    opacity: 0.55;
  }

  .sea-label {
    font-family: var(--mz-font-display);
    font-style: italic;
    font-size: 20px;
    fill: var(--mz-teal-soft);
    opacity: 0.8;
  }

  .peak path {
    fill: var(--mz-teal-soft);
    opacity: 0.55;
  }

  .peak .snow {
    fill: none;
    stroke: #fff;
    stroke-width: 1.2;
    opacity: 0.9;
  }

  .peak text {
    font-family: var(--mz-font-display);
    font-style: italic;
    font-size: 11.5px;
    fill: var(--mz-ink-soft);
  }

  .city circle {
    fill: var(--mz-ink-soft);
  }

  .city text {
    font-family: var(--mz-font-body);
    font-size: 11px;
    fill: var(--mz-ink-soft);
  }

  .pin {
    opacity: 0;
  }

  .drawn .pin {
    animation: pin-in 0.5s var(--mz-ease) var(--delay) both;
  }

  .pin-halo {
    fill: var(--mz-wine-red);
    opacity: 0.18;
    transform-box: fill-box;
    transform-origin: center;
    animation: halo 2.4s ease-out infinite;
  }

  .pin-dot {
    fill: var(--mz-wine-red);
    stroke: #f6f4ef;
    stroke-width: 2.5;
  }

  .leader {
    stroke: var(--mz-ink-soft);
    stroke-width: 0.8;
    opacity: 0.6;
  }

  .pin-label {
    font-family: var(--mz-font-display);
    font-size: 15px;
    font-weight: 500;
    fill: var(--mz-teal);
    paint-order: stroke;
    stroke: #f6f4ef;
    stroke-width: 4px;
    stroke-linejoin: round;
  }

  a.pin {
    cursor: pointer;
  }

  a.pin:hover .pin-label,
  a.pin:focus-visible .pin-label {
    fill: var(--mz-wine-red);
  }

  .pin.dim .pin-halo {
    display: none;
  }

  .pin.dim .pin-dot {
    fill: var(--mz-teal-soft);
  }

  .pin.dim .pin-label {
    font-size: 13px;
    fill: var(--mz-ink-soft);
  }

  .pin.dim:hover .pin-dot,
  .pin.dim:focus-visible .pin-dot {
    fill: var(--mz-wine-red);
  }

  .pin.current .pin-label {
    font-weight: 600;
  }

  .inset rect {
    fill: rgba(246, 244, 239, 0.85);
    stroke: #cfcabf;
  }

  .inset-land {
    fill: #dcd7cc;
  }

  .inset-region {
    fill: var(--mz-teal);
  }

  .scale line {
    stroke: var(--mz-ink-soft);
    stroke-width: 1.2;
  }

  .scale text {
    font-family: var(--mz-font-body);
    font-size: 10px;
    fill: var(--mz-ink-soft);
  }

  .frame {
    fill: none;
    stroke: var(--mz-line);
  }

  figcaption {
    margin-top: 0.4rem;
    font-size: 0.7rem;
    color: var(--mz-muted);
    text-align: right;
  }

  @keyframes pin-in {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @keyframes halo {
    0% {
      transform: scale(0.6);
      opacity: 0.35;
    }
    100% {
      transform: scale(2.2);
      opacity: 0;
    }
  }

  /* Sur mobile la carte est réduite ~50 % : on grossit les textes (unités SVG). */
  @media (max-width: 640px) {
    .pin-label {
      font-size: 24px;
      stroke-width: 6px;
    }

    .pin.dim .pin-label {
      font-size: 20px;
    }

    .city text,
    .peak text {
      font-size: 17px;
    }

    .neighbor-label {
      font-size: 14px;
    }

    .sea-label {
      font-size: 28px;
    }

    .region-label {
      font-size: 20px;
    }

    .scale text {
      font-size: 15px;
    }

    .pin-dot {
      r: 8;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .region-outline {
      stroke-dashoffset: 0;
    }

    .drawn .region-outline {
      transition: none;
    }

    .pin {
      opacity: 1;
    }

    .drawn .pin,
    .pin-halo {
      animation: none;
    }
  }
</style>
