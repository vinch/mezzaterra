-- Données : dégustation du 24/03/2026 (« Dégustation XDR »), absente jusqu'ici.
-- Rattache les ventes de ce jour et inscrit leurs clients comme participants.
-- Idempotent : rejouable sans doublon.

INSERT INTO public.tasting (date, name)
SELECT '2026-03-24', 'Dégustation XDR'
WHERE NOT EXISTS (SELECT 1 FROM public.tasting WHERE date = '2026-03-24');

UPDATE public.sale s
SET tasting_id = t.id
FROM public.tasting t
WHERE t.date = '2026-03-24'
  AND t.name = 'Dégustation XDR'
  AND s.date = '2026-03-24'
  AND s.tasting_id IS NULL;

INSERT INTO public.tasting_customer (tasting_id, customer_id)
SELECT DISTINCT t.id, s.customer_id
FROM public.sale s
JOIN public.tasting t ON t.date = '2026-03-24' AND t.name = 'Dégustation XDR'
WHERE s.date = '2026-03-24'
ON CONFLICT DO NOTHING;
