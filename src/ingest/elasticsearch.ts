// Elasticsearch index bootstrap and bulk indexing for products.

import type { Client } from '@elastic/elasticsearch';
import type { MappedProduct } from '../shared/types.js';

export const INDEX_NAME = 'products';

export const INDEX_SETTINGS = {
  number_of_shards: 1,
  number_of_replicas: 0,
} as const;

export const INDEX_MAPPING = {
  dynamic: 'strict' as const,
  properties: {
    id: { type: 'integer' },
    title: {
      type: 'text',
      fields: { keyword: { type: 'keyword', ignore_above: 256 } },
    },
    description: { type: 'text' },
    brand: {
      type: 'text',
      fields: { keyword: { type: 'keyword', ignore_above: 256 } },
    },
    category: { type: 'keyword' },
    category_name: { type: 'keyword' },
    price: { type: 'scaled_float', scaling_factor: 100 },
    discount_percentage: { type: 'float' },
    rating: { type: 'float' },
    stock: { type: 'integer' },
    tags: { type: 'keyword' },
    thumbnail: { type: 'keyword', index: false },
  },
} as const;

export type ProductDocument = {
  id: number;
  title: string;
  description: string;
  brand: string | null;
  category: string;
  category_name: string;
  price: number;
  discount_percentage: number;
  rating: number;
  stock: number;
  tags: string[];
  thumbnail: string;
};

export function mappedToDocument(mapped: MappedProduct): ProductDocument {
  return {
    id: mapped.product.id,
    title: mapped.product.title,
    description: mapped.product.description,
    brand: mapped.product.brand,
    category: mapped.category.slug,
    category_name: mapped.category.name,
    price: mapped.product.price,
    discount_percentage: mapped.product.discount_percentage,
    rating: mapped.product.rating,
    stock: mapped.product.stock,
    tags: [...mapped.tags],
    thumbnail: mapped.product.thumbnail,
  };
}

export async function ensureSearchIndex(client: Client): Promise<void> {
  const exists = await client.indices.exists({ index: INDEX_NAME });
  if (exists) {
    return;
  }
  await client.indices.create({
    index: INDEX_NAME,
    settings: { ...INDEX_SETTINGS },
    mappings: { ...INDEX_MAPPING } as unknown as Record<string, unknown>,
  });
}

export async function bulkIndexProducts(
  client: Client,
  mapped: MappedProduct[],
): Promise<void> {
  if (mapped.length === 0) return;
  const operations: Array<Record<string, unknown>> = [];
  for (const item of mapped) {
    const doc = mappedToDocument(item);
    operations.push({ index: { _index: INDEX_NAME, _id: String(doc.id) } });
    operations.push(doc);
  }
  const response = await client.bulk({ refresh: true, operations });
  if (response.errors) {
    const failingIds: number[] = [];
    for (const entry of response.items) {
      const op = entry.index ?? entry.create ?? entry.update;
      if (op?.error && op._id !== undefined) {
        failingIds.push(Number(op._id));
      }
    }
    throw new Error(
      `bulk index failed for ${failingIds.length} documents: ${failingIds.join(',')}`,
    );
  }
}
