CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE products ADD COLUMN search_text text NOT NULL DEFAULT '';

UPDATE products
SET search_text = trim(regexp_replace(
        translate(lower(name || ' ' || coalesce(brand, '')),
                  'ąćęłńóśźżáàâäãåéèêëíìîïòôöõúùûüýÿçñčďěňřšťůž',
                  'acelnoszzaaaaaaeeeeiiiioooouuuuyycncdenrstuz'),
        '[^a-z0-9]+', ' ', 'g'));

CREATE INDEX products_search_text_trgm_idx ON products USING gin (search_text gin_trgm_ops);
CREATE INDEX products_name_idx ON products (name);
