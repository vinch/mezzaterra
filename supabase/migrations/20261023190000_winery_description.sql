-- Texte de présentation public d'un domaine (page /domaines/[id]).
-- Migration purement additive.
ALTER TABLE public.winery
  ADD COLUMN IF NOT EXISTS description text;

COMMENT ON COLUMN public.winery.description IS 'Présentation publique du domaine';
