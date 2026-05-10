// Feature: ecommerce-api, Property 8: Product summary fields in list responses
// Validates: Requirements 6.6

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  createFakeCatalog,
  createFakeSearch,
} from './_fakes/fake-services.js';
import { buildTestServer } from './_fakes/build-test-server.js';
import { uniqueProductsArb } from './_fakes/arbitraries.js';

const REQUIRED = [
  'id',
  'title',
  'description',
  'price',
  'category',
  'brand',
  'stock',
  'rating',
  'thumbnail',
].sort();

describe('Property 8: product summary fields in list responses', () => {
  it('each data element has exactly the required fields and types', () => {
    return fc.assert(
      fc.asyncProperty(
        uniqueProductsArb(12),
        fc.constantFrom<'list' | 'category' | 'search'>(
          'list',
          'category',
          'search',
        ),
        async (products, mode) => {
          const server = await buildTestServer({
            catalog: createFakeCatalog({
              categories: [],
              products,
              calls: [],
            }),
            search: createFakeSearch({ products, calls: [] }),
          });
          try {
            let url = '/products?page=1&page_size=50';
            if (mode === 'search') url += '&query=x';
            if (mode === 'category') url += '&category=laptops';
            const res = await server.inject({ method: 'GET', url });
            expect(res.statusCode).toBe(200);
            const body = res.json();
            for (const item of body.data) {
              expect(Object.keys(item).sort()).toEqual(REQUIRED);
              expect(Number.isInteger(item.id)).toBe(true);
              expect(typeof item.title).toBe('string');
              expect(typeof item.description).toBe('string');
              expect(typeof item.price).toBe('number');
              expect(typeof item.category).toBe('string');
              expect(
                item.brand === null || typeof item.brand === 'string',
              ).toBe(true);
              expect(Number.isInteger(item.stock)).toBe(true);
              expect(typeof item.rating).toBe('number');
              expect(typeof item.thumbnail).toBe('string');
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
