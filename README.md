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
code de l'admin appelle ces fonctions : la migration doit être appliquée avant de déployer ce code.

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
| `/domaines/[id]` | Page d'un domaine : présentation, carte, cépages, tous ses vins |
| `/contact` | Formulaire de contact → email à gianni@mezzaterra.be (Resend), raison préremplie via `?raison=prive\|commande\|degustation\|pro\|autre` (+ `&sujet=…`), CAPTCHA Turnstile |

| Gestion | |
|---|---|
| `/manage` | Tableau de bord : CA 12 mois, top vins, stock bas (réassort), stock dormant |
| `/manage/tastings/[id]/live` | Pilotage en direct, QR code, mode projection, demandes, inscrits |
| `/manage/requests` | Demandes « J'en veux » → ventes « En attente » |
| `/manage/insights` | Marges, rotation du stock, rentabilité des dégustations |
| `/manage/customers/[id]` | Fiche client : historique, goûts, suggestions |
| `/manage/campaigns` | Invitations et rappels par email (Resend, ou copier / messagerie) |

⌘K / Ctrl+K ouvre la recherche globale dans la gestion.
