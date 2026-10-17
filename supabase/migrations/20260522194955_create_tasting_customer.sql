-- Liaison dégustation ↔ clients
CREATE TABLE public.tasting_customer (
  tasting_id uuid NOT NULL REFERENCES public.tasting (id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customer (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tasting_id, customer_id)
);

CREATE INDEX tasting_customer_customer_id_idx ON public.tasting_customer (customer_id);

COMMENT ON TABLE public.tasting_customer IS 'Clients associés à une dégustation';

ALTER TABLE public.tasting_customer ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins can read"
  ON public.tasting_customer
  FOR SELECT
  USING (is_admin());

CREATE POLICY "admins can insert"
  ON public.tasting_customer
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "admins can delete"
  ON public.tasting_customer
  FOR DELETE
  USING (is_admin());

-- Écriture admin sur tasting / tasting_wine_vintage (manquant pour le back-office)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tasting' AND policyname = 'admins can insert'
  ) THEN
    CREATE POLICY "admins can insert" ON public.tasting FOR INSERT WITH CHECK (is_admin());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tasting' AND policyname = 'admins can update'
  ) THEN
    CREATE POLICY "admins can update" ON public.tasting FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tasting' AND policyname = 'admins can delete'
  ) THEN
    CREATE POLICY "admins can delete" ON public.tasting FOR DELETE USING (is_admin());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tasting_wine_vintage' AND policyname = 'admins can insert'
  ) THEN
    CREATE POLICY "admins can insert" ON public.tasting_wine_vintage FOR INSERT WITH CHECK (is_admin());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tasting_wine_vintage' AND policyname = 'admins can update'
  ) THEN
    CREATE POLICY "admins can update" ON public.tasting_wine_vintage FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tasting_wine_vintage' AND policyname = 'admins can delete'
  ) THEN
    CREATE POLICY "admins can delete" ON public.tasting_wine_vintage FOR DELETE USING (is_admin());
  END IF;
END $$;;
