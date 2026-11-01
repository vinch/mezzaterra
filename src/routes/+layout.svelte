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

  /* Nouvelle version en ligne : la navigation suivante devient un chargement complet, qui prend le nouveau
     code. Pas de rechargement imposé ailleurs (saisie, mode hors ligne d'une soirée) : une page restée sur
     l'ancienne version qui envoie un format périmé reçoit une erreur claire de la base. */
  beforeNavigate(({ willUnload, to }) => {
    if (updated.current && !willUnload && to) location.href = to.url.href;
  });
</script>

{@render children?.()}
