-- Abonnés lisibles par les admins : email_subscriber n'avait qu'une policy INSERT (formulaire de
-- l'accueil), donc la page Abonnés et les campagnes lisaient une liste vide. Les visiteurs ne lisent
-- toujours rien.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'email_subscriber' AND policyname = 'admins can select'
  ) THEN
    CREATE POLICY "admins can select" ON public.email_subscriber FOR SELECT USING (is_admin());
  END IF;
END $$;
