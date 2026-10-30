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
fiche. À appliquer avant de déployer le code, qui lit `kind` et `volume_ml`.

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
| `/contact` | Formulaire de contact → email à gianni@mezzaterra.be (Resend), raison préremplie via `?raison=prive\|commande\|degustation\|pro\|autre` (+ `&sujet=…`), CAPTCHA Turnstile |
| `/design-system` | Vitrine du design system (composants, tokens, règles) : référence pour tout nouvel écran, non indexée |

| Gestion | |
|---|---|
| `/manage` | Tableau de bord : CA 12 mois, top vins, stock bas (réassort), stock dormant |
| `/manage/tastings/[id]/live` | Pilotage en direct, QR code, mode projection, demandes, inscrits |
| `/manage/requests` | Demandes « J'en veux » → ventes « En attente » |
| `/manage/insights` | Marges, rotation du stock, rentabilité des dégustations |
| `/manage/customers/[id]` | Fiche client : historique, goûts, suggestions |
| `/manage/campaigns` | Invitations et rappels par email (Resend, ou copier / messagerie) |

⌘K / Ctrl+K ouvre la recherche globale dans la gestion.
