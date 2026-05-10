// Feature: ecommerce-api, Property 6: Pagination response envelope across all /products routes
// Validates: Requirements 6.2, 6.3, 6.4, 8.5, 9.4

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  createFakeCatalog,
  createFakeSearch,
} from './_fakes/fake-services.js';
import { buildTestServer } from './_fakes/build-test-server.js';
import { uniqueProductsArb } from './_fakes/arbitraries.js';

describe('Property 6: pagination envelope across all /products routes', () => {
  it('envelope fields and invariants hold for list, category, search modes', () => {
    return fc.assert(
      fc.asyncProperty(
        uniqueProductsArb(20),
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1, max: 200 }),
        fc.constantFrom<'list' | 'category' | 'search'>(
          'list',
          'category',
          'search',
        ),
        async (products, page, pageSize, mode) => {
          const state = { products, calls: [] as { name: string; args: unknown[] }[] };
          const server = await buildTestServer({
            catalog: createFakeCatalog({
              categories: [],
              products,
              calls: state.calls,
            }),
            search: createFakeSearch(state),
          });
          try {
            let url = `/products?page=${page}&page_size=${pageSize}`;
            if (mode === 'search') url += '&query=phone';
            if (mode === 'category') url += '&category=smartphones';

            const res = await server.inject({ method: 'GET', url });
            expect(res.statusCode).toBe(200);
            const body = res.json();
            expect(Object.keys(body).sort()).toEqual(
              ['data', 'page', 'page_size', 'total'].sort(),
            );
            expect(Array.isArray(body.data)).toBe(true);
            expect(Number.isInteger(body.total)).toBe(true);
            expect(body.total).toBeGreaterThanOrEqual(0);
            expect(body.page).toBe(page);
            expect(body.page_size).toBe(Math.min(pageSize, 100));
            expect(body.data.length).toBeLessThanOrEqual(body.page_size);
            if (body.page === 1) {
              expect(body.total).toBeGreaterThanOrEqual(body.data.length);
            }
          } finally {
            await server.close();
          }
        },
      ),
      { numRuns: 40 },
    );
  });
});
