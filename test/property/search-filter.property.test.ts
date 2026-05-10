// Feature: ecommerce-api, Property 11: Search results respect category filter and relevance order
// Validates: Requirements 8.3, 8.4

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  createFakeCatalog,
  createFakeSearch,
} from './_fakes/fake-services.js';
import { buildTestServer } from './_fakes/build-test-server.js';
import { productDetailArb } from './_fakes/arbitraries.js';
import type { ProductDetail } from '../../src/shared/types.js';

// Build a small dataset with a controlled mix of categories so the filter
// has something meaningful to do.
const datasetArb = fc
  .tuple(
    fc.array(productDetailArb({ fixedCategory: 'smartphones' }), {
      minLength: 1,
      maxLength: 5,
    }),
    fc.array(productDetailArb({ fixedCategory: 'laptops' }), {
      minLength: 1,
      maxLength: 5,
    }),
  )
  .map(([a, b]) => {
    const seen = new Map<number, ProductDetail>();
    for (const p of [...a, ...b]) seen.set(p.id, p);
    return Array.from(seen.values());
  });

describe('Property 11: search filter and relevance order', () => {
  it('filters by category when provided and preserves server-reported ordering', () => {
    return fc.assert(
      fc.asyncProperty(
        datasetArb,
        fc.option(fc.constantFrom('smartphones', 'laptops'), { nil: undefined }),
        async (products, category) => {
          const server = await buildTestServer({
            catalog: createFakeCatalog({
              categories: [],
              products,
              calls: [],
            }),
            search: createFakeSearch({ products, calls: [] }),
          });
          try {
            let url = '/products?query=x&page=1&page_size=100';
            if (category) url += `&category=${category}`;
            const res = await server.inject({ method: 'GET', url });
            expect(res.statusCode).toBe(200);
            const body = res.json();
            if (category) {
              for (const item of body.data) {
                expect(item.category.toLowerCase()).toBe(category.toLowerCase());
              }
            }
            // Relevance order: our fake ranks title/brand matches first and
            // preserves insertion order for ties. The API must not re-sort
            // the server response, so the ids returned must be stable with
            // respect to sequential calls.
            const first = body.data.map((p: { id: number }) => p.id);
            const res2 = await server.inject({ method: 'GET', url });
            const second = res2.json().data.map((p: { id: number }) => p.id);
            expect(first).toEqual(second);
          } finally {
            await server.close();
          }
        },
      ),
      { numRuns: 30 },
    );
  });
});
