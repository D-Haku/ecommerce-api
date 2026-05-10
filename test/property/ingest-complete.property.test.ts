// Feature: ecommerce-api, Property 2: Ingestion completeness for any source total
// Validates: Requirements 2.1

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { fetchAllProducts, type Fetcher } from '../../src/ingest/source.js';
import type { SourceProduct } from '../../src/shared/types.js';

function makeProduct(id: number): SourceProduct {
  return {
    id,
    title: `Product ${id}`,
    description: 'desc',
    category: 'smartphones',
    price: 1,
    discountPercentage: 0,
    rating: 0,
    stock: 0,
    tags: [],
    brand: null,
    sku: null,
    weight: null,
    thumbnail: '',
    images: [],
  };
}

function makeFetcher(products: SourceProduct[]): Fetcher {
  return async (url) => {
    const params = new URL(url).searchParams;
    const limit = Number(params.get('limit') ?? '100');
    const skip = Number(params.get('skip') ?? '0');
    const slice = products.slice(skip, skip + limit);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        products: slice,
        total: products.length,
        skip,
        limit,
      }),
    };
  };
}

describe('Property 2: ingestion completeness', () => {
  it('returns exactly the full source id set regardless of N modulo L', () => {
    fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 220 }),
        fc.integer({ min: 1, max: 100 }),
        async (n, l) => {
          const ids = Array.from({ length: n }, (_, i) => i + 1);
          const products = ids.map(makeProduct);

          const fetched = await fetchAllProducts(
            {
              baseUrl: 'http://fake',
              fetcher: makeFetcher(products),
              sleeper: async () => undefined,
            },
            l,
          );
          const returnedIds = fetched.map((p) => p.id).sort((a, b) => a - b);
          expect(returnedIds).toEqual(ids);
        },
      ),
      { numRuns: 100 },
    );
  });
});
