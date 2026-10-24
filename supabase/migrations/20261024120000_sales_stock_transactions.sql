-- Ventes, commandes, transports : les écritures liées passent par des fonctions transactionnelles.
-- Avant, le navigateur enchaînait plusieurs requêtes (statut puis mouvements de stock, vente puis lignes) :
-- un échec au milieu laissait un statut changé sans son stock, ou une vente sans ses lignes.
-- Les fonctions tournent avec les droits de l'appelant (RLS appliquée) et vérifient is_admin().

-- ——— Numéro de facture : atomique et continu ———
-- Prochain numéro = plus grand numéro INV-AAAA-NNN de l'année + 1, sous un verrou par année :
-- deux factures simultanées ne peuvent plus recevoir le même numéro, et une vente jamais facturée
-- ne réserve plus de place dans la séquence (l'ancien calcul tenait compte de la position de la vente).
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
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;

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

  v_number := 'INV-' || v_year || '-' || lpad(v_next::text, 3, '0');
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
CREATE OR REPLACE FUNCTION public.save_sale(p_sale_id uuid, p_sale jsonb, p_items jsonb)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_sale sale := jsonb_populate_record(NULL::sale, p_sale);
  v_id uuid;
  v_status text;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;

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
    DELETE FROM sale_item WHERE sale_id = p_sale_id;
    v_id := p_sale_id;
  END IF;

  INSERT INTO sale_item (sale_id, wine_vintage_id, quantity, price, discount, discount_type, note)
  SELECT v_id, i.wine_vintage_id, i.quantity, i.price, i.discount, i.discount_type, i.note
  FROM jsonb_populate_recordset(NULL::sale_item, p_items) AS i;

  RETURN v_id;
END;
$$;

-- ——— Statut d'une vente, avec son déstockage et son numéro de facture ———
-- Mêmes règles que la page Ventes ; le stock sort quand la vente quitte « En attente » pour
-- « Payée » ou « Livrée », le numéro de facture est attribué au passage en « Payée » ou à la clôture.
-- Renvoie le numéro de facture de la vente (ou null).
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
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;

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

  IF v_old = 'cancelled' THEN
    RAISE EXCEPTION 'Impossible de modifier le statut d''une vente annulée.';
  END IF;
  IF v_old = 'closed' THEN
    RAISE EXCEPTION 'Impossible de modifier le statut d''une vente clôturée.';
  END IF;
  IF p_status = 'pending' AND v_old IN ('paid', 'delivered') THEN
    RAISE EXCEPTION 'Impossible de repasser en « En attente » une fois la vente engagée (payée, livrée ou clôturée).';
  END IF;
  IF p_status = 'closed' AND v_old NOT IN ('paid', 'delivered') THEN
    RAISE EXCEPTION 'Une vente ne peut être clôturée qu’à partir des statuts « Payée » ou « Livrée ».';
  END IF;
  IF p_status = 'paid' AND coalesce(trim(v_payment), '') = '' THEN
    RAISE EXCEPTION 'Indiquez le mode de paiement (Modifier la vente) avant de marquer comme payée.';
  END IF;

  UPDATE sale SET status = p_status WHERE id = p_sale_id;

  IF v_old = 'pending' AND p_status IN ('paid', 'delivered') THEN
    INSERT INTO stock_move (wine_vintage_id, reason, quantity, date, note)
    SELECT wine_vintage_id, 'sale_out', -abs(quantity), (now() AT TIME ZONE 'Europe/Brussels')::date,
           'Vente à ' || coalesce(v_customer, 'Client inconnu')
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
-- p_order : colonnes de "order" (date, supplier_id, status, total_price, note) ; p_items : lignes de
-- order_item (wine_vintage_id, quantity, price, note). Une commande confirmée n'est plus modifiable ;
-- une modification ne touche pas au transport rattaché.
CREATE OR REPLACE FUNCTION public.save_order(p_order_id uuid, p_order jsonb, p_items jsonb)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_order "order" := jsonb_populate_record(NULL::"order", p_order);
  v_id uuid;
  v_status text;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;

  IF p_order_id IS NULL THEN
    INSERT INTO "order" (date, supplier_id, status, total_price, note, transport_id)
    VALUES (v_order.date, v_order.supplier_id, coalesce(v_order.status, 'pending'), v_order.total_price, v_order.note, NULL)
    RETURNING id INTO v_id;
  ELSE
    SELECT status INTO v_status FROM "order" WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Commande introuvable';
    END IF;
    IF v_status = 'confirmed' THEN
      RAISE EXCEPTION 'Impossible de modifier une commande confirmée';
    END IF;
    UPDATE "order" SET
      date = v_order.date,
      supplier_id = v_order.supplier_id,
      status = coalesce(v_order.status, status),
      total_price = v_order.total_price,
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

-- ——— Statut d'un transport, avec l'entrée en stock à la livraison ———
CREATE OR REPLACE FUNCTION public.set_transport_status(p_transport_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_old text;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_old FROM transport WHERE id = p_transport_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transport introuvable';
  END IF;
  IF v_old IS NOT DISTINCT FROM p_status THEN
    RETURN;
  END IF;

  UPDATE transport SET status = p_status WHERE id = p_transport_id;

  IF p_status = 'delivered' THEN
    INSERT INTO stock_move (wine_vintage_id, reason, quantity, date, note)
    SELECT oi.wine_vintage_id, 'purchase_in', abs(oi.quantity), (now() AT TIME ZONE 'Europe/Brussels')::date,
           'Réception transport'
    FROM order_item oi
    JOIN "order" o ON o.id = oi.order_id
    WHERE o.transport_id = p_transport_id;
  END IF;
END;
$$;

-- ——— Rattrapage : commandes anciennes sans total ———
-- Le navigateur recalculait à chaque affichage le total des commandes à 0 ; on l'enregistre une fois.
UPDATE public."order" o
SET total_price = t.total
FROM (SELECT order_id, sum(price * quantity) AS total FROM public.order_item GROUP BY order_id) t
WHERE t.order_id = o.id AND coalesce(o.total_price, 0) = 0 AND t.total > 0;

GRANT EXECUTE ON FUNCTION public.assign_invoice_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_sale(uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_sale_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_order(uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_transport_status(uuid, text) TO authenticated;
