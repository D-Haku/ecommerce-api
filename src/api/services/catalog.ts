// MySQL-backed catalog queries.

import type { Pool, RowDataPacket } from 'mysql2/promise';
import type {
  Category,
  Paginated,
  Pagination,
  ProductDetail,
  ProductSummary,
} from '../../shared/types.js';

export interface CatalogService {
  listCategories(): Promise<Category[]>;
  listProducts(opts: Pagination): Promise<Paginated<ProductSummary>>;
  listProductsByCategory(
    category: string,
    opts: Pagination,
  ): Promise<Paginated<ProductSummary>>;
  getProductById(id: number): Promise<ProductDetail | null>;
}

type ProductRow = RowDataPacket & {
  id: number;
  title: string;
  description: string | null;
  price: string | number;
  discount_percentage: string | number | null;
  rating: string | number | null;
  stock: number;
  brand: string | null;
  sku: string | null;
  weight: string | number | null;
  thumbnail: string | null;
  slug: string;
};

function toNumber(v: string | number | null): number {
  if (v === null) return 0;
  return typeof v === 'number' ? v : Number(v);
}

function toSummary(row: ProductRow): ProductSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    price: toNumber(row.price),
    category: row.slug,
    brand: row.brand ?? null,
    stock: row.stock,
    rating: toNumber(row.rating),
    thumbnail: row.thumbnail ?? '',
  };
}

export function createCatalogService(pool: Pool): CatalogService {
  return {
    async listCategories() {
      const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT id, name, slug FROM categories ORDER BY name ASC',
      );
      return rows.map((r) => ({
        id: Number(r.id),
        name: String(r.name),
        slug: String(r.slug),
      }));
    },

    async listProducts({ page, pageSize }) {
      const offset = (page - 1) * pageSize;
      const [rows] = await pool.query<ProductRow[]>(
        `SELECT p.id, p.title, p.description, p.price, p.discount_percentage,
                p.rating, p.stock, p.brand, p.sku, p.weight, p.thumbnail,
                c.slug
         FROM products p
         INNER JOIN categories c ON c.id = p.category_id
         ORDER BY p.id ASC
         LIMIT ? OFFSET ?`,
        [pageSize, offset],
      );
      const [countRows] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) AS total FROM products',
      );
      const totalRow = countRows[0];
      const total = totalRow ? Number(totalRow.total) : 0;
      return {
        data: rows.map(toSummary),
        total,
        page,
        page_size: pageSize,
      };
    },

    async listProductsByCategory(category, { page, pageSize }) {
      const offset = (page - 1) * pageSize;
      const [rows] = await pool.query<ProductRow[]>(
        `SELECT p.id, p.title, p.description, p.price, p.discount_percentage,
                p.rating, p.stock, p.brand, p.sku, p.weight, p.thumbnail,
                c.slug
         FROM products p
         INNER JOIN categories c ON c.id = p.category_id
         WHERE LOWER(c.slug) = LOWER(?)
         ORDER BY p.id ASC
         LIMIT ? OFFSET ?`,
        [category, pageSize, offset],
      );
      const [countRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total
         FROM products p
         INNER JOIN categories c ON c.id = p.category_id
         WHERE LOWER(c.slug) = LOWER(?)`,
        [category],
      );
      const totalRow = countRows[0];
      const total = totalRow ? Number(totalRow.total) : 0;
      return {
        data: rows.map(toSummary),
        total,
        page,
        page_size: pageSize,
      };
    },

    async getProductById(id) {
      const [rows] = await pool.query<ProductRow[]>(
        `SELECT p.id, p.title, p.description, p.price, p.discount_percentage,
                p.rating, p.stock, p.brand, p.sku, p.weight, p.thumbnail,
                c.slug
         FROM products p
         INNER JOIN categories c ON c.id = p.category_id
         WHERE p.id = ?
         LIMIT 1`,
        [id],
      );
      const row = rows[0];
      if (!row) return null;

      const [imageRows] = await pool.query<RowDataPacket[]>(
        `SELECT url FROM product_images
         WHERE product_id = ?
         ORDER BY sort_order ASC, id ASC`,
        [id],
      );
      const [tagRows] = await pool.query<RowDataPacket[]>(
        `SELECT tag FROM product_tags
         WHERE product_id = ?
         ORDER BY tag ASC`,
        [id],
      );

      const summary = toSummary(row);
      const detail: ProductDetail = {
        ...summary,
        discount_percentage: toNumber(row.discount_percentage),
        sku: row.sku ?? null,
        weight: row.weight === null || row.weight === undefined
          ? null
          : toNumber(row.weight),
        images: imageRows.map((r) => String(r.url)),
        tags: tagRows.map((r) => String(r.tag)),
      };
      return detail;
    },
  };
}
