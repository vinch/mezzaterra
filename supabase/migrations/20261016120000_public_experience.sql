-- Expérience publique : inscriptions, mode live, demandes d'achat, carnet client.
-- Migration purement additive : aucune colonne ni table existante n'est modifiée ou supprimée.

-- ——— Dégustation : infos publiques + position live ———
ALTER TABLE public.tasting
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS price numeric(10, 2),
  ADD COLUMN IF NOT EXISTS capacity integer CHECK (capacity IS NULL OR capacity >= 0),
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS live_position integer;

COMMENT ON COLUMN public.tasting.description IS 'Texte public (contrairement à notes, qui reste interne)';
COMMENT ON COLUMN public.tasting.live_position IS 'Index (0-based) du vin servi en mode live';

-- ——— Inscriptions aux dégustations ———
CREATE TABLE IF NOT EXISTS public.tasting_registration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tasting_id uuid NOT NULL REFERENCES public.tasting (id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text,
  email text NOT NULL,
  phone text,
  seats integer NOT NULL DEFAULT 1 CHECK (seats BETWEEN 1 AND 10),
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'waitlist', 'cancelled')),
  customer_id uuid REFERENCES public.customer (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasting_registration_tasting_id_idx ON public.tasting_registration (tasting_id);

COMMENT ON TABLE public.tasting_registration IS 'Réservations publiques (via register_for_tasting)';

ALTER TABLE public.tasting_registration ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins can read" ON public.tasting_registration FOR SELECT USING (is_admin());
CREATE POLICY "admins can insert" ON public.tasting_registration FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "admins can update" ON public.tasting_registration FOR UPDATE USING (is_admin());
CREATE POLICY "admins can delete" ON public.tasting_registration FOR DELETE USING (is_admin());

CREATE OR REPLACE FUNCTION public.tasting_availability(p_tasting_id uuid)
RETURNS TABLE (capacity integer, seats_taken integer, seats_left integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.capacity,
    coalesce(sum(r.seats) FILTER (WHERE r.status = 'confirmed'), 0)::integer,
    CASE
      WHEN t.capacity IS NULL THEN NULL
      ELSE greatest(t.capacity - coalesce(sum(r.seats) FILTER (WHERE r.status = 'confirmed'), 0), 0)::integer
    END
  FROM tasting t
  LEFT JOIN tasting_registration r ON r.tasting_id = t.id
  WHERE t.id = p_tasting_id
  GROUP BY t.id, t.capacity;
$$;

CREATE OR REPLACE FUNCTION public.register_for_tasting(
  p_tasting_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_seats integer
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacity integer;
  v_date date;
  v_taken integer;
  v_status text;
  v_email text := lower(trim(coalesce(p_email, '')));
BEGIN
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;
  IF coalesce(trim(p_first_name), '') = '' THEN
    RAISE EXCEPTION 'invalid_name';
  END IF;
  IF coalesce(p_seats, 0) < 1 OR p_seats > 10 THEN
    RAISE EXCEPTION 'invalid_seats';
  END IF;

  SELECT capacity, date INTO v_capacity, v_date FROM tasting WHERE id = p_tasting_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF v_date < current_date THEN
    RAISE EXCEPTION 'past';
  END IF;

  IF EXISTS (
    SELECT 1 FROM tasting_registration
    WHERE tasting_id = p_tasting_id AND lower(email) = v_email AND status <> 'cancelled'
  ) THEN
    RETURN 'already_registered';
  END IF;

  SELECT coalesce(sum(seats), 0) INTO v_taken
  FROM tasting_registration
  WHERE tasting_id = p_tasting_id AND status = 'confirmed';

  v_status := CASE WHEN v_capacity IS NULL OR v_taken + p_seats <= v_capacity THEN 'confirmed' ELSE 'waitlist' END;

  INSERT INTO tasting_registration (tasting_id, first_name, last_name, email, phone, seats, status)
  VALUES (
    p_tasting_id,
    trim(p_first_name),
    nullif(trim(coalesce(p_last_name, '')), ''),
    v_email,
    nullif(trim(coalesce(p_phone, '')), ''),
    p_seats,
    v_status
  );

  -- Best effort : une contrainte inattendue sur email_subscriber ne doit pas bloquer l'inscription.
  BEGIN
    INSERT INTO email_subscriber (email, source) VALUES (v_email, 'registration') ON CONFLICT DO NOTHING;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  RETURN v_status;
END;
$$;

-- ——— Notes des invités en mode live (insert-only côté public) ———
CREATE TABLE IF NOT EXISTS public.tasting_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tasting_id uuid NOT NULL REFERENCES public.tasting (id) ON DELETE CASCADE,
  wine_vintage_id uuid NOT NULL REFERENCES public.wine_vintage (id) ON DELETE CASCADE,
  guest_id uuid NOT NULL,
  guest_name text CHECK (char_length(guest_name) <= 120),
  guest_email text CHECK (char_length(guest_email) <= 200),
  rating smallint CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (char_length(comment) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasting_feedback_tasting_id_idx ON public.tasting_feedback (tasting_id);

COMMENT ON TABLE public.tasting_feedback IS 'Notes laissées par les invités ; la dernière ligne par (guest_id, wine_vintage_id) fait foi';

ALTER TABLE public.tasting_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guests can rate live tastings"
  ON public.tasting_feedback
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasting t
      WHERE t.id = tasting_id AND t.date BETWEEN current_date - 1 AND current_date + 1
    )
  );
CREATE POLICY "admins can read" ON public.tasting_feedback FOR SELECT USING (is_admin());
CREATE POLICY "admins can delete" ON public.tasting_feedback FOR DELETE USING (is_admin());

-- ——— Demandes d'achat (« J'en veux », recommande depuis le carnet) ———
CREATE TABLE IF NOT EXISTS public.wish_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tasting_id uuid REFERENCES public.tasting (id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'live' CHECK (source IN ('live', 'carnet', 'site')),
  guest_id uuid,
  first_name text NOT NULL CHECK (char_length(first_name) BETWEEN 1 AND 120),
  last_name text CHECK (char_length(last_name) <= 120),
  email text CHECK (char_length(email) <= 200),
  phone text CHECK (char_length(phone) <= 60),
  items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) BETWEEN 1 AND 50),
  message text CHECK (char_length(message) <= 2000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'done', 'dismissed')),
  sale_id uuid REFERENCES public.sale (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

COMMENT ON TABLE public.wish_request IS 'Demandes d''achat publiques, transformées en ventes par un admin';

ALTER TABLE public.wish_request ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can request"
  ON public.wish_request
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'new' AND sale_id IS NULL);
CREATE POLICY "admins can read" ON public.wish_request FOR SELECT USING (is_admin());
CREATE POLICY "admins can update" ON public.wish_request FOR UPDATE USING (is_admin());
CREATE POLICY "admins can delete" ON public.wish_request FOR DELETE USING (is_admin());

