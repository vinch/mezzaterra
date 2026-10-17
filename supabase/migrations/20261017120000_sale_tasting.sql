-- Lien vente ↔ dégustation.
-- Additif : une colonne facultative sur sale, aucune donnée existante n'est modifiée hormis le rattachement.

ALTER TABLE public.sale
  ADD COLUMN IF NOT EXISTS tasting_id uuid REFERENCES public.tasting (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sale_tasting_id_idx ON public.sale (tasting_id);

COMMENT ON COLUMN public.sale.tasting_id IS 'Dégustation pendant laquelle la vente a été conclue (facultatif)';

-- Rattachement des ventes existantes : vente conclue le jour même d'une dégustation.
-- Uniquement quand une seule dégustation a lieu ce jour-là (pas d'ambiguïté).
UPDATE public.sale s
SET tasting_id = t.id
FROM public.tasting t
WHERE s.tasting_id IS NULL
  AND s.date = t.date
  AND (SELECT count(*) FROM public.tasting t2 WHERE t2.date = s.date) = 1;
