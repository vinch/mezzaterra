-- Fin de la transition de 20261101120000_rename_products.sql : plus aucune page n'envoie l'ancienne clé
-- wine_vintage_id. save_sale, save_order et save_live_preorder ne la traduisent plus ; le trigger et les
-- fonctions de transition disparaissent. Aucune donnée touchée.

CREATE OR REPLACE FUNCTION "public"."save_live_preorder"("p_tasting_id" "uuid", "p_guest_id" "uuid", "p_items" "jsonb", "p_first_name" "text" DEFAULT NULL::"text", "p_last_name" "text" DEFAULT NULL::"text", "p_email" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text", "p_confirm" boolean DEFAULT false) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_raw jsonb := coalesce(p_items, '[]'::jsonb);
  v_confirm boolean := coalesce(p_confirm, false);
  v_items jsonb;
  v_draft live_preorder;
  v_id uuid;
BEGIN
  IF p_tasting_id IS NULL OR p_guest_id IS NULL THEN
    RAISE EXCEPTION 'Dégustation ou invité manquant.';
  END IF;
  IF jsonb_typeof(v_raw) <> 'array' THEN
    RAISE EXCEPTION 'Pré-commande illisible.';
  END IF;
  -- Comme les notes, une pré-commande ne s'enregistre qu'autour de la soirée : pas de lignes laissées
  -- dans Piloter par n'importe qui à n'importe quelle date. La confirmation, elle, reste possible après.
  IF NOT v_confirm AND NOT EXISTS (
    SELECT 1 FROM tasting t WHERE t.id = p_tasting_id AND t.date BETWEEN current_date - 1 AND current_date + 1
  ) THEN
    RETURN NULL;
  END IF;

  -- Une ligne par vin de la dégustation, quantités entières de 1 à 60 ; le reste est ignoré.
  SELECT coalesce(jsonb_agg(jsonb_build_object('lot_id', l.vid, 'quantity', l.qty) ORDER BY l.vid), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT (e ->> 'lot_id')::uuid AS vid, least(sum((e ->> 'quantity')::int), 60) AS qty
    FROM jsonb_array_elements(v_raw) e
    WHERE (e ->> 'lot_id') ~* '^[0-9a-f-]{36}$'
      AND (e ->> 'quantity') ~ '^[0-9]{1,3}$'
      AND (e ->> 'quantity')::int > 0
    GROUP BY 1
  ) l
  WHERE EXISTS (
    SELECT 1 FROM tasting_lot twv WHERE twv.tasting_id = p_tasting_id AND twv.lot_id = l.vid
  );

  IF jsonb_array_length(v_items) = 0 THEN
    IF v_confirm THEN
      RAISE EXCEPTION 'La pré-commande est vide.';
    END IF;
    DELETE FROM live_preorder WHERE tasting_id = p_tasting_id AND guest_id = p_guest_id;
    RETURN NULL;
  END IF;

  -- Coordonnées : celles du téléphone, qui les renvoie toutes à chaque fois (un champ vidé est effacé).
  INSERT INTO live_preorder (tasting_id, guest_id, first_name, last_name, email, phone, items)
  VALUES (
    p_tasting_id,
    p_guest_id,
    nullif(left(trim(coalesce(p_first_name, '')), 120), ''),
    nullif(left(trim(coalesce(p_last_name, '')), 120), ''),
    nullif(left(lower(trim(coalesce(p_email, ''))), 200), ''),
    nullif(left(trim(coalesce(p_phone, '')), 60), ''),
    v_items
  )
  ON CONFLICT (tasting_id, guest_id) DO UPDATE SET
    items = EXCLUDED.items,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    updated_at = now()
  RETURNING * INTO v_draft;

  IF NOT v_confirm THEN
    RETURN NULL;
  END IF;

  -- Sans prénom ni contact, les contraintes de wish_request refusent la demande et tout est annulé.
  INSERT INTO wish_request (tasting_id, source, guest_id, first_name, last_name, email, phone, items)
  VALUES (p_tasting_id, 'live', p_guest_id, v_draft.first_name, v_draft.last_name, v_draft.email, v_draft.phone, v_draft.items)
  RETURNING id INTO v_id;
  DELETE FROM live_preorder WHERE tasting_id = p_tasting_id AND guest_id = p_guest_id;

  RETURN v_id;
END;
$_$;

CREATE OR REPLACE FUNCTION "public"."save_order"("p_order_id" "uuid", "p_order" "jsonb", "p_items" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_order "order" := jsonb_populate_record(NULL::"order", p_order);
  v_id uuid;
  v_status text;
  v_transport_status text;
BEGIN
  PERFORM assert_admin();

  IF p_order_id IS NULL THEN
    INSERT INTO "order" (date, supplier_id, status, note, total_price)
    VALUES (v_order.date, v_order.supplier_id, coalesce(v_order.status, 'pending'), v_order.note, 0)
    RETURNING id INTO v_id;
  ELSE
    SELECT o.status, t.status INTO v_status, v_transport_status
    FROM "order" o LEFT JOIN transport t ON t.id = o.transport_id
    WHERE o.id = p_order_id
    FOR UPDATE OF o;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Commande introuvable';
    END IF;
    IF v_status = 'confirmed' THEN
      RAISE EXCEPTION 'Impossible de modifier une commande confirmée';
    END IF;
    IF v_transport_status IN ('delivered', 'cancelled') THEN
      RAISE EXCEPTION 'Impossible de modifier une commande dont le transport est livré ou annulé';
    END IF;
    UPDATE "order" SET
      date = v_order.date,
      supplier_id = v_order.supplier_id,
      status = coalesce(v_order.status, status),
      note = v_order.note
    WHERE id = p_order_id;
    DELETE FROM order_item WHERE order_id = p_order_id;
    v_id := p_order_id;
  END IF;

  INSERT INTO order_item (order_id, lot_id, quantity, price, note)
  SELECT v_id, i.lot_id, i.quantity, i.price, i.note
  FROM jsonb_populate_recordset(NULL::order_item, p_items) AS i;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."save_sale"("p_sale_id" "uuid", "p_sale" "jsonb", "p_items" "jsonb", "p_wish_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_sale sale := jsonb_populate_record(NULL::sale, p_sale);
  v_id uuid;
  v_status text;
BEGIN
  PERFORM assert_admin();

  IF p_sale_id IS NULL THEN
    INSERT INTO sale (date, customer_id, status, total_price, note, global_discount, global_discount_type, payment_method, tasting_id)
    VALUES (v_sale.date, v_sale.customer_id, 'pending', v_sale.total_price, v_sale.note, v_sale.global_discount,
            v_sale.global_discount_type, v_sale.payment_method, v_sale.tasting_id)
    RETURNING id INTO v_id;
  ELSE
    SELECT status INTO v_status FROM sale WHERE id = p_sale_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Vente introuvable';
    END IF;
    IF v_status <> 'pending' THEN
      RAISE EXCEPTION 'Seule une vente en attente se modifie : son stock n’est pas encore sorti.';
    END IF;
    UPDATE sale SET
      date = v_sale.date,
      customer_id = v_sale.customer_id,
      total_price = v_sale.total_price,
      note = v_sale.note,
      global_discount = v_sale.global_discount,
      global_discount_type = v_sale.global_discount_type,
      payment_method = v_sale.payment_method,
      tasting_id = v_sale.tasting_id
    WHERE id = p_sale_id;
    DELETE FROM sale_item WHERE sale_id = p_sale_id;
    v_id := p_sale_id;
  END IF;

  INSERT INTO sale_item (sale_id, lot_id, quantity, price, discount, discount_type, note)
  SELECT v_id, i.lot_id, i.quantity, i.price, i.discount, i.discount_type, i.note
  FROM jsonb_populate_recordset(NULL::sale_item, p_items) AS i;

  IF p_wish_id IS NOT NULL THEN
    UPDATE wish_request SET status = 'done', sale_id = v_id WHERE id = p_wish_id AND status = 'new';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cette demande a déjà été traitée.';
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

DROP TRIGGER "wish_request_legacy_lot_items" ON public."wish_request";
DROP FUNCTION public."legacy_lot_items_row"();
DROP FUNCTION public."legacy_lot_items"("p_items" "jsonb");

NOTIFY pgrst, 'reload schema';
