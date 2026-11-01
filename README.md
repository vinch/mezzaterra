# Mezzaterra

A Svelte web application with a distinctive visual identity.

## Development

```sh
pnpm install
pnpm dev
```

## Building

```sh
pnpm build
pnpm preview
```

## Base de données

Les migrations sont dans `supabase/migrations/` et sont toutes appliquées en production : le code
suppose leurs tables et colonnes présentes. `20261016120000_public_experience.sql` active les
inscriptions en ligne, les notes et demandes « J'en veux » du mode live, la disponibilité publique
des vins et la désinscription.

`20261023120000_tasting_private.sql` ajoute `tasting.is_private` : une dégustation privée (chez un
client, en externe) n'apparaît pas dans les listes publiques et refuse les inscriptions en ligne ; sa
page et son mode live restent accessibles par lien.

`20261024120000_wine_vintage_discontinued.sql` ajoute `wine_vintage.discontinued_at` : un millésime
« plus jamais disponible » disparaît du site public (catalogue, domaine, fiche en 404), est grisé dans
la gestion et n'est plus proposé au réassort ni dans les commandes fournisseur et dégustations.

`20261024130000_sales_stock_transactions.sql` fait passer les écritures liées par des fonctions SQL
transactionnelles : ventes et commandes avec leurs lignes (`save_sale`, `save_order`), changements de
statut avec leurs mouvements de stock (`set_sale_status`, `set_transport_status`), numéro de facture
atomique et continu (`assign_invoice_number`), réassort, rattachement des commandes à un transport et
enregistrement d'une dégustation. Le total d'une commande est tenu par un trigger sur ses lignes. Le
code de l'admin appelle ces fonctions (migration appliquée en production le 24/10/2026).

`20261024140000_wine_vintage_reuse_image.sql` donne aux millésimes sans image celle d'un autre
millésime du même vin (le plus proche, de préférence plus ancien).

`20261024150000_wine_vintage_images_storage.sql` fait pointer les images Filomusi Guelfi vers notre
storage. Toutes les images des vins sont dans le bucket public `wines` : PNG détouré sur fond
transparent, 1000 × 2000 px, bouteille d'environ 1 800 px de haut, centrée, pied à ~110 px du bas.

