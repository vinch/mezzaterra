-- Mode dégustation : « J'en veux » crée une pré-commande, sans formulaire.
--
-- 1. Chaque téléphone (guest_id) a au plus une pré-commande par dégustation (live_preorder), sans nom
--    ni contact obligatoires. Elle suit le panier de l'invité à chaque changement ; l'animateur la
--    voit dans Piloter.
-- 2. L'invité la confirme depuis son récap : elle devient une demande « J'en veux » (wish_request
--    « new », prénom et email ou téléphone obligatoires comme avant), que l'admin transforme en vente.
-- 3. Les invités n'ont pas de compte : tout passe par save_live_preorder (SECURITY DEFINER), qui ne
--    touche qu'à la pré-commande du guest_id fourni, comme les notes (tasting_feedback). L'insertion
--    directe dans wish_request n'est plus ouverte au public.

CREATE TABLE IF NOT EXISTS public.live_preorder (
  tasting_id uuid NOT NULL REFERENCES public.tasting (id) ON DELETE CASCADE,
  guest_id uuid NOT NULL,
  first_name text CHECK (char_length(first_name) <= 120),
  last_name text CHECK (char_length(last_name) <= 120),
  email text CHECK (char_length(email) <= 200),
  phone text CHECK (char_length(phone) <= 60),
  items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) BETWEEN 1 AND 50),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tasting_id, guest_id)
);

COMMENT ON TABLE public.live_preorder IS
  'Pré-commandes des invités en direct, pas encore confirmées (écrites par save_live_preorder)';

ALTER TABLE public.live_preorder ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins can read" ON public.live_preorder FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "anyone can request" ON public.wish_request;

-- ——— Pré-commande d'un invité : enregistrer, vider ou confirmer ———
-- p_items : [{ wine_vintage_id, quantity }], vins de la dégustation uniquement. Vide : la pré-commande
-- est supprimée. p_confirm : elle devient une demande à traiter (wish_request « new »).
-- Retourne l'id de la demande créée à la confirmation, sinon NULL.
CREATE OR REPLACE FUNCTION public.save_live_preorder(
  p_tasting_id uuid,
  p_guest_id uuid,
  p_items jsonb,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_confirm boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw jsonb := coalesce(p_items, '[]'::jsonb);
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

  -- Une ligne par vin de la dégustation, quantités entières de 1 à 60 ; le reste est ignoré.
  SELECT coalesce(jsonb_agg(jsonb_build_object('wine_vintage_id', l.vid, 'quantity', l.qty) ORDER BY l.vid), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT (e ->> 'wine_vintage_id')::uuid AS vid, least(sum((e ->> 'quantity')::int), 60) AS qty
    FROM jsonb_array_elements(v_raw) e
    WHERE (e ->> 'wine_vintage_id') ~* '^[0-9a-f-]{36}$'
      AND (e ->> 'quantity') ~ '^[0-9]{1,3}$'
      AND (e ->> 'quantity')::int > 0
    GROUP BY 1
  ) l
  WHERE EXISTS (
    SELECT 1 FROM tasting_wine_vintage twv WHERE twv.tasting_id = p_tasting_id AND twv.wine_vintage_id = l.vid
  );

  IF jsonb_array_length(v_items) = 0 THEN
    IF p_confirm THEN
      RAISE EXCEPTION 'La pré-commande est vide.';
    END IF;
    DELETE FROM live_preorder WHERE tasting_id = p_tasting_id AND guest_id = p_guest_id;
    RETURN NULL;
  END IF;

  -- Coordonnées : celles déjà connues restent si l'invité ne les renvoie pas.
  INSERT INTO live_preorder AS d (tasting_id, guest_id, first_name, last_name, email, phone, items)
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
    first_name = coalesce(EXCLUDED.first_name, d.first_name),
    last_name = coalesce(EXCLUDED.last_name, d.last_name),
    email = coalesce(EXCLUDED.email, d.email),
    phone = coalesce(EXCLUDED.phone, d.phone),
    updated_at = now()
  RETURNING * INTO v_draft;

  IF NOT p_confirm THEN
    RETURN NULL;
  END IF;

  -- Sans prénom ni contact, les contraintes de wish_request refusent la demande et tout est annulé.
  INSERT INTO wish_request (tasting_id, source, guest_id, first_name, last_name, email, phone, items)
  VALUES (p_tasting_id, 'live', p_guest_id, v_draft.first_name, v_draft.last_name, v_draft.email, v_draft.phone, v_draft.items)
  RETURNING id INTO v_id;
  DELETE FROM live_preorder WHERE tasting_id = p_tasting_id AND guest_id = p_guest_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_live_preorder(uuid, uuid, jsonb, text, text, text, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.save_live_preorder(uuid, uuid, jsonb, text, text, text, text, boolean) TO anon, authenticated;