-- ——— Disponibilité publique (sans exposer les quantités) ———
CREATE OR REPLACE FUNCTION public.public_wine_availability()
RETURNS TABLE (wine_vintage_id uuid, in_stock boolean, low_stock boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.wine_vintage_id,
    coalesce(i.quantity_on_hand, 0) > 0,
    coalesce(i.quantity_on_hand, 0) BETWEEN 1 AND 6
  FROM inventory i
  WHERE i.wine_vintage_id IS NOT NULL;
$$;

-- ——— Carnet client (lié à l'email vérifié de la session) ———
CREATE OR REPLACE FUNCTION public.my_notebook()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
BEGIN
  IF v_email = '' THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'email', v_email,
    'customers', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'first_name', c.first_name, 'last_name', c.last_name)), '[]'::jsonb)
      FROM customer c WHERE lower(c.email) = v_email
    ),
    'sales', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id,
        'date', s.date,
        'status', s.status,
        'total_price', s.total_price,
        'items', (
          SELECT coalesce(jsonb_agg(jsonb_build_object(
            'wine_vintage_id', si.wine_vintage_id,
            'quantity', si.quantity,
            'price', si.price,
            'note', si.note
          )), '[]'::jsonb)
          FROM sale_item si WHERE si.sale_id = s.id
        )
      ) ORDER BY s.date DESC), '[]'::jsonb)
      FROM sale s
      JOIN customer c ON c.id = s.customer_id
      WHERE lower(c.email) = v_email AND s.status <> 'cancelled'
    ),
    'tastings', (
      SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name, 'date', t.date)), '[]'::jsonb)
      FROM tasting t
      WHERE t.id IN (
        SELECT tc.tasting_id FROM tasting_customer tc JOIN customer c ON c.id = tc.customer_id WHERE lower(c.email) = v_email
        UNION
        SELECT r.tasting_id FROM tasting_registration r WHERE lower(r.email) = v_email AND r.status <> 'cancelled'
      )
    ),
    'feedback', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'tasting_id', f.tasting_id,
        'wine_vintage_id', f.wine_vintage_id,
        'rating', f.rating,
        'comment', f.comment,
        'created_at', f.created_at
      ) ORDER BY f.created_at), '[]'::jsonb)
      FROM tasting_feedback f WHERE lower(f.guest_email) = v_email
    )
  );
END;
$$;

-- ——— Désinscription newsletter (lien unique par abonné) ———
CREATE OR REPLACE FUNCTION public.unsubscribe_email(p_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH d AS (DELETE FROM email_subscriber WHERE id = p_id RETURNING 1)
  SELECT exists (SELECT 1 FROM d);
$$;

REVOKE ALL ON FUNCTION public.tasting_availability(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_for_tasting(uuid, text, text, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_wine_availability() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_notebook() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unsubscribe_email(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.tasting_availability(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_for_tasting(uuid, text, text, text, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_wine_availability() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_notebook() TO authenticated;
GRANT EXECUTE ON FUNCTION public.unsubscribe_email(uuid) TO anon, authenticated;
