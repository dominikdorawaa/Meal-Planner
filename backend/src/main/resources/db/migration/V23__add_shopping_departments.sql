CREATE TABLE shopping_departments (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    name varchar(40) NOT NULL,
    created_at timestamp(6) with time zone NOT NULL DEFAULT now(),
    CONSTRAINT shopping_departments_pkey PRIMARY KEY (id),
    CONSTRAINT shopping_departments_user_fkey FOREIGN KEY (user_id) REFERENCES app_users (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX shopping_departments_user_name_key ON shopping_departments (user_id, lower(name));

CREATE TABLE shopping_department_assignments (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    product_name varchar(255) NOT NULL,
    department varchar(64) NOT NULL,
    created_at timestamp(6) with time zone NOT NULL DEFAULT now(),
    CONSTRAINT shopping_department_assignments_pkey PRIMARY KEY (id),
    CONSTRAINT shopping_department_assignments_user_fkey FOREIGN KEY (user_id) REFERENCES app_users (id) ON DELETE CASCADE,
    CONSTRAINT shopping_department_assignments_user_product_key UNIQUE (user_id, product_name)
);
