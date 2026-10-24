-- Une vente ne se modifie et ne se supprime plus qu'« En attente » : payée ou livrée, son stock est
-- sorti et elle est figée (avant, prix, remises et note restaient modifiables, seules les quantités
-- étaient bloquées ; la suppression n'était filtrée que par l'interface).
-- Le mode de paiement, seul champ encore utile après la livraison, se donne au passage en « Payée »
-- ou « Clôturée » (les deux facturent).

CREATE OR REPLACE FUNCTION public.save_sale(p_sale_id uuid, p_sale jsonb, p_items jsonb, p_wish_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
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

  INSERT INTO sale_item (sale_id, wine_vintage_id, quantity, price, discount, discount_type, note)
  SELECT v_id, i.wine_vintage_id, i.quantity, i.price, i.discount, i.discount_type, i.note
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

-- Nouvel argument p_payment_method : l'ancienne signature est retirée pour éviter deux surcharges.
DROP FUNCTION IF EXISTS public.set_sale_status(uuid, text);
CREATE OR REPLACE FUNCTION public.set_sale_status(p_sale_id uuid, p_status text, p_payment_method text DEFAULT NULL)
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
  -- La facture (« Payée » ou « Clôturée ») exige un mode de paiement, fourni ici s'il manque :
  -- une vente livrée n'est plus modifiable.
  IF p_status IN ('paid', 'closed') THEN
    v_payment := coalesce(nullif(trim(p_payment_method), ''), v_payment);
    IF coalesce(trim(v_payment), '') = '' THEN
      RAISE EXCEPTION 'Indiquez le mode de paiement avant de facturer la vente (payée ou clôturée).';
    END IF;
  END IF;

  UPDATE sale SET status = p_status, payment_method = v_payment WHERE id = p_sale_id;

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

-- Suppression : seulement « En attente ». Une vente payée ou livrée a des sorties de stock (sale_out)
-- et peut-être un numéro de facture : la supprimer laisserait le stock débité et un trou dans la suite.
CREATE OR REPLACE FUNCTION public.sale_delete_pending_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'Seule une vente en attente se supprime : son stock n’est pas encore sorti.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS sale_delete_pending_only ON public.sale;
CREATE TRIGGER sale_delete_pending_only
  BEFORE DELETE ON public.sale
  FOR EACH ROW EXECUTE FUNCTION public.sale_delete_pending_only();
