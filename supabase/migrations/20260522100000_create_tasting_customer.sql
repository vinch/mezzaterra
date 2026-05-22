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
