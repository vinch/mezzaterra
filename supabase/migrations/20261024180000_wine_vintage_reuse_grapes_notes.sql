-- Millésimes sans cépages ou sans notes de dégustation : on reprend ceux du millésime plus ancien le plus
-- proche du même vin qui en a, comme si le millésime avait été créé en cochant « Cépages » et « Notes ».
-- Seulement depuis un millésime plus ancien (mise en bouteille, puis date de création) ; un millésime qui a
-- déjà au moins un cépage, ou au moins une note, n'est pas touché. Rejouable sans effet.

-- ——— Cépages ———
INSERT INTO public.wine_vintage_grape (wine_vintage_id, grape_id, percentage)
SELECT s.target_id, g.grape_id, g.percentage
FROM (
  SELECT DISTINCT ON (v.id) v.id AS target_id, src.id AS source_id
  FROM public.wine_vintage v
  JOIN public.wine_vintage src
    ON src.wine_id = v.wine_id
   AND (src.production_year, src.created_at) < (v.production_year, v.created_at)
   AND EXISTS (SELECT 1 FROM public.wine_vintage_grape sg WHERE sg.wine_vintage_id = src.id)
  WHERE NOT EXISTS (SELECT 1 FROM public.wine_vintage_grape vg WHERE vg.wine_vintage_id = v.id)
  ORDER BY v.id, src.production_year DESC, src.created_at DESC
) s
JOIN public.wine_vintage_grape g ON g.wine_vintage_id = s.source_id;

-- ——— Notes de dégustation (le jeu complet du millésime repris, notes vides exclues) ———
INSERT INTO public.note (wine_vintage_id, type, content)
SELECT s.target_id, n.type, n.content
FROM (
  SELECT DISTINCT ON (v.id) v.id AS target_id, src.id AS source_id
  FROM public.wine_vintage v
  JOIN public.wine_vintage src
    ON src.wine_id = v.wine_id
   AND (src.production_year, src.created_at) < (v.production_year, v.created_at)
   AND EXISTS (SELECT 1 FROM public.note sn WHERE sn.wine_vintage_id = src.id AND btrim(sn.content) <> '')
  WHERE NOT EXISTS (SELECT 1 FROM public.note vn WHERE vn.wine_vintage_id = v.id)
  ORDER BY v.id, src.production_year DESC, src.created_at DESC
) s
JOIN public.note n ON n.wine_vintage_id = s.source_id AND btrim(n.content) <> '';
