-- Lignes de vente sans millésime (ex. frais de dégustation)
ALTER TABLE sale_item
  ALTER COLUMN wine_vintage_id DROP NOT NULL;;
