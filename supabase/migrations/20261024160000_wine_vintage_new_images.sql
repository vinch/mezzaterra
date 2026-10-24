-- Images des vins qui n'en avaient sur aucun millésime, déposées dans le bucket « wines »
-- (détourées, 1000 x 2000 px). Seuls les millésimes sans image sont touchés ; rejouable sans effet.
UPDATE public.wine_vintage v
SET image_url = 'https://wmerreifcpttrhxwmkmn.supabase.co/storage/v1/object/public/wines/' || m.file
FROM (VALUES
  ('c9b151d9-a0ce-41de-9c57-932127166215'::uuid, 'arabona-don-pasquale.png'),     -- Tenuta Arabona · Don Pasquale
  ('ba46cad5-4b9e-4ea0-8bb9-0eb392d940c1'::uuid, 'arabona-mn-passerina.png'),     -- Tenuta Arabona · Mia Natura Passerina
  ('bc130a5e-eabb-4264-bcb8-22653149e12e'::uuid, 'arabona-tc-pecorino.png'),      -- Tenuta Arabona · Terra Cruda Pecorino
  ('ed986ef8-1f98-40e0-b12f-421426303512'::uuid, 'filomusi-cerasuolo.png'),       -- Filomusi Guelfi · Cerasuolo
  ('b343ba05-d97a-4551-9364-8530511ca869'::uuid, 'gioia-valle-allegra.png'),      -- Gioia del Sole · Valle Allegra
  ('96428466-64c5-4fd1-86c0-d610e0dc90c3'::uuid, 'gioia-riserva.png'),            -- Gioia del Sole · Riserva
  ('33cc2515-351b-4831-8139-fc17e7156c02'::uuid, 'gioia-bella-addormentata.png')  -- Gioia del Sole · La Bella Addormentata
) AS m (wine_id, file)
WHERE v.wine_id = m.wine_id
  AND coalesce(btrim(v.image_url), '') = '';
