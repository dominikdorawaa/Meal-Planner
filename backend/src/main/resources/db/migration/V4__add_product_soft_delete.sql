ALTER TABLE products ADD COLUMN deleted_at timestamp(6) with time zone;

DROP INDEX products_verified_bar_code_key;
CREATE UNIQUE INDEX products_verified_bar_code_key ON products (bar_code) WHERE status = 'VERIFIED' AND deleted_at IS NULL;
