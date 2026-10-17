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

## Fiche client
- « Modifier » ouvre la modale d'édition existante de la liste des clients (`/manage/customers?modifier=…`).
- Le lien de facture et le téléchargement passent par l'écran Ventes (`?facture=…`, `?telecharger=…`),
  où vit la génération du PDF (pas de duplication de la logique de facturation).

## Pilotage d'une dégustation
Fonctions de la maquette qui n'existent pas encore :
- **Présence des participants** (badge « Présent », bouton « Marquer présent », compteur « Présents / inscrits ») :
  aucune notion de présence en base. Le bandeau affiche « Participants » (participants enregistrés + inscrits en ligne).
- **Saisie des commandes par l'animateur** (Stepper par participant pour le vin en cours) : les commandes
  viennent aujourd'hui uniquement des invités (« J'en veux », table `wish_request`). Le tableau
  « Commandes des participants » les affiche (quantité pour le vin en cours, total de la soirée) avec
  « Créer la vente » / « Ignorer ».
- **« Clôturer la dégustation »** : n'existe pas. La clôture ne crée donc pas de vente « En attente » par
  participant ; chaque demande se transforme en vente individuellement (« Créer la vente »). Bouton non affiché.
- **« Ajouter un participant »** depuis le pilotage : non disponible ici (se fait dans la modale de la dégustation).
- **Durée « En direct · 1 h 24 »** : l'heure de début n'est connue que si la migration (colonne `start_time`)
  est appliquée et renseignée ; le badge affiche « En direct » sans durée.
