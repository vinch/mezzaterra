# Instructions pour les agents

Point d’entrée commun des agents de développement de Mezzaterra (Claude Code,
Cursor, Codex…).

## Design system

Toute fonctionnalité qui touche l’interface réutilise le design system. La
référence est la page `/design-system` (`src/routes/design-system/+page.svelte`,
sans connexion) : la lire avant de construire un écran. Sa section
« Principes » fait foi pour les règles d’usage (bouton `primary`, confirmations,
menus de ligne, chiffres, accessibilité, textes).

- **Gestion (`/manage`)** : composants de `src/lib/ui/` et `ManagePageShell`
  pour le cadre de page. Pas de bouton, champ, tableau ou modale en HTML brut
  stylé à la main. De `src/lib/styles/manage-shared.css`, seules les classes
  montrées sur la page (`.error-message`, `.success-message`,
  `.checkbox-label`) servent aux nouveaux écrans ; les autres (`.form-group`,
  `.table-container`, `.ui-btn`…) sont pour les anciens. Tout chargement
  s’affiche avec `Spinner`, jamais un texte « Chargement… ».
- **Briques métier** de `src/lib/components/manage/` à réutiliser avant d’en
  écrire : `RefCrudPage` (page de référentiel complète), `CustomerAutocomplete`,
  `ProductVintageAutocomplete`, `ColumnChart`.
- **Site public** : primitives `mz-` de `src/lib/styles/site.css` et tokens
  `--mz-*` ; ne pas y importer les composants de la gestion.
- **Tokens uniquement** : couleurs, rayons, ombres et polices viennent des
  variables CSS (`src/app.css`, `src/lib/styles/tokens.css`), jamais de valeur
  en dur. Statuts : `src/lib/status.ts` ; robes : `src/lib/wine.ts` ; icônes :
  `$lib/ui/icons` (y ajouter celle qui manque).
- **Nouveau composant** : seulement si rien d’existant ne convient. Il va dans
  `src/lib/ui/`, utilise les tokens, et est ajouté à la page `/design-system`
  dans la même pull request (idem pour une nouvelle variante, un nouveau token
  ou une nouvelle règle).

## Avant de pousser du code

Avant tout commit poussé ou toute pull request qui touche du code :

1. lancer `/simplify` sur les changements de la branche par rapport à `main` ;
   sans cette skill (Cursor, Codex…), faire la même relecture à la main :
   réutilisation de l’existant, simplification, efficacité ;
2. après une grosse retouche, relancer `/simplify` sur cette retouche seule ;
   pas pour une ligne ;
3. lancer `pnpm check` : zéro erreur et zéro avertissement.

Un changement purement documentaire n’est pas concerné.

## Revue de code avant la pull request

`/simplify` améliore le code mais ne cherche pas les bugs : c’est le rôle de
`/code-review`. On la lance une fois avant d’ouvrir la pull request, après
`/simplify` (dont les retouches peuvent elles-mêmes introduire un bug), et de
nouveau si la branche change beaucoup ensuite.

Choisir le niveau selon ce que touche la branche :

- **`xhigh`** : migrations ou RLS Supabase (`supabase/migrations/`), stock
  (`stock_move`, vue `inventory`), ventes et facturation (statuts, totaux,
  `invoice_number`), commandes et transports, routes `src/routes/api/`
  (Resend, Turnstile), authentification et accès admin ;
- **`high`** : le reste du code applicatif ;
- rien : changement purement documentaire, ou CSS seule sans logique.

Pour une très grosse branche, proposer à l’utilisateur `/code-review ultra`
(revue multi-agents dans le cloud, déclenchée et facturée par lui).

Traiter le résultat ainsi :

1. corriger les findings `CONFIRMED`, un commit par correction, puis
   `pnpm check` ;
2. pour les findings `PLAUSIBLE`, vérifier : corriger s’ils sont avérés,
   sinon les mentionner dans la description de la pull request ;
3. ne pas corriger en silence un finding qui change un comportement voulu :
   le signaler à l’utilisateur.

Sans cette skill (Cursor, Codex…), relire le diff à la recherche de bugs avec
la même attention aux zones `xhigh`.
