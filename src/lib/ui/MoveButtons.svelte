<script lang="ts" generics="T">
  import IconButton from "./IconButton.svelte";
  import { IconArrowDown, IconArrowUp } from "./icons";

  /**
   * « Monter » / « Descendre » d'un élément d'une liste ordonnée (ordre de passage…) : échange
   * l'élément `index` de `list` avec son voisin. `label` nomme l'élément pour les lecteurs d'écran.
   */
  interface Props {
    list: T[];
    index: number;
    label: string;
  }

  let { list = $bindable(), index, label }: Props = $props();

  function move(delta: -1 | 1) {
    const j = index + delta;
    if (index < 0 || j < 0 || j >= list.length) return;
    const next = [...list];
    [next[index], next[j]] = [next[j], next[index]];
    list = next;
  }
</script>

<IconButton label="Monter {label}" disabled={index === 0} onclick={() => move(-1)}>
  <IconArrowUp size={18} strokeWidth={1.75} />
</IconButton>
<IconButton label="Descendre {label}" disabled={index === list.length - 1} onclick={() => move(1)}>
  <IconArrowDown size={18} strokeWidth={1.75} />
</IconButton>
