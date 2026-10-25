# Instructions pour les agents

Point d’entrée commun des agents de développement de Mezzaterra (Claude Code,
Cursor, Codex…).

## Design system

Toute fonctionnalité qui touche l’interface réutilise le design system. La
référence visuelle est la page `/design-system`
(`src/routes/design-system/+page.svelte`, sans connexion) : l’ouvrir avant de
construire un écran.

- **Gestion (`/manage`)** : composants de `src/lib/ui/` (`Button`,
  `IconButton`, `Field`, `Select`, `Combobox`, `AmountTypeInput`, `Stepper`,
  `DataTable`, `RowMenu`, `Menu`, `Modal`, `ConfirmDialog`, `Card`, `KpiCard`,
  `EmptyState`, `StatusBadge`, `StockBadge`, `WineDot`, `PageHeader`) et
  `ManagePageShell` pour le cadre de page. Pas de bouton, champ, tableau ou
  modale en HTML brut stylé à la main ; les classes de
  `src/lib/styles/manage-shared.css` (`.form-group`, `.table-container`,
  `.ui-btn`…) servent les anciens écrans, pas les nouveaux.
- **Site public** : primitives `mz-` de `src/lib/styles/site.css` et tokens
  `--mz-*` ; ne pas y importer les composants de la gestion.
- **Tokens uniquement** : couleurs, rayons, ombres et polices viennent des
  variables CSS (`src/app.css`, `src/lib/styles/tokens.css`), jamais de valeur
  en dur. Statuts : `statusMeta` (`src/lib/status.ts`) ; robes : `wine.ts`.
- **Règles** : un seul `primary` par écran ou modale ; `danger-solid`
  réservé à `ConfirmDialog`, qui précède toute suppression ; actions d’une
  ligne dans un `RowMenu` (« Supprimer… » en dernier) ; colonnes chiffrées en
  `.num` (en-tête compris) ; montants et dates via `formatEUR` / `formatDate` ;
  icônes importées depuis `$lib/ui/icons` (y ajouter celle qui manque).
- **Nouveau composant** : seulement si rien d’existant ne convient. Il va dans
  `src/lib/ui/`, utilise les tokens, et est ajouté à la page `/design-system`
  dans la même pull request (idem pour une nouvelle variante ou un nouveau
  token).

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
