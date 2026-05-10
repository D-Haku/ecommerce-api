-- Initial DDL for the ecommerce-api MySQL store.
-- Idempotent: safe to run against an already-migrated database.

CREATE TABLE IF NOT EXISTS categories (
  id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  name          VARCHAR(128)    NOT NULL,
  slug          VARCHAR(128)    NOT NULL,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_name (name),
  UNIQUE KEY uq_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS products (
  id                     INT UNSIGNED    NOT NULL,
  title                  VARCHAR(255)    NOT NULL,
  description            TEXT            NULL,
  price                  DECIMAL(10,2)   NOT NULL,
  discount_percentage    DECIMAL(5,2)    NULL,
  rating                 DECIMAL(3,2)    NULL,
  stock                  INT UNSIGNED    NOT NULL DEFAULT 0,
  brand                  VARCHAR(128)    NULL,
  sku                    VARCHAR(64)     NULL,
  weight                 DECIMAL(8,3)    NULL,
  category_id            INT UNSIGNED    NOT NULL,
  thumbnail              VARCHAR(1024)   NULL,
  created_at             TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                         ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_sku (sku),
  KEY idx_products_category (category_id),
  CONSTRAINT fk_products_category
    FOREIGN KEY (category_id) REFERENCES categories(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS product_images (
  id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  product_id    INT UNSIGNED    NOT NULL,
  url           VARCHAR(1024)   NOT NULL,
  sort_order    INT UNSIGNED    NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_product_images_product (product_id),
  CONSTRAINT fk_product_images_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS product_tags (
  product_id    INT UNSIGNED    NOT NULL,
  tag           VARCHAR(64)     NOT NULL,
  PRIMARY KEY (product_id, tag),
  KEY idx_product_tags_tag (tag),
  CONSTRAINT fk_product_tags_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
