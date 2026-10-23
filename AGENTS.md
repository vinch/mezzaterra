# Instructions pour les agents

Point d’entrée commun des agents de développement de Mezzaterra (Claude Code,
Cursor, Codex…).

## Avant de pousser du code

Avant tout commit poussé ou toute pull request qui touche du code :

1. lancer `/simplify` sur les changements de la branche par rapport à `main` ;
   sans cette skill (Cursor, Codex…), faire la même relecture à la main :
   réutilisation de l’existant, simplification, efficacité ;
2. après une grosse retouche, relancer `/simplify` sur cette retouche seule ;
   pas pour une ligne ;
3. lancer `pnpm check` : zéro erreur et zéro avertissement.

Un changement purement documentaire n’est pas concerné.
