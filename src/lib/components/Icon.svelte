<script lang="ts" context="module">
  /** Icônes au trait (24×24, stroke currentColor), dessinées pour l'admin. */
  export const ICONS = {
    home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
    wine: "M8 3h8c0 5-1 9-4 9s-4-4-4-9zM12 12v8M8 21h8",
    bottle: "M10 2h4v4c0 1 3 2.5 3 6v9a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-9c0-3.5 3-5 3-6zM7 13h10",
    box: "M3 7.5 12 3l9 4.5v9L12 21l-9-4.5zM3 7.5l9 4.5 9-4.5M12 12v9",
    glasses: "M5 3h5c0 4-.5 7-2.5 7S5 7 5 3zM7.5 10v8M5 21h5M14 3h5c0 4-.5 7-2.5 7S14 7 14 3zM16.5 10v8M14 21h5",
    live: "M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14",
    file: "M6 2h8l5 5v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM14 2v5h5M8 13h8M8 17h6",
    image: "M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM3 16l5-5 4 4 3-3 6 6M15.5 8.5m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0",
    users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6",
    cash: "M3 6h18v12H3zM12 12m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M6 9v.01M18 15v.01",
    inbox: "M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z",
    chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
    mail: "M3 5h18v14H3zM3 6l9 7 9-7",
    clipboard: "M9 3h6v3H9zM7 4.5H5.5A1.5 1.5 0 0 0 4 6v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6a1.5 1.5 0 0 0-1.5-1.5H17M8 12h8M8 16h5",
    factory: "M3 21V10l6 3V10l6 3V6l6-3v18zM7 17h2M12 17h2M17 17h2",
    truck: "M2 6h12v10H2zM14 9h4l4 4v3h-8M6.5 18.5m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M17.5 18.5m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0",
    route: "M6 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M18 5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M8 19h8a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h8",
    pin: "M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zM12 9m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0",
    grape: "M12 2v4M9 7a2 2 0 1 0 0 .01M15 7a2 2 0 1 0 0 .01M12 11a2 2 0 1 0 0 .01M8 11a2 2 0 1 0 0 .01M16 11a2 2 0 1 0 0 .01M10 15a2 2 0 1 0 0 .01M14 15a2 2 0 1 0 0 .01M12 19a2 2 0 1 0 0 .01",
    tag: "M3 3h8l10 10-8 8L3 11zM7.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0",
    plate: "M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0M12 12m-9.5 0a9.5 9.5 0 1 0 19 0a9.5 9.5 0 1 0-19 0",
    castle: "M4 21V8h3V5h2v3h2V5h2v3h2V5h2v3h3v13h-6v-4a2 2 0 0 0-4 0v4z",
    globe: "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18",
    map: "M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15",
    logout: "M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11",
    search: "M10.5 10.5m-6.5 0a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0-13 0M15.5 15.5 21 21",
    alert: "M12 3 2 20h20zM12 10v4M12 17v.01",
    sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z",
    external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
    cart: "M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2M9 20m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0M17 20m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0",
  } as const;

  export type IconName = keyof typeof ICONS;
</script>

<script lang="ts">
  export let name: IconName;
  export let size = "1.15rem";
  export let strokeWidth = 1.7;
</script>

<svg
  class="icon"
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d={ICONS[name]} />
</svg>

<style>
  .icon {
    flex-shrink: 0;
    display: block;
  }
</style>
