-- Millésime « plus jamais disponible » : on ne le recommandera plus.
-- Masqué du site public, signalé (grisé) dans la gestion, exclu des alertes de réassort.
-- Migration purement additive.
ALTER TABLE public.wine_vintage
  ADD COLUMN IF NOT EXISTS discontinued_at timestamptz;

COMMENT ON COLUMN public.wine_vintage.discontinued_at IS 'Date à laquelle le millésime a été marqué « plus jamais disponible » (NULL = toujours au catalogue)';
