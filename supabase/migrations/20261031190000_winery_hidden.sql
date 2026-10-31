-- Domaine masqué : pas encore annoncé sur le site.
-- Non listé sur le site public (carte, accueil, catalogue) avec ses produits ; sa page et celles
-- de ses produits restent accessibles par lien (dégustations). Toujours utilisable dans la gestion.
-- Additif : une colonne avec valeur par défaut, idempotent.

ALTER TABLE public.winery
  ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.winery.hidden IS 'Domaine masqué : non listé sur le site public, avec ses produits (pages accessibles par lien)';

UPDATE public.winery
SET hidden = true
WHERE id = '2b0218e8-6656-4327-a27d-20ff65fd8e8f'; -- Donato Di Tommaso Vignaiolo
