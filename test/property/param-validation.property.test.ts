// Feature: ecommerce-api, Property 7: Integer query and path param validation
// Validates: Requirements 6.5, 7.5

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  createFakeCatalog,
  createFakeSearch,
} from './_fakes/fake-services.js';
import { buildTestServer } from './_fakes/build-test-server.js';

// Produce values that are definitely not positive integers.
const invalidIntegerString = fc.oneof(
  fc.constant('0'),
  fc.constant('-1'),
  fc.constant('-42'),
  fc.constant('1.5'),
  fc.constant('abc'),
  fc.constant('NaN'),
  fc.constant(' '),
  fc.constant('0x10'),
  fc.constant('1e2'),
);

describe('Property 7: integer query and path param validation', () => {
  it('rejects non-positive-integer page, page_size, and :id with 400', () => {
    return fc.assert(
      fc.asyncProperty(
        invalidIntegerString,
        fc.constantFrom<'page' | 'page_size' | 'id'>('page', 'page_size', 'id'),
        async (raw, target) => {
          const catalogCalls: { name: string; args: unknown[] }[] = [];
          const searchCalls: { name: string; args: unknown[] }[] = [];
          const server = await buildTestServer({
            catalog: createFakeCatalog({
              categories: [],
              products: [],
              calls: catalogCalls,
            }),
            search: createFakeSearch({ products: [], calls: searchCalls }),
          });
          try {
            let url = '';
            if (target === 'id') {
              url = `/products/${encodeURIComponent(raw)}`;
            } else {
              const other = target === 'page' ? 'page_size' : 'page';
              url = `/products?${target}=${encodeURIComponent(raw)}&${other}=10`;
            }
            const res = await server.inject({ method: 'GET', url });
            expect(res.statusCode).toBe(400);
            expect(res.headers['content-type']).toMatch(/application\/json/);
            const body = res.json();
            expect(typeof body.message).toBe('string');
            // No service method should have been reached for the failing call.
            expect(catalogCalls.length).toBe(0);
            expect(searchCalls.length).toBe(0);
          } finally {
            await server.close();
          }
        },
      ),
      { numRuns: 40 },
    );
  });
});
