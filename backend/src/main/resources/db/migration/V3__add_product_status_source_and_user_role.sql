ALTER TABLE app_users ADD COLUMN role varchar(20) NOT NULL DEFAULT 'USER';
ALTER TABLE app_users ADD CONSTRAINT app_users_role_check CHECK (role IN ('USER', 'ADMIN'));

ALTER TABLE products ADD COLUMN status varchar(20) NOT NULL DEFAULT 'VERIFIED';
ALTER TABLE products ADD COLUMN source varchar(20) NOT NULL DEFAULT 'USER';
ALTER TABLE products ADD COLUMN created_by uuid;
ALTER TABLE products ADD CONSTRAINT products_status_check CHECK (status IN ('VERIFIED', 'PENDING', 'REJECTED'));
ALTER TABLE products ADD CONSTRAINT products_source_check CHECK (source IN ('OFF', 'USER'));
ALTER TABLE products ADD CONSTRAINT products_created_by_fkey FOREIGN KEY (created_by) REFERENCES app_users (id) ON DELETE SET NULL;

ALTER TABLE products DROP CONSTRAINT products_bar_code_key;
CREATE UNIQUE INDEX products_verified_bar_code_key ON products (bar_code) WHERE status = 'VERIFIED';
CREATE INDEX products_bar_code_idx ON products (bar_code);
