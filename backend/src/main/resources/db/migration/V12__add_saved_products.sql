CREATE TABLE saved_products (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL DEFAULT now(),
    CONSTRAINT saved_products_pkey PRIMARY KEY (id),
    CONSTRAINT saved_products_user_fkey FOREIGN KEY (user_id) REFERENCES app_users (id) ON DELETE CASCADE,
    CONSTRAINT saved_products_product_fkey FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
    CONSTRAINT saved_products_user_product_key UNIQUE (user_id, product_id)
);

CREATE INDEX saved_products_user_created_idx ON saved_products (user_id, created_at DESC);