`20261024170000_create_wine_vintage.sql` crée un millésime en reprenant, au choix, les cépages et les
notes de dégustation d'un autre millésime du même vin (fonction `create_wine_vintage`, en une
transaction). Le formulaire « Nouveau millésime » propose de reprendre image, cépages et notes du
millésime le plus récent (ou d'un autre, ou rien) ; les accords mets-vins sont rattachés au vin, donc communs
à tous ses millésimes. À appliquer avant de déployer le code : la création d'un millésime appelle
cette fonction.

`20261024180000_wine_vintage_reuse_grapes_notes.sql` donne aux millésimes sans cépages, ou sans notes
de dégustation, ceux du millésime plus ancien le plus proche du même vin qui en a (jamais depuis un
millésime plus récent). Un millésime qui a déjà au moins un cépage, ou au moins une note, n'est pas
touché.

`20261030120000_product_kind.sql` ouvre le catalogue à l'huile d'olive. Les tables gardent leur nom
(`wine` = produit, `wine_vintage` = millésime ou lot, `grape` = cépage ou variété d'olive,
`wine_type` = robe ou fruité) ; `wine`, `wine_type`, `appelation` et `grape` reçoivent une colonne
`kind` (`wine` ou `olive_oil`, domaine SQL `product_kind`, `wine` par défaut pour l'existant). Des
triggers refusent un produit dont le type, l'appellation ou les cépages sont d'un autre `kind`, et le
changement de `kind` d'une ligne déjà utilisée. Elle crée aussi les fruités (léger, moyen, intense),
le label DOP, les trois DOP oléicoles des Abruzzes et les principales variétés d'olives. Année de
récolte et appellation restent facultatives. Chaque lot reçoit enfin son contenant
(`wine_vintage.volume_ml`, 750 pour l'existant) : 50 cl, 1 L et 5 L d'une même huile, ou le magnum
d'un vin, sont des lots distincts, chacun avec son prix d'achat, son prix de vente (dégressif au
besoin) et son stock ; `create_wine_vintage` le reprend. Le site regroupe les contenants d'un même
produit et d'une même année sur une carte (« dès … ») et propose de passer de l'un à l'autre sur la
fiche. Un seul lot par produit, année (ou mise en bouteille sans année) et contenant (index uniques).
Les triggers de cohérence sont SECURITY DEFINER et verrouillent en partage les lignes qu'ils lisent
(sûrs en concurrence). Enfin, `sale_item.vat_rate` fige la TVA de chaque ligne à son enregistrement
(`product_kind_vat_rate` : huile 6 %, vin et dégustation 21 %, existant à 21 %) ; la facture d'un
professionnel la détaille par taux. À appliquer avant de déployer le code, qui lit `kind`,
`volume_ml` et `vat_rate`.

`20261030130000_sale_item_discount_check.sql` refuse une remise de ligne négative, au-delà de 100 % ou
supérieure au montant de la ligne (`NOT VALID` : nouvelles lignes seulement). La page Ventes le vérifie
aussi avec un message clair, et le total d'une ligne n'est jamais négatif.

`20261031120000_registrations_participants_contact.sql` simplifie ce qui arrive du site. Une
réservation en ligne confirmée devient aussitôt un participant (client retrouvé par email, sinon créé) ;
retirer un participant annule sa réservation. Les places d'une dégustation comptent tous les
participants, ceux ajoutés à la main compris (`tasting_seats_taken`) : le site passe en liste d'attente
une fois la capacité atteinte. Les messages
du formulaire de contact sont enregistrés (`contact_message`) par `/api/contact` avec la clé
`SUPABASE_SERVICE_ROLE_KEY` (variable serveur à définir sur Vercel ; sans elle, email seulement) et
s'affichent dans Demandes. À appliquer avant de déployer le code, qui lit `contact_message`.

`20261031140000_tasting_seats_per_participant.sql` affine les places : un participant compte les places
de ses réservations en ligne confirmées, sinon `tasting_customer.seats` (1 ajouté à la main, 0 rattaché
par un « J'en veux » pendant la soirée). Une réservation retrouve aussi un participant ajouté à la main
sans email (seul de ce nom dans la dégustation), sans modifier ses coordonnées, et remplace sa place au
lieu de s'y ajouter dans le contrôle de capacité. Un admin peut rétablir une réservation annulée. La
migration rattache les réservations confirmées des dégustations à venir (une erreur n'arrête pas la
migration) et annule celles dont le participant avait été retiré.

`20261031180000_winery_instagram.sql` ajoute `winery.instagram` : le compte Instagram d'un domaine
(saisi « @compte » ou en lien de profil, enregistré sans « @ » et en minuscules), affiché sur sa page
publique et, comme son site, dans « Du même domaine » des fiches produits. À appliquer avant de
déployer le code : la page Domaines de la gestion envoie toujours `instagram`, et tout enregistrement
d'un domaine échouerait sans la colonne.

`20261031190000_winery_hidden.sql` ajoute `winery.hidden` : un domaine masqué (pas encore annoncé)
n'est plus listé sur le site public, ses produits non plus (carte et liste de l'accueil, autres
domaines, catalogue, lien « Nos huiles »). Comme une dégustation privée, sa page et celles de ses
produits restent accessibles par lien (dégustations, QR des fiches de table). Masque
Donato Di Tommaso Vignaiolo. À appliquer avant de déployer le code, qui lit et enregistre
`winery.hidden`.

`20261031200000_live_preorder.sql` simplifie le « J'en veux » du mode dégustation : chaque ajout
enregistre une pré-commande (`live_preorder`, une par téléphone et par dégustation, sans nom ni contact
obligatoires) via la fonction `save_live_preorder`, et l'animateur la voit dans Piloter. L'invité
l'ajuste depuis son récap puis la confirme (prénom et email ou téléphone) : elle devient une demande
`wish_request` comme avant, que l'admin transforme en vente. À appliquer avant de déployer le code :
la page live appelle `save_live_preorder`. L'insertion publique directe dans `wish_request` (ancien
code) reste permise jusqu'à une migration de suivi, après le déploiement.

`20261101120000_rename_products.sql` renomme une fois pour toutes le modèle « vin » en modèle
« produit » : `wine` → `product`, `wine_vintage` → `lot`, `grape` → `variety`, `winery` →
`producer`, `wine_type` → `product_type`, `wine_pairing` → `product_pairing`, `wine_vintage_grape` →
`lot_variety`, `appelation` → `appellation`, `tasting_wine_vintage` → `tasting_lot`, avec leurs
colonnes (`wine_vintage_id` → `lot_id`, `winery_id` → `producer_id`…), la vue `inventory` et les
fonctions (`create_lot`, `public_lot_availability`, clés `lot_id` des lignes JSON de `save_sale`,
`save_order`, `save_live_preorder`…). Les migrations plus anciennes ci-dessus gardent les noms de
leur époque. La valeur `'wine'` de `kind` et le bucket `wines` ne changent pas ; les demandes et
pré-commandes déjà enregistrées avec `wine_vintage_id` restent lues. À appliquer au moment même du
déploiement du code : l'ancien code ne marche pas sur le nouveau schéma, ni l'inverse. Script
inverse : `supabase/rollback/20261101120000_rename_products_down.sql`.

```sh
supabase link --project-ref wmerreifcpttrhxwmkmn
supabase db push
pnpm update-types
```

## Pages

| Public | |
|---|---|
| `/` | Accueil : le concept Mezzaterra, vin du moment, inscription (sans annonce de dégustation) |
| `/tastings`, `/tastings/[id]` | Dégustations à venir / passées, réservation, ajout à l'agenda |
| `/tastings/[id]/live` | Mode live (thème sombre) : vin servi en direct, notes, « J'en veux » |
| `/vins`, `/vins/[id]` | Catalogue et fiches vin partageables (Open Graph) |
| `/huiles`, `/huiles/[id]` | Idem pour les huiles d'olive ; lien « Nos huiles » dès qu'une huile existe |
| `/domaines/[id]` | Page d'un domaine : présentation, carte, cépages, tous ses vins |
| `/contact` | Formulaire de contact → Demandes dans la gestion, et email à gianni@mezzaterra.be (Resend), raison préremplie via `?raison=prive\|commande\|degustation\|pro\|autre` (+ `&sujet=…`), CAPTCHA Turnstile |
| `/design-system` | Vitrine du design system (composants, tokens, règles) : référence pour tout nouvel écran, non indexée |

| Gestion | |
|---|---|
| `/manage` | Tableau de bord : CA 12 mois, top produits, stock bas (réassort), stock dormant |
| `/manage/tastings/[id]/live` | Pilotage en direct, QR code, mode projection, demandes, réservations en ligne |
| `/manage/requests` | Messages du formulaire de contact et demandes « J'en veux » (→ ventes « En attente ») |
| `/manage/insights` | Marges, rotation du stock, rentabilité des dégustations |
| `/manage/customers/[id]` | Fiche client : historique, goûts, suggestions |
| `/manage/campaigns` | Invitations et rappels par email (Resend, ou copier / messagerie) |

⌘K / Ctrl+K ouvre la recherche globale dans la gestion.
