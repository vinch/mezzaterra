<script lang="ts">
  import type { Snippet } from "svelte";
  import { beforeNavigate } from "$app/navigation";
  import { updated } from "$app/state";
  import "../app.css";
  import "$lib/styles/tokens.css";
  interface Props {
    children?: Snippet;
  }

  let { children }: Props = $props();

  /* Nouvelle version en ligne : la navigation devient un chargement complet, qui prend le nouveau code
     (un onglet resté ouvert n'envoie plus de requêtes d'une ancienne version). */
  beforeNavigate(({ willUnload, to }) => {
    if (updated.current && !willUnload && to?.url) location.href = to.url.href;
  });
</script>

{@render children?.()}
