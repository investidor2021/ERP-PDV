-- migration_add_price_fields.sql
-- Add new columns to produtos table
ALTER TABLE produtos ADD COLUMN preco_custo FLOAT NOT NULL DEFAULT 0.0;
ALTER TABLE produtos ADD COLUMN preco_sugerido_venda FLOAT NULL;

-- Migrate existing preco_venda values to preco_custo for rows where preco_custo is 0 (initial migration)
UPDATE produtos SET preco_custo = preco_venda WHERE preco_custo = 0;
