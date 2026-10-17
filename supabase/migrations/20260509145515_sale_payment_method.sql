ALTER TABLE sale
  ADD COLUMN IF NOT EXISTS payment_method text;

COMMENT ON COLUMN sale.payment_method IS 'liquide | virement | payconiq_pro | payconiq_perso';;
