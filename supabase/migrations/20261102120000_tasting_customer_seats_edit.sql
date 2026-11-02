-- Places d'un participant ajouté à la main : save_tasting prend p_seats (objet { customer_id: places })
-- et l'enregistre dans tasting_customer.seats, à l'ajout comme pour un participant déjà inscrit (il
-- vient accompagné). Sans entrée, un ajout garde 1 place et un inscrit ses places. Les places d'une
-- réservation en ligne ne passent pas par là : elles restent celles de la réservation.

-- Nouveau paramètre (avec valeur par défaut) : la fonction est recréée, avec ses droits d'origine.
DROP FUNCTION public."save_tasting"("p_tasting_id" "uuid", "p_tasting" "jsonb", "p_lot_ids" "uuid"[], "p_added_customer_ids" "uuid"[], "p_removed_customer_ids" "uuid"[]);
CREATE FUNCTION "public"."save_tasting"("p_tasting_id" "uuid", "p_tasting" "jsonb", "p_lot_ids" "uuid"[], "p_added_customer_ids" "uuid"[], "p_removed_customer_ids" "uuid"[], "p_seats" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v tasting := jsonb_populate_record(NULL::tasting, p_tasting);
  v_id uuid;
BEGIN
  PERFORM assert_admin();

  IF p_tasting_id IS NULL THEN
    INSERT INTO tasting (name, date, location, notes, start_time, price, capacity, description, is_private)
    VALUES (v.name, v.date, v.location, v.notes, v.start_time, v.price, v.capacity, v.description, coalesce(v.is_private, false))
    RETURNING id INTO v_id;
  ELSE
    UPDATE tasting SET
      name = v.name, date = v.date, location = v.location, notes = v.notes, start_time = v.start_time,
      price = v.price, capacity = v.capacity, description = v.description, is_private = coalesce(v.is_private, false)
    WHERE id = p_tasting_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Dégustation introuvable';
    END IF;
    v_id := p_tasting_id;
  END IF;

  DELETE FROM tasting_lot WHERE tasting_id = v_id;
  INSERT INTO tasting_lot (tasting_id, lot_id, "order")
  SELECT v_id, w.id, w.ord FROM unnest(p_lot_ids) WITH ORDINALITY AS w(id, ord);

  DELETE FROM tasting_customer WHERE tasting_id = v_id AND customer_id = ANY (p_removed_customer_ids);
  INSERT INTO tasting_customer (tasting_id, customer_id)
  SELECT DISTINCT v_id, c FROM unnest(p_added_customer_ids) AS c
  ON CONFLICT DO NOTHING;
  -- Places hors bornes : refusées par le CHECK de tasting_customer.seats (0 à 10).
  UPDATE tasting_customer SET seats = (p_seats ->> customer_id::text)::integer
  WHERE tasting_id = v_id AND p_seats ? customer_id::text
    AND seats IS DISTINCT FROM (p_seats ->> customer_id::text)::integer;

  RETURN v_id;
END;
$$;

ALTER FUNCTION public."save_tasting"("p_tasting_id" "uuid", "p_tasting" "jsonb", "p_lot_ids" "uuid"[], "p_added_customer_ids" "uuid"[], "p_removed_customer_ids" "uuid"[], "p_seats" "jsonb") OWNER TO "postgres";
REVOKE ALL ON FUNCTION public."save_tasting"("p_tasting_id" "uuid", "p_tasting" "jsonb", "p_lot_ids" "uuid"[], "p_added_customer_ids" "uuid"[], "p_removed_customer_ids" "uuid"[], "p_seats" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION public."save_tasting"("p_tasting_id" "uuid", "p_tasting" "jsonb", "p_lot_ids" "uuid"[], "p_added_customer_ids" "uuid"[], "p_removed_customer_ids" "uuid"[], "p_seats" "jsonb") TO "anon";
GRANT ALL ON FUNCTION public."save_tasting"("p_tasting_id" "uuid", "p_tasting" "jsonb", "p_lot_ids" "uuid"[], "p_added_customer_ids" "uuid"[], "p_removed_customer_ids" "uuid"[], "p_seats" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION public."save_tasting"("p_tasting_id" "uuid", "p_tasting" "jsonb", "p_lot_ids" "uuid"[], "p_added_customer_ids" "uuid"[], "p_removed_customer_ids" "uuid"[], "p_seats" "jsonb") TO "service_role";

NOTIFY pgrst, 'reload schema';
