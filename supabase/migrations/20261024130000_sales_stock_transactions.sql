-- Ventes, commandes, transports, dégustations : les écritures liées passent par des fonctions transactionnelles.
-- Avant, le navigateur enchaînait plusieurs requêtes (statut puis mouvements de stock, vente puis lignes) :
-- un échec au milieu laissait un statut changé sans son stock, ou une vente sans ses lignes.
-- Les fonctions tournent avec les droits de l'appelant (RLS appliquée) et refusent les non-administrateurs.

-- ——— Outils communs ———
CREATE OR REPLACE FUNCTION public.assert_admin()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- Date du jour à Bruxelles (les colonnes date sont sans fuseau, le serveur est en UTC).
CREATE OR REPLACE FUNCTION public.brussels_today()
RETURNS date
LANGUAGE sql
STABLE
AS $$ SELECT (now() AT TIME ZONE 'Europe/Brussels')::date $$;

-- ——— Total d'une commande = somme de ses lignes, tenu par la base ———
CREATE OR REPLACE FUNCTION public.refresh_order_total()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE "order" o
  SET total_price = coalesce((SELECT sum(oi.price * oi.quantity) FROM order_item oi WHERE oi.order_id = o.id), 0)
  WHERE o.id IN (
    CASE WHEN TG_OP <> 'DELETE' THEN NEW.order_id END,
    CASE WHEN TG_OP <> 'INSERT' THEN OLD.order_id END
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS order_item_refresh_total ON public.order_item;
CREATE TRIGGER order_item_refresh_total
  AFTER INSERT OR UPDATE OR DELETE ON public.order_item
  FOR EACH ROW EXECUTE FUNCTION public.refresh_order_total();

-- Rattrapage : commandes anciennes enregistrées à 0 alors qu'elles ont des lignes.
UPDATE public."order" o
SET total_price = t.total
FROM (SELECT order_id, sum(price * quantity) AS total FROM public.order_item GROUP BY order_id) t
WHERE t.order_id = o.id AND o.total_price = 0 AND t.total > 0;

-- ——— Numéro de facture : atomique et continu ———
-- Prochain numéro = plus grand INV-AAAA-NNN de l'année + 1, sous un verrou par année : deux factures
-- simultanées ne peuvent plus recevoir le même numéro, et une vente jamais facturée ne réserve plus de
-- place dans la séquence (l'ancien calcul tenait compte de la position de la vente dans l'année).
CREATE OR REPLACE FUNCTION public.assign_invoice_number(p_sale_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_date date;
  v_number text;
  v_year integer;
  v_next integer;
BEGIN
  PERFORM assert_admin();

  SELECT date, invoice_number INTO v_date, v_number FROM sale WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vente introuvable';
  END IF;
  IF v_number IS NOT NULL THEN
    RETURN v_number;
  END IF;

  v_year := extract(year FROM v_date)::integer;
  PERFORM pg_advisory_xact_lock(hashtext('sale.invoice_number'), v_year);

  SELECT coalesce(max(substring(invoice_number FROM '^INV-' || v_year || '-(\d+)$')::integer), 0) + 1
  INTO v_next
  FROM sale
  WHERE invoice_number LIKE 'INV-' || v_year || '-%';

  -- Au moins 3 chiffres (lpad tronquerait au-delà de 999).
  v_number := 'INV-' || v_year || '-' || lpad(v_next::text, greatest(3, length(v_next::text)), '0');
  UPDATE sale SET invoice_number = v_number WHERE id = p_sale_id;
  RETURN v_number;
END;
$$;

-- Garde-fou : deux ventes ne peuvent pas porter le même numéro.
-- Créé seulement si les données existantes le permettent (sinon un avertissement le signale).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.sale WHERE invoice_number IS NOT NULL GROUP BY invoice_number HAVING count(*) > 1
  ) THEN
    RAISE WARNING 'Numéros de facture en double : index unique sale_invoice_number_key non créé';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS sale_invoice_number_key
      ON public.sale (invoice_number) WHERE invoice_number IS NOT NULL;
  END IF;
END;
$$;

-- ——— Vente et ses lignes, en une transaction ———
-- p_sale : colonnes de sale (date, customer_id, total_price, note, global_discount, global_discount_type,
-- payment_method, tasting_id) ; p_items : lignes de sale_item (wine_vintage_id, quantity, price, discount,
-- discount_type, note). Création en « En attente » ; une modification garde le statut.
-- Une vente déjà payée ou livrée a sorti son stock : ses quantités par millésime sont figées
-- (prix, remises et note restent modifiables).
-- p_wish_id : demande « J'en veux » transformée en cette vente (marquée traitée dans la même transaction).
DROP FUNCTION IF EXISTS public.save_sale(uuid, jsonb, jsonb);
CREATE OR REPLACE FUNCTION public.save_sale(p_sale_id uuid, p_sale jsonb, p_items jsonb, p_wish_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_sale sale := jsonb_populate_record(NULL::sale, p_sale);
  v_id uuid;
  v_status text;
  v_before jsonb;
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
    IF v_status IN ('closed', 'cancelled') THEN
      RAISE EXCEPTION 'Impossible de modifier une vente clôturée ou annulée';
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
    SELECT coalesce(jsonb_object_agg(wine_vintage_id, qty), '{}')
    INTO v_before
    FROM (SELECT wine_vintage_id, sum(quantity) AS qty FROM sale_item
          WHERE sale_id = p_sale_id AND wine_vintage_id IS NOT NULL GROUP BY wine_vintage_id) q;
    DELETE FROM sale_item WHERE sale_id = p_sale_id;
    v_id := p_sale_id;
  END IF;

  INSERT INTO sale_item (sale_id, wine_vintage_id, quantity, price, discount, discount_type, note)
  SELECT v_id, i.wine_vintage_id, i.quantity, i.price, i.discount, i.discount_type, i.note
  FROM jsonb_populate_recordset(NULL::sale_item, p_items) AS i;

  IF v_status IN ('paid', 'delivered') AND EXISTS (
    SELECT 1
    FROM (SELECT wine_vintage_id, sum(quantity) AS qty FROM sale_item
          WHERE sale_id = v_id AND wine_vintage_id IS NOT NULL GROUP BY wine_vintage_id) a
    FULL JOIN jsonb_each_text(v_before) b ON b.key::uuid = a.wine_vintage_id
    WHERE coalesce(a.qty, 0) <> coalesce(b.value::integer, 0)
  ) THEN
    RAISE EXCEPTION 'Les quantités d’une vente payée ou livrée sont figées : son stock est déjà sorti.';
  END IF;

  IF p_wish_id IS NOT NULL THEN
    UPDATE wish_request SET status = 'done', sale_id = v_id WHERE id = p_wish_id AND status = 'new';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cette demande a déjà été traitée.';
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

-- ——— Statut d'une vente, avec son déstockage et son numéro de facture ———
-- Transitions permises : En attente → Payée ou Livrée ; Payée → Livrée ou Clôturée ; Livrée → Payée ou
-- Clôturée. Le stock sort quand la vente quitte « En attente » ; le numéro de facture est attribué au
-- passage en « Payée » ou à la clôture. Renvoie le numéro de facture de la vente (ou null).
CREATE OR REPLACE FUNCTION public.set_sale_status(p_sale_id uuid, p_status text)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_old text;
  v_payment text;
  v_number text;
  v_customer text;
BEGIN
  PERFORM assert_admin();

  SELECT s.status, s.payment_method, s.invoice_number,
         nullif(trim(concat_ws(' ', c.first_name, c.last_name)), '')
  INTO v_old, v_payment, v_number, v_customer
  FROM sale s
  LEFT JOIN customer c ON c.id = s.customer_id
  WHERE s.id = p_sale_id
  FOR UPDATE OF s;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vente introuvable';
  END IF;
  IF v_old = p_status THEN
    RETURN v_number;
  END IF;

  IF NOT (
    (v_old = 'pending' AND p_status IN ('paid', 'delivered'))
    OR (v_old = 'paid' AND p_status IN ('delivered', 'closed'))
    OR (v_old = 'delivered' AND p_status IN ('paid', 'closed'))
  ) THEN
    RAISE EXCEPTION 'Changement de statut impossible : %', v_old || ' → ' || p_status;
  END IF;
  IF p_status = 'paid' AND coalesce(trim(v_payment), '') = '' THEN
    RAISE EXCEPTION 'Indiquez le mode de paiement (Modifier la vente) avant de marquer comme payée.';
  END IF;

  UPDATE sale SET status = p_status WHERE id = p_sale_id;

  IF v_old = 'pending' THEN
    INSERT INTO stock_move (wine_vintage_id, reason, quantity, date, note)
    SELECT wine_vintage_id, 'sale_out', -abs(quantity), brussels_today(), 'Vente à ' || coalesce(v_customer, 'Client inconnu')
    FROM sale_item
    WHERE sale_id = p_sale_id AND wine_vintage_id IS NOT NULL;
  END IF;

  IF p_status IN ('paid', 'closed') THEN
    v_number := assign_invoice_number(p_sale_id);
  END IF;
  RETURN v_number;
END;
$$;

-- ——— Commande fournisseur et ses lignes, en une transaction ———
-- p_order : colonnes de "order" (date, supplier_id, status, note) ; p_items : lignes de order_item
-- (wine_vintage_id, quantity, price, note). Le total est tenu par le trigger des lignes. Une commande
-- confirmée n'est plus modifiable ; une modification ne touche pas au transport rattaché.
CREATE OR REPLACE FUNCTION public.save_order(p_order_id uuid, p_order jsonb, p_items jsonb)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
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

  INSERT INTO order_item (order_id, wine_vintage_id, quantity, price, note)
  SELECT v_id, i.wine_vintage_id, i.quantity, i.price, i.note
  FROM jsonb_populate_recordset(NULL::order_item, p_items) AS i;

  RETURN v_id;
END;
$$;

-- ——— Réassort : ajoute des bouteilles à la commande « En attente » du fournisseur (ou en crée une) ———
-- Renvoie l'id de la commande et si elle vient d'être créée.
CREATE OR REPLACE FUNCTION public.add_to_supplier_order(
  p_supplier_id uuid,
  p_vintage_id uuid,
  p_quantity integer,
  p_price numeric
)
RETURNS TABLE (order_id uuid, created boolean)
LANGUAGE plpgsql
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_order uuid;
  v_created boolean := false;
BEGIN
  PERFORM assert_admin();
  PERFORM pg_advisory_xact_lock(hashtext('order.reorder'), hashtext(p_supplier_id::text));

  SELECT o.id INTO v_order
  FROM "order" o
  WHERE o.supplier_id = p_supplier_id AND o.status = 'pending' AND o.transport_id IS NULL
  ORDER BY o.date DESC
  LIMIT 1
  FOR UPDATE;

  IF v_order IS NULL THEN
    INSERT INTO "order" (date, supplier_id, status, note, total_price)
    VALUES (brussels_today(), p_supplier_id, 'pending', 'Réassort préparé depuis le tableau de bord', 0)
    RETURNING id INTO v_order;
    v_created := true;
  END IF;

  UPDATE order_item SET quantity = quantity + p_quantity
  WHERE id = (
    SELECT oi.id FROM order_item oi
    WHERE oi.order_id = v_order AND oi.wine_vintage_id = p_vintage_id
    ORDER BY oi.created_at
    LIMIT 1
  );
  IF NOT FOUND THEN
    INSERT INTO order_item (order_id, wine_vintage_id, quantity, price)
    VALUES (v_order, p_vintage_id, p_quantity, p_price);
  END IF;

  RETURN QUERY SELECT v_order, v_created;
END;
$$;

-- ——— Statut d'un transport, avec l'entrée en stock à la livraison ———
-- « Livré » est définitif : le stock est entré une fois pour toutes.
CREATE OR REPLACE FUNCTION public.set_transport_status(p_transport_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_old text;
BEGIN
  PERFORM assert_admin();

  SELECT status INTO v_old FROM transport WHERE id = p_transport_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transport introuvable';
  END IF;
  IF v_old IS NOT DISTINCT FROM p_status THEN
    RETURN;
  END IF;
  IF v_old = 'delivered' THEN
    RAISE EXCEPTION 'Un transport livré ne change plus de statut : son stock est déjà entré.';
  END IF;

  UPDATE transport SET status = p_status WHERE id = p_transport_id;

  IF p_status = 'delivered' THEN
    INSERT INTO stock_move (wine_vintage_id, reason, quantity, date, note)
    SELECT oi.wine_vintage_id, 'purchase_in', abs(oi.quantity), brussels_today(), 'Réception transport'
    FROM order_item oi
    JOIN "order" o ON o.id = oi.order_id
    WHERE o.transport_id = p_transport_id;
  END IF;
END;
$$;

-- ——— Dégustation, ses vins (dans l'ordre) et ses participants, en une transaction ———
-- p_tasting : colonnes de tasting (name, date, location, notes, start_time, price, capacity, description,
-- is_private) ; p_wine_ids : millésimes dans l'ordre de passage ; participants ajoutés et retirés depuis
-- l'ouverture du formulaire (un participant inscrit entre-temps, ex. pendant le live, n'est pas effacé).
CREATE OR REPLACE FUNCTION public.save_tasting(
  p_tasting_id uuid,
  p_tasting jsonb,
  p_wine_ids uuid[],
  p_added_customer_ids uuid[],
  p_removed_customer_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
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

  DELETE FROM tasting_wine_vintage WHERE tasting_id = v_id;
  INSERT INTO tasting_wine_vintage (tasting_id, wine_vintage_id, "order")
  SELECT v_id, w.id, w.ord FROM unnest(p_wine_ids) WITH ORDINALITY AS w(id, ord);

  DELETE FROM tasting_customer WHERE tasting_id = v_id AND customer_id = ANY (p_removed_customer_ids);
  INSERT INTO tasting_customer (tasting_id, customer_id)
  SELECT DISTINCT v_id, c FROM unnest(p_added_customer_ids) AS c
  ON CONFLICT DO NOTHING;

  RETURN v_id;
END;
$$;

-- ——— Commandes rattachées à un transport : tout ou rien ———
-- Le transport ne doit être ni livré ni annulé (verrouillé le temps du rattachement), et chaque commande
-- confirmée et sans transport ; sinon rien n'est rattaché.
CREATE OR REPLACE FUNCTION public.attach_orders_to_transport(p_transport_id uuid, p_order_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_count integer;
BEGIN
  PERFORM assert_admin();

  SELECT status INTO v_status FROM transport WHERE id = p_transport_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transport introuvable';
  END IF;
  IF v_status IN ('delivered', 'cancelled') THEN
    RAISE EXCEPTION 'Ce transport est livré ou annulé : on ne peut plus y associer de commandes.';
  END IF;

  UPDATE "order" SET transport_id = p_transport_id
  WHERE id = ANY (p_order_ids) AND status = 'confirmed' AND transport_id IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> cardinality(p_order_ids) THEN
    RAISE EXCEPTION 'Seules les commandes confirmées et sans transport peuvent être associées : rien n’a été associé.';
  END IF;
END;
$$;
