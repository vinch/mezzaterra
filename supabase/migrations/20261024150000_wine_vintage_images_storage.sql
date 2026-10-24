-- Images Filomusi Guelfi : rapatriées du site du domaine vers notre storage (bucket « wines »),
-- au format commun 1000 x 2000 px. Rejouable sans effet.
UPDATE public.wine_vintage v
SET image_url = 'https://wmerreifcpttrhxwmkmn.supabase.co/storage/v1/object/public/wines/' || m.file
FROM (VALUES
  ('Montepulciano-Cut.png', 'filomusi-montepulciano.png'),
  ('Riserva-Cut.png',       'filomusi-riserva.png'),
  ('Fonte-dei-Cut.png',     'filomusi-fonte-dei.png'),
  ('Scuderie-CUT.png',      'filomusi-scuderie.png'),
  ('Pecorino-Cut.png',      'filomusi-pecorino.png')
) AS m (source, file)
WHERE v.image_url = 'https://www.filomusiguelfi.it/wp-content/uploads/2022/06/' || m.source;
