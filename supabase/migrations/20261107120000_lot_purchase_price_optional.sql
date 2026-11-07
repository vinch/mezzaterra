-- Prix d'achat facultatif : vide (NULL) = prix inconnu, la marge laisse le lot de côté ;
-- 0 = vin reçu gratuitement, sa marge vaut tout son CA.
-- Retour arrière : UPDATE lot SET purchase_price = 0 WHERE purchase_price IS NULL, puis
-- SET DEFAULT 0 et SET NOT NULL (et create_lot de 20261101120000).

ALTER TABLE public.lot ALTER COLUMN purchase_price DROP DEFAULT;
ALTER TABLE public.lot ALTER COLUMN purchase_price DROP NOT NULL;

-- Jusqu'ici, un prix non saisi prenait le défaut de la colonne : ces lots passent à « inconnu ».
-- Un vin vraiment reçu se remet à 0 depuis sa fiche.
UPDATE public.lot SET purchase_price = NULL WHERE purchase_price = 0;

-- create_lot : le prix d'achat est inséré tel quel, vide compris (plus de défaut à garder).
CREATE OR REPLACE FUNCTION "public"."create_lot"("p_lot" "jsonb", "p_source_id" "uuid" DEFAULT NULL::"uuid", "p_copy_varieties" boolean DEFAULT false, "p_copy_notes" boolean DEFAULT false) RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v lot := jsonb_populate_record(NULL::lot, p_lot);
  v_id uuid;
BEGIN
  PERFORM assert_admin();

  IF p_source_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM lot WHERE id = p_source_id AND product_id = v.product_id) THEN
    RAISE EXCEPTION 'Le lot repris doit appartenir au même produit';
  END IF;

  INSERT INTO lot (product_id, production_year, year, abv, purchase_price, price, image_url, organic, volume_ml)
  VALUES (v.product_id, v.production_year, v.year, v.abv, v.purchase_price, v.price, v.image_url,
          coalesce(v.organic, false), coalesce(v.volume_ml, 750))
  RETURNING id INTO v_id;

  IF p_source_id IS NOT NULL AND p_copy_varieties THEN
    INSERT INTO lot_variety (lot_id, variety_id, percentage)
    SELECT v_id, variety_id, percentage FROM lot_variety WHERE lot_id = p_source_id;
  END IF;

  IF p_source_id IS NOT NULL AND p_copy_notes THEN
    INSERT INTO note (lot_id, type, content)
    SELECT v_id, type, content FROM note WHERE lot_id = p_source_id;
  END IF;

  RETURN v_id;
END;
$$;
