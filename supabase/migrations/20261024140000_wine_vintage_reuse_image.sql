-- Millésimes sans image : on reprend celle d'un autre millésime du même vin.
-- De préférence le plus proche parmi les plus anciens, à défaut le plus proche parmi les plus récents.
-- Ne touche qu'aux millésimes sans image d'un vin qui en a au moins une ; rejouable sans effet.
UPDATE public.wine_vintage target
SET image_url = s.image_url
FROM (
  SELECT DISTINCT ON (v.id) v.id, src.image_url
  FROM public.wine_vintage v
  JOIN public.wine_vintage src
    ON src.wine_id = v.wine_id
   AND btrim(src.image_url) <> ''
  WHERE coalesce(btrim(v.image_url), '') = ''
  ORDER BY v.id,
           src.production_year <= v.production_year DESC,
           abs(src.production_year - v.production_year),
           src.created_at DESC
) s
WHERE target.id = s.id;
