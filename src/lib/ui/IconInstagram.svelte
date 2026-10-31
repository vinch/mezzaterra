<script lang="ts">
  import type { SVGAttributes } from "svelte/elements";

  /** Logo Instagram (absent de Lucide), plein. Mêmes props que Lucide ; les épaisseurs de trait sont ignorées. */
  let {
    size = 24,
    color = "currentColor",
    strokeWidth: _strokeWidth,
    absoluteStrokeWidth: _absolute,
    ...rest
  }: SVGAttributes<SVGSVGElement> & {
    size?: number | string;
    color?: string;
    strokeWidth?: number | string;
    absoluteStrokeWidth?: boolean;
  } = $props();
</script>

<svg viewBox="0 0 24 24" width={size} height={size} fill={color} {...rest}>
  <path
    d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 1.8A3.7 3.7 0 0 0 3.8 7.5v9a3.7 3.7 0 0 0 3.7 3.7h9a3.7 3.7 0 0 0 3.7-3.7v-9a3.7 3.7 0 0 0-3.7-3.7h-9Zm9.55 1.35a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2ZM12 6.8A5.2 5.2 0 1 1 6.8 12 5.2 5.2 0 0 1 12 6.8Zm0 1.8A3.4 3.4 0 1 0 15.4 12 3.4 3.4 0 0 0 12 8.6Z"
  />
</svg>
