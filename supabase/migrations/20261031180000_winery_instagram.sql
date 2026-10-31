-- Compte Instagram d'un domaine (gestion et page publique /domaines/[id]).
-- Migration purement additive.
ALTER TABLE public.winery
  ADD COLUMN IF NOT EXISTS instagram text;

COMMENT ON COLUMN public.winery.instagram IS 'Compte Instagram du domaine (@compte ou lien instagram.com)';
