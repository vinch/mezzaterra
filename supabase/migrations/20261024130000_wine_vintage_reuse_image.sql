-- Millésimes sans image : on reprend celle d'un autre millésime du même vin.
-- De préférence le plus proche parmi les plus anciens, à défaut le plus proche parmi les plus récents.
-- Ne touche qu'aux millésimes sans image (un vin sans aucune image reste tel quel) ; rejouable sans effet.
UPDATE public.wine_vintage v
SET image_url = COALESCE((
  SELECT src.image_url
  FROM public.wine_vintage src
  WHERE src.wine_id = v.wine_id
    AND btrim(src.image_url) <> ''
  ORDER BY src.production_year <= v.production_year DESC,
           abs(src.production_year - v.production_year),
           src.created_at DESC
  LIMIT 1
), v.image_url)
WHERE coalesce(btrim(v.image_url), '') = '';
