CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE products ADD COLUMN search_text text NOT NULL DEFAULT '';

CREATE INDEX products_search_text_trgm_idx ON products USING gin (search_text gin_trgm_ops);
CREATE INDEX products_name_idx ON products (name);
