ALTER TABLE sale
  ADD COLUMN IF NOT EXISTS global_discount numeric,
  ADD COLUMN IF NOT EXISTS global_discount_type text;

COMMENT ON COLUMN sale.global_discount IS 'Montant ou pourcentage TTC selon global_discount_type (amount | percent)';
COMMENT ON COLUMN sale.global_discount_type IS 'amount = euros TTC à déduire du sous-total, percent = % sur le sous-total TTC';;
