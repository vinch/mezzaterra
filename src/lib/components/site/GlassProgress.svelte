<script lang="ts">
  interface Props {
    /** Verre qui se remplit au fil de la dégustation. */
    value?: number;
    total?: number;
    color?: string;
    size?: string;
  }

  let {
    value = 0,
    total = 1,
    color = "var(--mz-wine-red)",
    size = "3.5rem"
  }: Props = $props();

  let ratio = $derived(total > 0 ? Math.min(1, Math.max(0, value / total)) : 0);
  /* Bol du verre : y de 6 (bord) à 46 (fond). */
  let level = $derived(46 - ratio * 34);
  const gid = "mz-glass";
</script>

<svg
  class="glass"
  viewBox="0 0 40 80"
  style="--size: {size}"
  role="img"
  aria-label="{value} sur {total}"
>
  <defs>
    <clipPath id="{gid}-bowl">
      <path d="M6 6h28c0 22-4 40-14 40S6 28 6 6z" />
    </clipPath>
  </defs>
  <g clip-path="url(#{gid}-bowl)">
    <rect class="product" x="0" y={level} width="40" height="60" style:fill={color} />
    <path
      class="wave"
      d="M-20 {level} q5 -2 10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 v4 h-70z"
      style:fill={color}
    />
  </g>
  <path
    d="M6 6h28c0 22-4 40-14 40S6 28 6 6z"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linejoin="round"
  />
  <path d="M20 46v24M11 74h18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
</svg>

<style>
  .glass {
    width: auto;
    height: var(--size);
    overflow: visible;
  }

  .product {
    transition: y 0.9s var(--mz-ease);
  }

  .wave {
    animation: wave 3.2s linear infinite;
    transition: d 0.9s var(--mz-ease);
  }

  @keyframes wave {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(20px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .wave {
      animation: none;
    }
  }
</style>
