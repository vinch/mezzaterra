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
     code. Pas de rechargement imposé ailleurs (saisie, mode hors ligne d'une soirée) ; la soirée en direct se
     recharge seule quand un envoi échoue et qu'une nouvelle version est en ligne (src/lib/live.ts). */
  beforeNavigate(({ willUnload, to, type }) => {
    if (!updated.current || willUnload || !to) return;
    /* Retour / Suivant : remplacer l'entrée où le navigateur se trouve déjà, sans en ajouter une. */
    if (type === "popstate") location.replace(to.url.href);
    else location.href = to.url.href;
  });
</script>

{@render children?.()}
