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

Les migrations sont dans `supabase/migrations/`. `20261016120000_public_experience.sql` est
purement additive et active : inscriptions en ligne, notes et demandes « J'en veux » du mode live,
disponibilité publique des vins, carnet client et désinscription. Tant qu'elle n'est pas appliquée,
le site fonctionne en mode dégradé (ces fonctions sont simplement masquées ou remplacées).

`20261023120000_tasting_private.sql` ajoute `tasting.is_private` : une dégustation privée (chez un
client, en externe) n'apparaît pas dans les listes publiques et refuse les inscriptions en ligne ; sa
page et son mode live restent accessibles par lien.

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
