// Feature: ecommerce-api, Property 12: Category filter is case-insensitive on slug
// Validates: Requirements 9.2

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  createFakeCatalog,
  createFakeSearch,
} from './_fakes/fake-services.js';
import { buildTestServer } from './_fakes/build-test-server.js';
import { productDetailArb } from './_fakes/arbitraries.js';

const CASE_PERMUTATION_PAIRS: Array<[string, string]> = [
  ['laptops', 'LAPTOPS'],
  ['laptops', 'Laptops'],
  ['laptops', 'lApToPs'],
  ['smartphones', 'SmartPhones'],
  ['smartphones', 'SMARTPHONES'],
];

describe('Property 12: category filter is case-insensitive', () => {
  it('returns equal {data, total} for any case permutation of the slug', () => {
    return fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...CASE_PERMUTATION_PAIRS),
        fc.array(productDetailArb({ fixedCategory: 'laptops' }), {
          minLength: 1,
          maxLength: 6,
        }),
        fc.array(productDetailArb({ fixedCategory: 'smartphones' }), {
          minLength: 1,
          maxLength: 6,
        }),
        async (pair, a, b) => {
          const seen = new Map<number, (typeof a)[number]>();
          for (const p of [...a, ...b]) seen.set(p.id, p);
          const products = Array.from(seen.values());
          const server = await buildTestServer({
            catalog: createFakeCatalog({
              categories: [],
              products,
              calls: [],
            }),
            search: createFakeSearch({ products, calls: [] }),
          });
          try {
            const [canonical, permuted] = pair;
            const resA = await server.inject({
              method: 'GET',
              url: `/products?category=${canonical}&page=1&page_size=100`,
            });
            const resB = await server.inject({
              method: 'GET',
              url: `/products?category=${permuted}&page=1&page_size=100`,
            });
            const bodyA = resA.json();
            const bodyB = resB.json();
            expect(bodyA.total).toBe(bodyB.total);
            expect(bodyA.data).toEqual(bodyB.data);
          } finally {
            await server.close();
          }
        },
      ),
      { numRuns: 30 },
    );
  });
});
