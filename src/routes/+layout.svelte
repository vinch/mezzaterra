<script lang="ts">
  import type { Snippet } from "svelte";
  import { beforeNavigate } from "$app/navigation";
  import { page, updated } from "$app/state";
  import "../app.css";
  import "$lib/styles/tokens.css";
  interface Props {
    children?: Snippet;
  }

  let { children }: Props = $props();

  /* Nouvelle version en ligne : la navigation devient un chargement complet, qui prend le nouveau code
     (un onglet resté ouvert n'envoie plus de requêtes d'une ancienne version). */
  beforeNavigate(({ willUnload, to }) => {
    if (updated.current && !willUnload && to) location.href = to.url.href;
  });

  /* Pages qui restent ouvertes sans naviguer (soirée en direct d'un invité…) : rechargées dès que l'onglet
     passe en arrière-plan. Pas dans la gestion, où un formulaire en cours serait perdu. */
  $effect(() => {
    if (!updated.current) return;
    const reloadWhenHidden = () => {
      if (document.visibilityState === "hidden" && !page.url.pathname.startsWith("/manage")) location.reload();
    };
    document.addEventListener("visibilitychange", reloadWhenHidden);
    return () => document.removeEventListener("visibilitychange", reloadWhenHidden);
  });
</script>

{@render children?.()}
