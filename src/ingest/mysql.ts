// Transactional upsert of mapped products into MySQL.

import type { Pool, PoolConnection } from 'mysql2/promise';
import type { MappedProduct } from '../shared/types.js';

export class IngestFailure extends Error {
  public readonly writtenIds: number[];
  public readonly failingId: number | null;
  constructor(message: string, writtenIds: number[], failingId: number | null) {
    super(message);
    this.name = 'IngestFailure';
    this.writtenIds = writtenIds;
    this.failingId = failingId;
  }
}

export async function upsertProduct(
  conn: PoolConnection,
  mapped: MappedProduct,
): Promise<void> {
  await conn.beginTransaction();
  try {
    // Upsert the category by slug.
    await conn.query(
      `INSERT INTO categories (name, slug)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [mapped.category.name, mapped.category.slug],
    );
    const [rows] = (await conn.query(
      'SELECT id FROM categories WHERE slug = ?',
      [mapped.category.slug],
    )) as [Array<{ id: number }>, unknown];
    const categoryRow = rows[0];
    if (!categoryRow) {
      throw new Error(
        `category row missing after upsert for slug=${mapped.category.slug}`,
      );
    }
    const categoryId = categoryRow.id;

    // Upsert the product by id.
    const p = mapped.product;
    await conn.query(
      `INSERT INTO products (
        id, title, description, price, discount_percentage, rating, stock,
        brand, sku, weight, category_id, thumbnail
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        description = VALUES(description),
        price = VALUES(price),
        discount_percentage = VALUES(discount_percentage),
        rating = VALUES(rating),
        stock = VALUES(stock),
        brand = VALUES(brand),
        sku = VALUES(sku),
        weight = VALUES(weight),
        category_id = VALUES(category_id),
        thumbnail = VALUES(thumbnail)`,
      [
        p.id,
        p.title,
        p.description,
        p.price,
        p.discount_percentage,
        p.rating,
        p.stock,
        p.brand,
        p.sku,
        p.weight,
        categoryId,
        p.thumbnail,
      ],
    );

    // Replace images.
    await conn.query('DELETE FROM product_images WHERE product_id = ?', [p.id]);
    if (mapped.images.length > 0) {
      const placeholders = mapped.images.map(() => '(?, ?, ?)').join(', ');
      const values: Array<number | string> = [];
      mapped.images.forEach((url, index) => {
        values.push(p.id, url, index);
      });
      await conn.query(
        `INSERT INTO product_images (product_id, url, sort_order) VALUES ${placeholders}`,
        values,
      );
    }

    // Replace tags.
    await conn.query('DELETE FROM product_tags WHERE product_id = ?', [p.id]);
    if (mapped.tags.length > 0) {
      const uniqueTags = Array.from(new Set(mapped.tags));
      const placeholders = uniqueTags.map(() => '(?, ?)').join(', ');
      const values: Array<number | string> = [];
      uniqueTags.forEach((tag) => {
        values.push(p.id, tag);
      });
      await conn.query(
        `INSERT INTO product_tags (product_id, tag) VALUES ${placeholders}`,
        values,
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  }
}

export async function upsertAll(
  pool: Pool,
  mapped: MappedProduct[],
): Promise<number[]> {
  const written: number[] = [];
  for (const item of mapped) {
    const conn = await pool.getConnection();
    try {
      await upsertProduct(conn, item);
      written.push(item.product.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new IngestFailure(
        `mysql upsert failed at id=${item.product.id}: ${message}`,
        written,
        item.product.id,
      );
    } finally {
      conn.release();
    }
  }
  return written;
}
