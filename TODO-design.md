# Écarts entre les maquettes et l'outil

Éléments présents dans les maquettes (ou le brief) qui supposent une fonction inexistante :
ils n'ont **pas** été inventés pendant la refonte visuelle.

## Ventes
- **« Annuler la vente »** (menu « … » de la maquette) : aucune action ne fait passer une vente
  en « Annulée » aujourd'hui (le statut existe en base mais n'est atteignable depuis aucun écran).
  Non ajouté au menu.
- Les changements de statut (payée, livrée, clôturée) gardent leurs confirmations natives
  (`confirm()`), qui font partie de la logique existante (débit du stock, numéro de facture).
  À remplacer par des ConfirmDialog dans un second temps, sans changer les règles.

## Tableau de bord
- **« Ajouter au déroulé »** (encart Idée du stock dormant) : il n'existe pas d'action pour ajouter
  un millésime au déroulé de la prochaine dégustation depuis le tableau de bord. L'encart propose
  « Ouvrir les dégustations » à la place.
