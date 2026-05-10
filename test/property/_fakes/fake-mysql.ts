// A narrow in-memory fake for the subset of mysql2/promise used by
// src/ingest/mysql.ts. It pattern-matches the exact SQL strings emitted by
// upsertProduct and maintains tables in memory with basic transactional
// snapshot/rollback.

type CategoryRow = { id: number; name: string; slug: string };
type ProductRow = {
  id: number;
  title: string;
  description: string;
  price: number;
  discount_percentage: number;
  rating: number;
  stock: number;
  brand: string | null;
  sku: string | null;
  weight: number | null;
  category_id: number;
  thumbnail: string;
};
type ImageRow = { product_id: number; url: string; sort_order: number };
type TagRow = { product_id: number; tag: string };

type State = {
  categories: CategoryRow[];
  nextCategoryId: number;
  products: Map<number, ProductRow>;
  images: ImageRow[];
  tags: TagRow[];
};

function snapshot(s: State): State {
  return {
    categories: s.categories.map((c) => ({ ...c })),
    nextCategoryId: s.nextCategoryId,
    products: new Map(
      Array.from(s.products.entries()).map(([k, v]) => [k, { ...v }]),
    ),
    images: s.images.map((i) => ({ ...i })),
    tags: s.tags.map((t) => ({ ...t })),
  };
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

function startsWith(sql: string, prefix: string): boolean {
  return normalizeSql(sql)
    .toLowerCase()
    .startsWith(prefix.toLowerCase());
}

function includes(sql: string, fragment: string): boolean {
  return normalizeSql(sql)
    .toLowerCase()
    .includes(fragment.toLowerCase());
}

export class FakeConnection {
  private active: State | null = null;
  private rollbackSnapshot: State | null = null;

  constructor(private readonly rootGetter: () => State) {}

  private state(): State {
    return this.active ?? this.rootGetter();
  }

  async beginTransaction(): Promise<void> {
    this.rollbackSnapshot = snapshot(this.rootGetter());
    // Work directly against the root state during the transaction.
  }

  async commit(): Promise<void> {
    this.rollbackSnapshot = null;
  }

  async rollback(): Promise<void> {
    if (this.rollbackSnapshot) {
      const r = this.rootGetter();
      r.categories = this.rollbackSnapshot.categories;
      r.nextCategoryId = this.rollbackSnapshot.nextCategoryId;
      r.products = this.rollbackSnapshot.products;
      r.images = this.rollbackSnapshot.images;
      r.tags = this.rollbackSnapshot.tags;
    }
    this.rollbackSnapshot = null;
  }

  release(): void {
    // no-op
  }

  async query(sql: string, values: unknown[] = []): Promise<[unknown, unknown]> {
    const state = this.state();
    // Category upsert: INSERT INTO categories (name, slug) VALUES (?, ?) ...
    if (startsWith(sql, 'INSERT INTO categories')) {
      const [name, slug] = values as [string, string];
      const existing = state.categories.find((c) => c.slug === slug);
      if (existing) {
        existing.name = name;
      } else {
        state.categories.push({
          id: state.nextCategoryId,
          name,
          slug,
        });
        state.nextCategoryId += 1;
      }
      return [{ affectedRows: 1 }, undefined];
    }

    if (startsWith(sql, 'SELECT id FROM categories')) {
      const [slug] = values as [string];
      const row = state.categories.find((c) => c.slug === slug);
      return [row ? [{ id: row.id }] : [], undefined];
    }

    if (startsWith(sql, 'INSERT INTO products')) {
      const [
        id,
        title,
        description,
        price,
        discount_percentage,
        rating,
        stock,
        brand,
        sku,
        weight,
        category_id,
        thumbnail,
      ] = values as [
        number,
        string,
        string,
        number,
        number,
        number,
        number,
        string | null,
        string | null,
        number | null,
        number,
        string,
      ];
      state.products.set(id, {
        id,
        title,
        description,
        price,
        discount_percentage,
        rating,
        stock,
        brand,
        sku,
        weight,
        category_id,
        thumbnail,
      });
      return [{ affectedRows: 1 }, undefined];
    }

    if (startsWith(sql, 'DELETE FROM product_images')) {
      const [productId] = values as [number];
      state.images = state.images.filter((i) => i.product_id !== productId);
      return [{ affectedRows: 0 }, undefined];
    }

    if (startsWith(sql, 'INSERT INTO product_images')) {
      // values = [product_id, url, sort_order, product_id, url, sort_order, ...]
      const v = values as unknown[];
      for (let i = 0; i < v.length; i += 3) {
        const productId = v[i] as number;
        const url = v[i + 1] as string;
        const sortOrder = v[i + 2] as number;
        state.images.push({ product_id: productId, url, sort_order: sortOrder });
      }
      return [{ affectedRows: v.length / 3 }, undefined];
    }

    if (startsWith(sql, 'DELETE FROM product_tags')) {
      const [productId] = values as [number];
      state.tags = state.tags.filter((t) => t.product_id !== productId);
      return [{ affectedRows: 0 }, undefined];
    }

    if (startsWith(sql, 'INSERT INTO product_tags')) {
      const v = values as unknown[];
      for (let i = 0; i < v.length; i += 2) {
        const productId = v[i] as number;
        const tag = v[i + 1] as string;
        state.tags.push({ product_id: productId, tag });
      }
      return [{ affectedRows: v.length / 2 }, undefined];
    }

    if (includes(sql, 'information_schema')) {
      return [[], undefined];
    }

    throw new Error(`FakeConnection received unsupported SQL: ${sql}`);
  }
}

export class FakePool {
  public state: State = {
    categories: [],
    nextCategoryId: 1,
    products: new Map(),
    images: [],
    tags: [],
  };

  async getConnection(): Promise<FakeConnection> {
    return new FakeConnection(() => this.state);
  }

  async query(sql: string, values: unknown[] = []): Promise<[unknown, unknown]> {
    const conn = await this.getConnection();
    return conn.query(sql, values);
  }

  async end(): Promise<void> {
    // no-op
  }

  // Test helper: returns a canonical serialization of the full state.
  snapshotCanonical(): {
    categories: CategoryRow[];
    products: ProductRow[];
    images: ImageRow[];
    tags: TagRow[];
  } {
    const categories = [...this.state.categories].sort((a, b) => a.id - b.id);
    const products = Array.from(this.state.products.values()).sort(
      (a, b) => a.id - b.id,
    );
    const images = [...this.state.images].sort((a, b) => {
      if (a.product_id !== b.product_id) return a.product_id - b.product_id;
      return a.sort_order - b.sort_order;
    });
    const tags = [...this.state.tags].sort((a, b) => {
      if (a.product_id !== b.product_id) return a.product_id - b.product_id;
      return a.tag.localeCompare(b.tag);
    });
    return { categories, products, images, tags };
  }
}
